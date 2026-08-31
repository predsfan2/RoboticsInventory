'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { hasPermission } = require('../utils/permissions');
const { APP_ID, APP_NAME, APP_VERSION, pairingNetwork, publicBaseUrl } = require('./config');
const { sendError, fromDomain } = require('./errors');
const { isPrivateClient } = require('./network');
const { verifyAccessToken } = require('./crypto');
const { hasScope, scopeForDataKey, scopeForAction, scopesForUser } = require('./scopes');
const { buildManifest } = require('./manifest');
const { getData } = require('./data');
const { runAction } = require('./actions');
const store = require('./store');

function hubError(res, err) {
  if (err && err.status && err.code) {
    return sendError(res, err.status, err.code, err.message);
  }
  return fromDomain(res, err);
}

function hubLimiter(max) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'rate_limited', message: 'Too many requests. Try again later.' } },
  });
}

function requireJson(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const ct = String(req.headers['content-type'] || '');
  if (!ct.includes('application/json')) {
    return sendError(res, 400, 'invalid_request', 'Content-Type must be application/json');
  }
  next();
}

function limitHubBody(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  try {
    const size = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8');
    if (size > 64 * 1024) {
      return sendError(res, 400, 'invalid_request', 'Request body too large');
    }
  } catch (_err) {
    return sendError(res, 400, 'invalid_request', 'Invalid JSON body');
  }
  next();
}

function requireHubBearer(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return sendError(res, 401, 'unauthorized', 'Access token required');
  }
  const token = header.slice(7).trim();
  if (!token) return sendError(res, 401, 'unauthorized', 'Access token required');
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (_err) {
    return sendError(res, 401, 'unauthorized', 'Access token expired or invalid');
  }
  const device = store.getDevice(payload.sub);
  if (!device || device.revoked) {
    return sendError(res, 401, 'unauthorized', 'Device revoked');
  }
  req.hubDevice = device;
  req.hubScopes = Array.isArray(payload.scope) ? payload.scope : (device.scopes || []);
  req.hubUser = store.getBoundUser(device);
  next();
}

function requireAdminUser(req, res, next) {
  if (!req.user) return sendError(res, 401, 'unauthorized', 'Admin sign-in required');
  if (!hasPermission(req.user, 'admin.users')) {
    return sendError(res, 403, 'forbidden', 'Admin permission required');
  }
  next();
}

