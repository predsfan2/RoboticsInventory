'use strict';

const crypto = require('crypto');
const { withData, readData } = require('../utils/storage');
const {
  hashRefreshToken,
  newRefreshToken,
  newDeviceId,
  newPairingSessionId,
  newUserCode,
  issueAccessToken,
  refreshExpiryIso,
} = require('./crypto');
const { pairingTtlSeconds } = require('./config');

const HUB_DEVICES = 'hub:devices';
const HUB_SESSIONS = 'hub:pairingSessions';
const HUB_TOKENS = 'hub:refreshTokens';
const HUB_IDEMPOTENCY = 'hub:idempotency';

function nowIso() {
  return new Date().toISOString();
}

function expireSessions(data) {
  const now = Date.now();
  for (const s of data[HUB_SESSIONS] || []) {
    if (s.status === 'pending' && Date.parse(s.expires_at) <= now) {
      s.status = 'expired';
    }
  }
}

function purgeIdempotency(data) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  data[HUB_IDEMPOTENCY] = (data[HUB_IDEMPOTENCY] || []).filter(
    (row) => Date.parse(row.created_at) > cutoff
  );
}

function tokenResponse(access, refresh, scopes) {
  return {
    device_id: access.deviceId,
    access_token: access.token,
    refresh_token: refresh,
    token_type: 'Bearer',
    expires_in: access.expiresIn,
    scope: scopes,
  };
}

async function startPairing({ deviceName, client, clientVersion }) {
  return withData(async (data) => {
    if (!data[HUB_SESSIONS]) data[HUB_SESSIONS] = [];
    if (!data[HUB_DEVICES]) data[HUB_DEVICES] = [];
    if (!data[HUB_TOKENS]) data[HUB_TOKENS] = [];
    if (!data[HUB_IDEMPOTENCY]) data[HUB_IDEMPOTENCY] = [];
    expireSessions(data);
    let userCode;
    const existing = new Set((data[HUB_SESSIONS] || []).filter((s) => s.status === 'pending').map((s) => s.user_code));
    do {
      userCode = newUserCode();
    } while (existing.has(userCode));

    const session = {
      id: newPairingSessionId(),
      user_code: userCode,
      device_name: deviceName || 'Unknown device',
      client: client || '',
      client_version: clientVersion || '',
      status: 'pending',
      expires_at: new Date(Date.now() + pairingTtlSeconds() * 1000).toISOString(),
      created_at: nowIso(),
      device_id: null,
      user_id: null,
      scopes: [],
      approved_by: null,
      consumed: false,
    };
    data[HUB_SESSIONS].push(session);
    return session;
  });
}

async function approvePairing({ userCode, user, scopes }) {
  return withData(async (data) => {
    if (!data[HUB_SESSIONS]) data[HUB_SESSIONS] = [];
    if (!data[HUB_DEVICES]) data[HUB_DEVICES] = [];
    if (!data[HUB_TOKENS]) data[HUB_TOKENS] = [];
    if (!data[HUB_IDEMPOTENCY]) data[HUB_IDEMPOTENCY] = [];
    expireSessions(data);
    const code = String(userCode || '').trim().toUpperCase();
    const session = (data[HUB_SESSIONS] || []).find(
      (s) => s.user_code === code && s.status === 'pending'
    );
    if (!session) {
      const err = new Error('Unknown or expired pairing code');
      err.status = 404;
      err.code = 'not_found';
      throw err;
    }
    if (Date.parse(session.expires_at) <= Date.now()) {
      session.status = 'expired';
      const err = new Error('Pairing code expired');
      err.status = 400;
      err.code = 'expired_token';
      throw err;
    }

    const device = {
      id: newDeviceId(),
      name: session.device_name,
      client: session.client,
      client_version: session.client_version,
      user_id: user.id,
      scopes: scopes.slice(),
      created_at: nowIso(),
      last_seen_at: nowIso(),
      revoked: false,
    };
    data[HUB_DEVICES].push(device);

    session.status = 'authorized';
    session.device_id = device.id;
    session.user_id = user.id;
    session.scopes = scopes.slice();
    session.approved_by = user.name;
    session.approved_at = nowIso();
    return { session, device };
  });
}

