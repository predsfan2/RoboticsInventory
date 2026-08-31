'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const {
  APP_ID,
  getHubJwtSecret,
  accessTtlSeconds,
  refreshTtlSeconds,
} = require('./config');

function hashRefreshToken(token) {
  return crypto.createHmac('sha256', getHubJwtSecret()).update(String(token)).digest('hex');
}

function newRefreshToken() {
  return 'rt_' + crypto.randomBytes(32).toString('base64url');
}

function newDeviceId() {
  return 'dev_' + uuidv4().replace(/-/g, '');
}

function newPairingSessionId() {
  return 'ps_' + uuidv4().replace(/-/g, '');
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newUserCode() {
  let raw = '';
  for (let i = 0; i < 8; i++) raw += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function issueAccessToken({ deviceId, scopes }) {
  const ttl = accessTtlSeconds();
  const token = jwt.sign(
    {
      sub: deviceId,
      aud: APP_ID,
      scope: scopes,
      jti: uuidv4(),
    },
    getHubJwtSecret(),
    { expiresIn: ttl }
  );
  return { token, expiresIn: ttl };
}

function verifyAccessToken(token) {
  return jwt.verify(token, getHubJwtSecret(), { audience: APP_ID });
}

function refreshExpiryIso() {
  return new Date(Date.now() + refreshTtlSeconds() * 1000).toISOString();
}

module.exports = {
  hashRefreshToken,
  newRefreshToken,
  newDeviceId,
  newPairingSessionId,
  newUserCode,
  issueAccessToken,
  verifyAccessToken,
  refreshExpiryIso,
  accessTtlSeconds,
};
