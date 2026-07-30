'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { readData } = require('./storage');
const { hasPermission } = require('./permissions');

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL = process.env.TOKEN_TTL || '7d';

function getJwtSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[auth] WARNING: SESSION_SECRET is missing or too short. ' +
      'Set a strong SESSION_SECRET (16+ chars) in production.'
    );
  }
  return secret || 'dev-only-session-secret-change-me';
}

function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), BCRYPT_ROUNDS);
}

function verifyPassword(plain, hashed) {
  if (!plain || !hashed) return false;
  // Support legacy plaintext during migration window
  if (!String(hashed).startsWith('$2')) {
    return String(hashed) === String(plain);
  }
  return bcrypt.compareSync(String(plain), String(hashed));
}

function isHashedPassword(value) {
  return typeof value === 'string' && value.startsWith('$2');
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, name: user.name, role: user.role },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL }
  );
}

function stripPassword(user) {
  if (!user) return null;
  const { password: _p, ...safe } = user;
  return safe;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  String(header).split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.rt_token) return cookies.rt_token;
  if (req.query && req.query.token) return String(req.query.token);
  return null;
}

/** Attach req.user from a signed JWT when present and valid. */
function attachUser(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, getJwtSecret());
    const data = readData();
    const user = (data['rt:users'] || []).find((u) => u.id === payload.sub);
    if (user) req.user = user;
  } catch (_err) {
    // Invalid/expired token — leave req.user unset; requireAuth will 401
  }
  next();
}

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `rt_token=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${7 * 24 * 60 * 60}`,
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = ['rt_token=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const ok = permissions.some((p) => hasPermission(req.user, p));
    if (!ok) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

/** Prefer requirePermission; kept for rare Admin-only ops like undo. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  isHashedPassword,
  signToken,
  stripPassword,
  attachUser,
  requireAuth,
  requirePermission,
  requireRole,
  getJwtSecret,
  setAuthCookie,
  clearAuthCookie,
};
