'use strict';

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const fsPromises = require('fs').promises;

const { readData, writeData, DATA_DIR } = require('./utils/storage');
const { migrate }                        = require('./utils/migration');

// ── Paths ─────────────────────────────────────────────────────────────────────
const DATA_FILE  = path.join(DATA_DIR, 'data.json');
const SEED_PATHS = [
  path.join(__dirname, '..', 'seed-data.json'),
  path.join(__dirname,       'seed-data.json'),
];

// ── initializeAndMigrate ──────────────────────────────────────────────────────
// Runs once before the HTTP server starts.
// 1. Creates the data directory if missing.
// 2. Copies the seed file to data.json if no data.json exists yet.
// 3. Runs the idempotent migration on data.json (safe to run every start).
async function initializeAndMigrate() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[init] Created data directory:', DATA_DIR);
  }

  // Copy seed → data.json when data.json is absent
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
      // Absolute minimum: write an empty-tables skeleton so migration has
      // something valid to work with.
      const skeleton = {};
      await fsPromises.writeFile(
        DATA_FILE,
        JSON.stringify(skeleton, null, 2) + '\n',
        'utf8'
      );
      console.log('[init] No seed file found — created empty data.json');
    }
  }

  // Migration is always run (it is idempotent — skips work already done)
  try {
    migrate(DATA_FILE);
    console.log('[init] Migration complete');
  } catch (err) {
    console.error('[init] Migration error (non-fatal):', err.message);
  }
}

// ── startServer ───────────────────────────────────────────────────────────────
function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Attach req.user from X-User-Id header when valid
  app.use((req, _res, next) => {
    const userId = req.headers['x-user-id'];
    if (userId) {
      const data = readData();
      if (data) {
        const user = (data['rt:users'] || []).find((u) => u.id === userId);
        if (user) req.user = user;
      }
    }
    next();
  });

  // ── API routes ──────────────────────────────────────────────────────────────
  app.use('/api/items',         require('./routes/items'));
  app.use('/api/move-requests', require('./routes/moves'));
  app.use('/api/purchases',     require('./routes/purchases'));
  app.use('/api/borrows',       require('./routes/borrows'));
  app.use('/api',               require('./routes/accounting'));
  app.use('/api/approvals',     require('./routes/approvals'));
  app.use('/api',               require('./routes/admin'));
  app.use('/api/audit',         require('./routes/audit'));
  app.use('/api/activity',      require('./routes/activity'));

  // ── Login endpoint ──────────────────────────────────────────────────────────
  app.post('/api/auth/login', (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ error: 'name and password required' });
    }
    const data = readData();
    const user = (data['rt:users'] || []).find(
      (u) =>
        u.name.toLowerCase() === name.toLowerCase() &&
        u.password === password
    );
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const { password: _p, ...safe } = user;
    res.json({ user: safe });
  });

  // ── Static uploads ──────────────────────────────────────────────────────────
  const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  app.use('/uploads', express.static(UPLOADS_DIR));

  // ── Serve built SPA ─────────────────────────────────────────────────────────
  const PUBLIC_DIR = path.join(__dirname, '..', 'public');
  if (fs.existsSync(PUBLIC_DIR)) {
    app.use(express.static(PUBLIC_DIR));
    // Catch-all: hand off all non-API paths to index.html (client-side routing)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    });
  }

  // ── Global error handler ────────────────────────────────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  // ── Listen ──────────────────────────────────────────────────────────────────
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log('Robotics inventory backend running on http://localhost:' + PORT);
    if (!fs.existsSync(PUBLIC_DIR)) {
      console.log('  (frontend not built — run `npm run build` in frontend/ to serve the SPA)');
    }
  });

  return app;
}

// ── Boot sequence ─────────────────────────────────────────────────────────────
initializeAndMigrate()
  .then(startServer)
  .catch((err) => {
    console.error('[init] Fatal error during initialisation:', err);
    process.exit(1);
  });

module.exports = { initializeAndMigrate };