function createRouter() {
  const router = express.Router();
  const pairLimit = hubLimiter(20);
  const tokenLimit = hubLimiter(40);
  const actionLimit = hubLimiter(80);

  router.use(limitHubBody);

  router.get('/hello', (_req, res) => {
    res.json({
      protocol: 'hub/v1',
      app_id: APP_ID,
      name: APP_NAME,
      version: APP_VERSION,
      auth: {
        pairing: 'device_code',
        token_endpoint: '/hub/v1/token',
      },
      needs_pairing: true,
      pairing_network: pairingNetwork(),
    });
  });

  router.post('/pair/start', pairLimit, requireJson, async (req, res) => {
    try {
      if (pairingNetwork() === 'private_only' && !isPrivateClient(req)) {
        return sendError(res, 403, 'forbidden', 'Pairing is only allowed from a private network');
      }
      const body = req.body || {};
      const session = await store.startPairing({
        deviceName: body.device_name,
        client: body.client,
        clientVersion: body.client_version,
      });
      res.json({
        protocol: 'hub/v1',
        pairing_session_id: session.id,
        user_code: session.user_code,
        expires_in: store.pairingTtlSeconds(),
        interval: 5,
        verification_uri: publicBaseUrl(req) + '/hub/pair',
      });
    } catch (err) {
      return hubError(res, err);
    }
  });

  router.post('/pair/poll', pairLimit, requireJson, async (req, res) => {
    try {
      const id = req.body && req.body.pairing_session_id;
      if (!id) return sendError(res, 400, 'invalid_request', 'pairing_session_id is required');
      const result = await store.pollPairing(id);
      if (result.status === 'pending') {
        return res.json({ protocol: 'hub/v1', status: 'pending' });
      }
      return res.json({
        protocol: 'hub/v1',
        status: 'authorized',
        device_id: result.device_id,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        token_type: result.token_type,
        expires_in: result.expires_in,
        scope: result.scope,
      });
    } catch (err) {
      return hubError(res, err);
    }
  });

  router.get('/admin/pairing', requireAdminUser, (_req, res) => {
    res.json({
      protocol: 'hub/v1',
      pairing: store.listPendingSessions(),
    });
  });

  router.post('/pair/approve', requireJson, requireAdminUser, async (req, res) => {
    try {
      const userCode = req.body && req.body.user_code;
      if (!userCode) return sendError(res, 400, 'invalid_request', 'user_code is required');
      let bound = req.user;
      if (req.body.user_id) {
        const { readData } = require('../utils/storage');
        bound = (readData()['rt:users'] || []).find((u) => u.id === req.body.user_id);
        if (!bound) return sendError(res, 400, 'invalid_request', 'user_id not found');
      }
      const allowed = scopesForUser(bound);
      const requested = Array.isArray(req.body.scopes) ? req.body.scopes : null;
      const scopes = requested && requested.length
        ? requested.filter((s) => allowed.includes(s))
        : allowed;
      const result = await store.approvePairing({ userCode, user: bound, scopes });
      res.json({
        protocol: 'hub/v1',
        approved: true,
        device_id: result.device.id,
        user_code: result.session.user_code,
        scope: result.device.scopes,
      });
    } catch (err) {
      return hubError(res, err);
    }
  });

  router.post('/pair/deny', requireJson, requireAdminUser, async (req, res) => {
    try {
      const userCode = req.body && req.body.user_code;
      if (!userCode) return sendError(res, 400, 'invalid_request', 'user_code is required');
      await store.denyPairing(userCode);
      res.json({ protocol: 'hub/v1', denied: true });
    } catch (err) {
      return hubError(res, err);
    }
  });

  router.post('/token', tokenLimit, requireJson, async (req, res) => {
    try {
      const body = req.body || {};
      if (body.grant_type !== 'refresh_token') {
        return sendError(res, 400, 'invalid_request', 'grant_type must be refresh_token');
      }
      if (!body.refresh_token) {
        return sendError(res, 400, 'invalid_request', 'refresh_token is required');
      }
      const tokens = await store.rotateRefreshToken(body.refresh_token);
      res.json({
        protocol: 'hub/v1',
        device_id: tokens.device_id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
      });
    } catch (err) {
      return hubError(res, err);
    }
  });

  router.post('/revoke', tokenLimit, async (req, res) => {
    try {
      const body = req.body || {};
      if (body.token || body.refresh_token) {
        await store.revokeByRefreshToken(body.token || body.refresh_token);
        return res.json({ protocol: 'hub/v1', revoked: true });
      }
      const header = req.headers.authorization || '';
      if (header.startsWith('Bearer ')) {
        try {
          const payload = verifyAccessToken(header.slice(7).trim());
          await store.revokeDevice(payload.sub);
        } catch (_err) {
          // Already invalid — still succeed
        }
        return res.json({ protocol: 'hub/v1', revoked: true });
      }
      return sendError(res, 400, 'invalid_request', 'token or Bearer access token required');
    } catch (err) {
      return hubError(res, err);
    }
  });

  router.get('/devices', requireHubBearer, (req, res) => {
    if (hasScope(req.hubScopes, 'admin:devices')) {
      return res.json({ protocol: 'hub/v1', devices: store.listDevices() });
    }
    return res.json({
      protocol: 'hub/v1',
      devices: [store.publicDevice(req.hubDevice)],
    });
  });

  router.get('/admin/devices', requireAdminUser, (_req, res) => {
    res.json({ protocol: 'hub/v1', devices: store.listDevices() });
  });

  router.post('/admin/devices/:id/revoke', requireAdminUser, async (req, res) => {
    try {
      await store.revokeDevice(req.params.id);
      res.json({ protocol: 'hub/v1', revoked: true });
    } catch (err) {
      return hubError(res, err);
    }
  });

  router.get('/manifest', requireHubBearer, (req, res) => {
    res.json(buildManifest(req.hubScopes));
  });

  router.get('/data/:key', requireHubBearer, (req, res) => {
    try {
      const key = req.params.key;
      const needed = scopeForDataKey(key);
      if (needed === undefined) {
        return sendError(res, 404, 'not_found', 'Unknown data key');
      }
      if (needed && !hasScope(req.hubScopes, needed)) {
        return sendError(res, 403, 'insufficient_scope', 'Missing scope for this data');
      }
      if (key === 'home.summary' && !(req.hubScopes || []).some((s) => String(s).startsWith('read:'))) {
        return sendError(res, 403, 'insufficient_scope', 'Missing scope for this data');
      }
      const payload = getData(key, req.query, req.hubScopes);
      res.json(payload);
    } catch (err) {
      return hubError(res, err);
    }
  });

  router.post('/actions/:action_id', actionLimit, requireJson, requireHubBearer, async (req, res) => {
    try {
      const actionId = req.params.action_id;
      const needed = scopeForAction(actionId);
      if (!needed) return sendError(res, 404, 'not_found', 'Unknown action');
      if (!hasScope(req.hubScopes, needed)) {
        return sendError(res, 403, 'insufficient_scope', 'Missing scope for this action');
      }
      const body = req.body || {};
      const idempotencyKey = body.idempotency_key;
      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        return sendError(res, 400, 'invalid_request', 'idempotency_key is required');
      }
      const params = body.params || {};
      const fingerprint = store.requestFingerprint(actionId, params);
      const existing = await store.findIdempotency(req.hubDevice.id, idempotencyKey);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          return sendError(res, 409, 'conflict', 'idempotency_key reused with a different request');
        }
        return res.json(existing.result);
      }
      if (!req.hubUser) {
        return sendError(res, 401, 'unauthorized', 'Device is not bound to a user');
      }
      const result = await runAction(actionId, params, req.hubUser);
      await store.storeIdempotency(req.hubDevice.id, idempotencyKey, actionId, fingerprint, result);
      res.json(result);
    } catch (err) {
      return hubError(res, err);
    }
  });

  return router;
}

module.exports = { createRouter };
