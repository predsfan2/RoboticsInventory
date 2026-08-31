'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

const { readData, withData, DATA_DIR } = require('./utils/storage');
const { migrate } = require('./utils/migration');
const {
  attachUser,
  requireAuth,
  verifyPassword,
  hashPassword,
  signToken,
  stripPassword,
  setAuthCookie,
  clearAuthCookie,
} = require('./utils/auth');
const { ensureUploadsDir } = require('./utils/uploads');
const { mountHub } = require('./hub');

const DATA_FILE = path.join(DATA_DIR, 'data.json');
const SEED_PATHS = [
  path.join(__dirname, '..', 'seed-data.json'),
  path.join(__dirname, 'seed-data.json'),
];

async function initializeAndMigrate() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[init] Created data directory:', DATA_DIR);
  }

  if (!fs.existsSync(DATA_FILE)) {
    let seedPath = null;
    for (const sp of SEED_PATHS) {
      if (fs.existsSync(sp)) { seedPath = sp; break; }
    }

    if (seedPath) {
      const content = await fsPromises.readFile(seedPath, 'utf8');
      await fsPromises.writeFile(DATA_FILE, content, 'utf8');
      console.log('[init] Copied', seedPath, '→ data.json');
    } else {
      await fsPromises.writeFile(DATA_FILE, '{}\n', 'utf8');
      console.log('[init] No seed file found — created empty data.json');
    }
  }

  try {
    migrate(DATA_FILE);
    console.log('[init] Migration complete');
  } catch (err) {
    console.error('[init] Migration failed:', err.message);
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    console.error('[init] Continuing in non-production despite migration error');
  }
}

function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: false, // SPA + inline Tailwind; reverse proxy can add CSP
    crossOriginEmbedderPolicy: false,
  }));

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(cors({
    origin: allowedOrigins.length
      ? (origin, cb) => {
          if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
          return cb(new Error('Not allowed by CORS'));
        }
      : true,
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(attachUser);

  app.get('/api/health', (_req, res) => {
    try {
      const data = readData();
      res.json({
        ok: true,
        uptime: process.uptime(),
        hasData: !!data,
      });
    } catch (err) {
      res.status(503).json({ ok: false, error: 'Data unavailable' });
    }
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again later.' },
  });

  // Login is name + password only (no public roster)
  app.post('/api/auth/login', loginLimiter, (req, res) => {
    const { name, password } = req.body || {};
    if (!name || !password) {
      return res.status(400).json({ error: 'name and password required' });
    }
    const data = readData();
    const user = (data['rt:users'] || []).find(
      (u) => u.name.toLowerCase() === String(name).toLowerCase()
    );
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken(user);
    setAuthCookie(res, token);
    res.json({ token, user: stripPassword(user) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearAuthCookie(res);
    res.json({ success: true });
  });

  app.post('/api/auth/password', requireAuth, async (req, res) => {
    const currentPassword = req.body && req.body.currentPassword;
    const password = req.body && req.body.password;
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
      const result = await withData(async (data) => {
        const user = (data['rt:users'] || []).find((u) => u.id === req.user.id);
        if (!user) {
          const err = new Error('User not found');
          err.status = 404;
          throw err;
        }
        if (currentPassword && !verifyPassword(currentPassword, user.password)) {
          const err = new Error('Current password is incorrect');
          err.status = 400;
          throw err;
        }
        user.password = hashPassword(password);
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        user.mustChangePassword = false;
        const token = signToken(user);
        return { user: stripPassword(user), token };
      });
      setAuthCookie(res, result.token);
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/auth/revoke-sessions', requireAuth, async (req, res) => {
    try {
      const result = await withData(async (data) => {
        const user = (data['rt:users'] || []).find((u) => u.id === req.user.id);
        if (!user) {
          const err = new Error('User not found');
          err.status = 404;
          throw err;
        }
        user.tokenVersion = (user.tokenVersion || 0) + 1;
        const token = signToken(user);
        return { user: stripPassword(user), token };
      });
      setAuthCookie(res, result.token);
      res.json({ success: true, token: result.token, user: result.user });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // All other API routes require authentication
  app.use('/api', (req, res, next) => {
    if (
      req.path === '/health' ||
      req.path === '/auth/login' ||
      req.path === '/auth/logout'
    ) {
      return next();
    }
    return requireAuth(req, res, next);
  });

  app.use('/api/items', require('./routes/items'));
  app.use('/api/move-requests', require('./routes/moves'));
  app.use('/api/purchases', require('./routes/purchases'));
  app.use('/api/borrows', require('./routes/borrows'));
  app.use('/api', require('./routes/accounting'));
  app.use('/api/approvals', require('./routes/approvals'));
  app.use('/api', require('./routes/admin'));
  app.use('/api/audit', require('./routes/audit'));
  app.use('/api/activity', require('./routes/activity'));

  mountHub(app);

  const UPLOADS_DIR = ensureUploadsDir();
  app.use('/uploads', requireAuth, (req, res, next) => {
    // Force download for non-images to reduce XSS risk
    const ext = path.extname(req.path).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
    next();
  }, express.static(UPLOADS_DIR, {
    setHeaders(res, filePath) {
      const ext = path.extname(filePath).toLowerCase();
      if (['.html', '.htm', '.svg', '.js', '.mjs'].includes(ext)) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  }));

  const PUBLIC_DIR = path.join(__dirname, '..', 'public');
  if (fs.existsSync(PUBLIC_DIR)) {
    app.use(express.static(PUBLIC_DIR));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/hub/v1')) {
        return next();
      }
      res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    });
  }

  app.use((err, req, res, _next) => {
    console.error(err.stack || err);
    const status = err.status || 500;
    if (req.path && req.path.startsWith('/hub/')) {
      const message = isProd && status === 500
        ? 'Internal server error'
        : (err.message || 'Internal server error');
      return res.status(status).json({ error: { code: 'internal', message } });
    }
    const message = isProd && status === 500
      ? 'Internal server error'
      : (err.message || 'Internal server error');
    res.status(status).json({ error: message });
  });

  return app;
}

function startServer() {
  const app = createApp();
  const PORT = process.env.PORT || 3001;
  const server = app.listen(PORT, () => {
    console.log('Robotics inventory backend running on http://localhost:' + PORT);
    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
      console.log('  (frontend not built — run `npm run build` in frontend/ to serve the SPA)');
    }
  });

  const shutdown = (signal) => {
    console.log(`[shutdown] ${signal} received`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  initializeAndMigrate()
    .then(startServer)
    .catch((err) => {
      console.error('[init] Fatal error during initialisation:', err);
      process.exit(1);
    });
}

module.exports = { initializeAndMigrate, createApp, startServer };