async function denyPairing(userCode) {
  return withData(async (data) => {
    const code = String(userCode || '').trim().toUpperCase();
    const session = (data[HUB_SESSIONS] || []).find(
      (s) => s.user_code === code && s.status === 'pending'
    );
    if (!session) {
      const err = new Error('Unknown or expired pairing code');
      err.status = 404;
      err.code = 'not_found';
      throw err;
    }
    session.status = 'denied';
    return session;
  });
}

function issueTokenPair(data, device) {
  if (!data[HUB_TOKENS]) data[HUB_TOKENS] = [];
  const refresh = newRefreshToken();
  const access = issueAccessToken({ deviceId: device.id, scopes: device.scopes });
  data[HUB_TOKENS].push({
    id: 'rti_' + crypto.randomBytes(8).toString('hex'),
    device_id: device.id,
    token_hash: hashRefreshToken(refresh),
    created_at: nowIso(),
    expires_at: refreshExpiryIso(),
    rotated_at: null,
    revoked: false,
  });
  device.last_seen_at = nowIso();
  return tokenResponse({ ...access, deviceId: device.id }, refresh, device.scopes);
}

async function pollPairing(pairingSessionId) {
  return withData(async (data) => {
    if (!data[HUB_SESSIONS]) data[HUB_SESSIONS] = [];
    if (!data[HUB_DEVICES]) data[HUB_DEVICES] = [];
    if (!data[HUB_TOKENS]) data[HUB_TOKENS] = [];
    if (!data[HUB_IDEMPOTENCY]) data[HUB_IDEMPOTENCY] = [];
    expireSessions(data);
    const session = (data[HUB_SESSIONS] || []).find((s) => s.id === pairingSessionId);
    if (!session) {
      const err = new Error('Unknown pairing session');
      err.status = 400;
      err.code = 'invalid_request';
      throw err;
    }
    if (session.status === 'denied') {
      const err = new Error('Pairing denied');
      err.status = 401;
      err.code = 'access_denied';
      throw err;
    }
    if (session.status === 'expired' || Date.parse(session.expires_at) <= Date.now()) {
      session.status = 'expired';
      const err = new Error('Pairing code expired');
      err.status = 400;
      err.code = 'expired_token';
      throw err;
    }
    if (session.status === 'pending') {
      return { status: 'pending' };
    }
    if (session.status === 'authorized' && !session.consumed) {
      const device = (data[HUB_DEVICES] || []).find((d) => d.id === session.device_id);
      if (!device || device.revoked) {
        const err = new Error('Device unavailable');
        err.status = 401;
        err.code = 'access_denied';
        throw err;
      }
      const tokens = issueTokenPair(data, device);
      session.consumed = true;
      session.status = 'consumed';
      return { status: 'authorized', ...tokens };
    }
    const err = new Error('Pairing session already used');
    err.status = 400;
    err.code = 'expired_token';
    throw err;
  });
}

function revokeDeviceRecords(data, deviceId) {
  const device = (data[HUB_DEVICES] || []).find((d) => d.id === deviceId);
  if (device) device.revoked = true;
  for (const t of data[HUB_TOKENS] || []) {
    if (t.device_id === deviceId) {
      t.revoked = true;
      if (!t.rotated_at) t.rotated_at = nowIso();
    }
  }
  return device;
}

