'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-test-'));
process.env.DATA_DIR = tmp;
process.env.SESSION_SECRET = 'test-session-secret-16chars';
process.env.HUB_JWT_SECRET = 'test-hub-jwt-secret-16chr';
process.env.HUB_PAIRING_NETWORK = 'private_only';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';

const seedSrc = path.join(__dirname, '..', '..', 'seed-data.json');
fs.copyFileSync(seedSrc, path.join(tmp, 'data.json'));

const { initializeAndMigrate, createApp } = require('../server');

let server;
let base;

function request(method, urlPath, { body, token, headers } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, base);
    const payload = body === undefined ? null : JSON.stringify(body);
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, json, raw: data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

before(async () => {
  await initializeAndMigrate();
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const addr = server.address();
  base = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('GET /hub/v1/hello is public and minimal', async () => {
  const res = await request('GET', '/hub/v1/hello');
  assert.equal(res.status, 200);
  assert.equal(res.json.protocol, 'hub/v1');
  assert.equal(res.json.app_id, 'robotics.inventory');
  assert.equal(res.json.auth.pairing, 'device_code');
  assert.equal(res.json.needs_pairing, true);
  assert.equal(res.json.pairing_network, 'private_only');
  assert.equal(res.json.screens, undefined);
  assert.equal(res.json.devices, undefined);
});

test('GET /hub/v1/manifest without token is 401', async () => {
  const res = await request('GET', '/hub/v1/manifest');
  assert.equal(res.status, 401);
  assert.equal(res.json.error.code, 'unauthorized');
});

test('GET /hub/v1/data/* without token is 401', async () => {
  const res = await request('GET', '/hub/v1/data/home.summary');
  assert.equal(res.status, 401);
  assert.equal(res.json.error.code, 'unauthorized');
});

test('pair/start from a public IP is rejected when private_only', async () => {
  const res = await request('POST', '/hub/v1/pair/start', {
    body: { device_name: 'Pixel', client: 'homelab-hub-android' },
    headers: { 'X-Forwarded-For': '8.8.8.8' },
  });
  assert.equal(res.status, 403);
  assert.equal(res.json.error.code, 'forbidden');
});

test('pair on loopback, approve, manifest, list, action idempotency, refresh rotation', async () => {
  const login = await request('POST', '/api/auth/login', {
    body: { name: 'Admin', password: 'admin123' },
  });
  assert.equal(login.status, 200);
  const adminToken = login.json.token;
  assert.ok(adminToken);

  const start = await request('POST', '/hub/v1/pair/start', {
    body: { device_name: 'Test Phone', client: 'homelab-hub-android', client_version: '0.1.0' },
  });
  assert.equal(start.status, 200);
  assert.equal(start.json.protocol, 'hub/v1');
  assert.match(start.json.user_code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const sessionId = start.json.pairing_session_id;
  const userCode = start.json.user_code;

  const pending = await request('POST', '/hub/v1/pair/poll', {
    body: { pairing_session_id: sessionId },
  });
  assert.equal(pending.status, 200);
  assert.equal(pending.json.status, 'pending');

  const approve = await request('POST', '/hub/v1/pair/approve', {
    body: { user_code: userCode },
    token: adminToken,
  });
  assert.equal(approve.status, 200, JSON.stringify(approve.json));
  assert.equal(approve.json.approved, true);

  const authorized = await request('POST', '/hub/v1/pair/poll', {
    body: { pairing_session_id: sessionId },
  });
  assert.equal(authorized.status, 200, JSON.stringify(authorized.json));
  assert.equal(authorized.json.status, 'authorized');
  const access = authorized.json.access_token;
  const refresh = authorized.json.refresh_token;
  assert.ok(access);
  assert.ok(refresh);
  assert.ok(authorized.json.scope.includes('read:inventory'));
  assert.ok(authorized.json.scope.includes('write:finance'));

  const manifest = await request('GET', '/hub/v1/manifest', { token: access });
  assert.equal(manifest.status, 200);
  assert.equal(manifest.json.protocol, 'hub/v1');
  assert.ok(Array.isArray(manifest.json.screens));
  assert.ok(manifest.json.screens.some((s) => s.id === 'home'));
  assert.ok(manifest.json.screens.some((s) => s.id === 'inventory'));

  const list = await request('GET', '/hub/v1/data/inventory.list', { token: access });
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.json.items));
  assert.ok(list.json.items.length > 0);
  const itemId = list.json.items[0].id;

  const key = crypto.randomUUID();
  const actionBody = {
    params: { id: itemId, change: 1, reason: 'hub test' },
    idempotency_key: key,
  };
  const first = await request('POST', '/hub/v1/actions/inventory.adjust_stock', {
    token: access,
    body: actionBody,
  });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  assert.equal(first.json.ok, true);
  assert.ok(first.json.refresh.includes('inventory.list'));

  const second = await request('POST', '/hub/v1/actions/inventory.adjust_stock', {
    token: access,
    body: actionBody,
  });
  assert.equal(second.status, 200);
  assert.deepEqual(second.json, first.json);

  const conflict = await request('POST', '/hub/v1/actions/inventory.adjust_stock', {
    token: access,
    body: { params: { id: itemId, change: 2, reason: 'other' }, idempotency_key: key },
  });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.json.error.code, 'conflict');

  const rotated = await request('POST', '/hub/v1/token', {
    body: { grant_type: 'refresh_token', refresh_token: refresh },
  });
  assert.equal(rotated.status, 200, JSON.stringify(rotated.json));
  assert.ok(rotated.json.access_token);
  assert.ok(rotated.json.refresh_token);
  assert.notEqual(rotated.json.refresh_token, refresh);

  const reuse = await request('POST', '/hub/v1/token', {
    body: { grant_type: 'refresh_token', refresh_token: refresh },
  });
  assert.equal(reuse.status, 401);
  assert.equal(reuse.json.error.code, 'unauthorized');

  const afterReuse = await request('GET', '/hub/v1/manifest', { token: rotated.json.access_token });
  assert.equal(afterReuse.status, 401);
});
