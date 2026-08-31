'use strict';

const APP_ID = 'robotics.inventory';
const APP_NAME = 'Robotics Inventory';
const APP_VERSION = require('../package.json').version;

function pairingNetwork() {
  const raw = String(process.env.HUB_PAIRING_NETWORK || 'public_allowed').trim().toLowerCase();
  return raw === 'private_only' ? 'private_only' : 'public_allowed';
}

function getHubJwtSecret() {
  const secret = process.env.HUB_JWT_SECRET || process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[hub] WARNING: HUB_JWT_SECRET / SESSION_SECRET is missing or too short.');
  }
  return secret || 'dev-only-hub-jwt-secret-change-me';
}

function accessTtlSeconds() {
  const n = parseInt(process.env.HUB_ACCESS_TTL_SECONDS, 10);
  return Number.isFinite(n) && n > 0 ? n : 900;
}

function refreshTtlSeconds() {
  const n = parseInt(process.env.HUB_REFRESH_TTL_SECONDS, 10);
  return Number.isFinite(n) && n > 0 ? n : 30 * 24 * 60 * 60;
}

function pairingTtlSeconds() {
  return 600;
}

function stripSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function publicBaseUrl(req) {
  const configured = stripSlash(process.env.HUB_PUBLIC_URL || process.env.HUB_TAILSCALE_URL || '');
  if (configured) return configured;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

module.exports = {
  APP_ID,
  APP_NAME,
  APP_VERSION,
  pairingNetwork,
  getHubJwtSecret,
  accessTtlSeconds,
  refreshTtlSeconds,
  pairingTtlSeconds,
  publicBaseUrl,
};