async function rotateRefreshToken(presented) {
  const hash = hashRefreshToken(presented);
  const outcome = await withData(async (data) => {
    const row = (data[HUB_TOKENS] || []).find((t) => t.token_hash === hash);
    if (!row) return { deny: true };
    const device = (data[HUB_DEVICES] || []).find((d) => d.id === row.device_id);
    if (row.revoked || row.rotated_at || Date.parse(row.expires_at) <= Date.now() || !device || device.revoked) {
      if (device) revokeDeviceRecords(data, device.id);
      return { deny: true };
    }
    row.rotated_at = nowIso();
    row.revoked = true;
    return { tokens: issueTokenPair(data, device) };
  });
  if (outcome.deny) {
    const err = new Error('Refresh token reuse or expired');
    err.status = 401;
    err.code = 'unauthorized';
    throw err;
  }
  return outcome.tokens;
}

async function revokeByRefreshToken(presented) {
  const hash = hashRefreshToken(presented);
  return withData(async (data) => {
    const row = (data[HUB_TOKENS] || []).find((t) => t.token_hash === hash);
    if (row) revokeDeviceRecords(data, row.device_id);
    return true;
  });
}

async function revokeDevice(deviceId) {
  return withData(async (data) => {
    const device = revokeDeviceRecords(data, deviceId);
    if (!device) {
      const err = new Error('Device not found');
      err.status = 404;
      err.code = 'not_found';
      throw err;
    }
    return device;
  });
}

async function touchDevice(deviceId) {
  return withData(async (data) => {
    const device = (data[HUB_DEVICES] || []).find((d) => d.id === deviceId);
    if (device) device.last_seen_at = nowIso();
    return device;
  });
}

function getDevice(deviceId) {
  const data = readData() || {};
  return (data[HUB_DEVICES] || []).find((d) => d.id === deviceId) || null;
}

function listDevices() {
  const data = readData() || {};
  return (data[HUB_DEVICES] || []).map(publicDevice);
}

function publicDevice(d) {
  const data = readData() || {};
  const user = (data['rt:users'] || []).find((u) => u.id === d.user_id);
  return {
    device_id: d.id,
    name: d.name,
    created_at: d.created_at,
    last_seen_at: d.last_seen_at,
    revoked: !!d.revoked,
    user_id: d.user_id || null,
    user_name: user ? user.name : null,
  };
}

function listPendingSessions() {
  const data = readData() || {};
  expireSessions(data);
  const now = Date.now();
  return (data[HUB_SESSIONS] || [])
    .filter((s) => s.status === 'pending' && Date.parse(s.expires_at) > now)
    .map((s) => ({
      pairing_session_id: s.id,
      user_code: s.user_code,
      device_name: s.device_name,
      client: s.client,
      expires_at: s.expires_at,
      created_at: s.created_at,
    }));
}

function requestFingerprint(actionId, params) {
  const canonical = JSON.stringify(params || {});
  return crypto.createHash('sha256').update(actionId + '\0' + canonical).digest('hex');
}

async function findIdempotency(deviceId, key) {
  const data = readData() || {};
  return (data[HUB_IDEMPOTENCY] || []).find(
    (row) => row.device_id === deviceId && row.key === key
  ) || null;
}

async function storeIdempotency(deviceId, key, actionId, fingerprint, result) {
  return withData(async (data) => {
    purgeIdempotency(data);
    data[HUB_IDEMPOTENCY].push({
      device_id: deviceId,
      key,
      action_id: actionId,
      fingerprint,
      result,
      created_at: nowIso(),
    });
    return result;
  });
}

function getBoundUser(device) {
  const data = readData() || {};
  return (data['rt:users'] || []).find((u) => u.id === device.user_id) || null;
}

module.exports = {
  HUB_DEVICES,
  HUB_SESSIONS,
  HUB_TOKENS,
  HUB_IDEMPOTENCY,
  startPairing,
  approvePairing,
  denyPairing,
  pollPairing,
  rotateRefreshToken,
  revokeByRefreshToken,
  revokeDevice,
  touchDevice,
  getDevice,
  listDevices,
  publicDevice,
  listPendingSessions,
  requestFingerprint,
  findIdempotency,
  storeIdempotency,
  getBoundUser,
  pairingTtlSeconds,
};
