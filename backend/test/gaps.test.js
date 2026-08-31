'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gaps-test-'));
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
let token;

function request(method, urlPath, { body, token: t } = {}) {
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
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
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
  const login = await request('POST', '/api/auth/login', { body: { name: 'Admin', password: 'admin123' } });
  assert.equal(login.status, 200, JSON.stringify(login.json));
  token = login.json.token;
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('usernames directory is not public', async () => {
  const res = await request('GET', '/api/auth/usernames');
  assert.equal(res.status, 401);
});

test('location rename cascades to items and units', async () => {
  const loc = await request('POST', '/api/locations', { token, body: { name: 'CascadeShop' } });
  assert.equal(loc.status, 201);
  const item = await request('POST', '/api/items', {
    token,
    body: { name: 'Cascade Bolt', totalQty: 2, currentLocation: 'CascadeShop' },
  });
  assert.equal(item.status, 201);
  const renamed = await request('PUT', `/api/locations/${loc.json.id}`, { token, body: { name: 'CascadeShop-Renamed' } });
  assert.equal(renamed.status, 200);
  const items = await request('GET', '/api/items', { token });
  const fresh = items.json.find((i) => i.id === item.json.id);
  assert.equal(fresh.currentLocation, 'CascadeShop-Renamed');
  const units = await request('GET', `/api/items/${item.json.id}/units`, { token });
  assert.ok(units.json.every((u) => u.currentLocation === 'CascadeShop-Renamed'));
});

test('kit assemble short-stock, assemble, and break restore', async () => {
  const wheel = await request('POST', '/api/items', { token, body: { name: 'Kit Wheel', totalQty: 2 } });
  const motor = await request('POST', '/api/items', { token, body: { name: 'Kit Motor', totalQty: 1 } });
  const kit = await request('POST', '/api/items', {
    token,
    body: {
      name: 'Drive Kit',
      isKit: true,
      totalQty: 0,
      components: [
        { itemId: wheel.json.id, name: 'Kit Wheel', qty: 2 },
        { itemId: motor.json.id, name: 'Kit Motor', qty: 1 },
      ],
    },
  });
  assert.equal(kit.status, 201);
  const short = await request('POST', `/api/items/${kit.json.id}/assemble`, { token, body: { qty: 2 } });
  assert.equal(short.status, 400);
  const ok = await request('POST', `/api/items/${kit.json.id}/assemble`, { token, body: { qty: 1 } });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.totalQty, 1);
  const after = await request('GET', '/api/items', { token });
  assert.equal(after.json.find((i) => i.id === wheel.json.id).totalQty, 0);
  const br = await request('POST', `/api/items/${kit.json.id}/break`, { token, body: { qty: 1 } });
  assert.equal(br.status, 200);
  const restored = await request('GET', '/api/items', { token });
  assert.equal(restored.json.find((i) => i.id === wheel.json.id).totalQty, 2);
  assert.equal(restored.json.find((i) => i.id === kit.json.id).totalQty, 0);
});

test('direct move updates unit locations', async () => {
  const loc = await request('POST', '/api/locations', { token, body: { name: 'MoveDest' } });
  const item = await request('POST', '/api/items', {
    token,
    body: { name: 'Move Unit Item', totalQty: 3, currentLocation: 'Shop' },
  });
  const moved = await request('POST', `/api/items/${item.json.id}/move`, {
    token,
    body: { location: loc.json.name, notes: 'unit test' },
  });
  assert.equal(moved.status, 200);
  const units = await request('GET', `/api/items/${item.json.id}/units`, { token });
  assert.ok(units.json.length >= 1);
  assert.ok(units.json.every((u) => u.currentLocation === 'MoveDest'));
});

test('receive purchase with finance flag creates txn', async () => {
  const po = await request('POST', '/api/purchases', {
    token,
    body: { name: 'Finance Widget', quantity: 2, estimatedCost: 12.5, vendor: 'Acme', status: 'Needed' },
  });
  assert.equal(po.status, 201);
  const rec = await request('PATCH', `/api/purchases/${po.json.id}/status`, {
    token,
    body: { status: 'Received', createFinanceTransaction: true, receiveLocation: 'Shop' },
  });
  assert.equal(rec.status, 200, JSON.stringify(rec.json));
  assert.equal(rec.json.status, 'Received');
  const items = await request('GET', '/api/items', { token });
  const created = items.json.find((i) => i.id === rec.json.linkedItemId);
  assert.ok(created);
  assert.equal(created.totalQty, 2);
  assert.equal(created.currentLocation, 'Shop');
  const txns = await request('GET', '/api/transactions', { token });
  assert.ok(txns.json.some((t) => t.linkedPurchaseId === po.json.id && t.amount === 12.5));
});

test('delete transaction decrements goal', async () => {
  const goal = await request('POST', '/api/goals', { token, body: { name: 'Bumpers', targetAmount: 100 } });
  assert.equal(goal.status, 201);
  const funded = await request('POST', `/api/goals/${goal.json.id}/add-funds`, {
    token,
    body: { amount: 40, description: 'Sponsor' },
  });
  assert.equal(funded.json.currentAmount, 40);
  const txns = await request('GET', '/api/transactions', { token });
  const txn = txns.json.find((t) => t.linkedGoalId === goal.json.id);
  assert.ok(txn);
  const del = await request('DELETE', `/api/transactions/${txn.id}`, { token });
  assert.equal(del.status, 200);
  const goals = await request('GET', '/api/goals', { token });
  assert.equal(goals.json.find((g) => g.id === goal.json.id).currentAmount, 0);
});

test('fundraiser donation edit and delete reverse txn', async () => {
  const fr = await request('POST', '/api/fundraisers', { token, body: { name: 'Car Wash', targetAmount: 200 } });
  const don = await request('POST', `/api/fundraisers/${fr.json.id}/donations`, {
    token,
    body: { donor: 'Pat', amount: 25 },
  });
  assert.equal(don.status, 201);
  assert.ok(don.json.transactionId);
  const upd = await request('PUT', `/api/fundraisers/${fr.json.id}/donations/${don.json.id}`, {
    token,
    body: { amount: 30 },
  });
  assert.equal(upd.status, 200);
  assert.equal(upd.json.amount, 30);
  const list = await request('GET', '/api/fundraisers', { token });
  assert.equal(list.json.find((f) => f.id === fr.json.id).actualAmount, 30);
  const del = await request('DELETE', `/api/fundraisers/${fr.json.id}/donations/${don.json.id}`, { token });
  assert.equal(del.status, 200);
  const after = await request('GET', '/api/fundraisers', { token });
  assert.equal(after.json.find((f) => f.id === fr.json.id).actualAmount, 0);
});

test('borrow qty does not stomp remaining units person', async () => {
  const item = await request('POST', '/api/items', {
    token,
    body: { name: 'Multi Wrench', totalQty: 3, currentPerson: '' },
  });
  const units = await request('GET', `/api/items/${item.json.id}/units`, { token });
  const borrow = await request('POST', '/api/borrows', {
    token,
    body: { itemId: item.json.id, borrowerName: 'Lee', qty: 1, unitIds: [units.json[0].id] },
  });
  assert.equal(borrow.status, 201, JSON.stringify(borrow.json));
  const items = await request('GET', '/api/items', { token });
  const fresh = items.json.find((i) => i.id === item.json.id);
  assert.equal(fresh.currentPerson, '');
  const unitsAfter = await request('GET', `/api/items/${item.json.id}/units`, { token });
  const taken = unitsAfter.json.find((u) => u.id === units.json[0].id);
  assert.equal(taken.currentPerson, 'Lee');
});

test('bulk move relocates a location group', async () => {
  const from = await request('POST', '/api/locations', { token, body: { name: 'LoadoutFrom' } });
  const to = await request('POST', '/api/locations', { token, body: { name: 'LoadoutTo' } });
  await request('POST', '/api/items', { token, body: { name: 'Trailer Gear', totalQty: 1, currentLocation: 'LoadoutFrom' } });
  const result = await request('POST', `/api/locations/${from.json.id}/move-all`, {
    token,
    body: { toLocation: to.json.name, notes: 'Event load-out' },
  });
  assert.equal(result.status, 200, JSON.stringify(result.json));
  assert.equal(result.json.count, 1);
  const items = await request('GET', '/api/items', { token });
  const moved = items.json.find((i) => i.name === 'Trailer Gear');
  assert.equal(moved.currentLocation, 'LoadoutTo');
});

test('location merge rewrites items then deletes source', async () => {
  const a = await request('POST', '/api/locations', { token, body: { name: 'MergeA' } });
  const b = await request('POST', '/api/locations', { token, body: { name: 'MergeB' } });
  const item = await request('POST', '/api/items', {
    token,
    body: { name: 'Merge Item', totalQty: 1, currentLocation: 'MergeA' },
  });
  const merged = await request('POST', `/api/locations/${a.json.id}/merge`, {
    token,
    body: { targetId: b.json.id },
  });
  assert.equal(merged.status, 200, JSON.stringify(merged.json));
  const items = await request('GET', '/api/items', { token });
  assert.equal(items.json.find((i) => i.id === item.json.id).currentLocation, 'MergeB');
  const locs = await request('GET', '/api/locations', { token });
  assert.ok(!locs.json.some((l) => l.id === a.json.id));
});

test('stock remove with unitIds keeps the unselected unit', async () => {
  const item = await request('POST', '/api/items', { token, body: { name: 'Unit Remove Item', totalQty: 3 } });
  const units = await request('GET', `/api/items/${item.json.id}/units`, { token });
  const keep = units.json[1].id;
  const drop = [units.json[0].id, units.json[2].id];
  const res = await request('POST', `/api/items/${item.json.id}/stock`, {
    token,
    body: { change: -2, reason: 'scrap', unitIds: drop },
  });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  const after = await request('GET', `/api/items/${item.json.id}/units`, { token });
  assert.equal(after.json.length, 1);
  assert.equal(after.json[0].id, keep);
});

test('high-priority purchase from member requires approval', async () => {
  const login = await request('POST', '/api/auth/login', {
    body: { name: 'Jordan Member', password: 'changeme1' },
  });
  assert.equal(login.status, 200);
  const memberToken = login.json.token;
  const po = await request('POST', '/api/purchases', {
    token: memberToken,
    body: { name: 'High Priority Radio', quantity: 1, priority: 'High', status: 'Needed' },
  });
  assert.equal(po.status, 201, JSON.stringify(po.json));
  assert.equal(po.json.status, 'PendingApproval');
  const pending = await request('GET', '/api/approvals/pending', { token });
  assert.ok((pending.json.purchases || []).some((p) => p.id === po.json.id));
  const approved = await request('POST', `/api/purchases/${po.json.id}/approve`, { token });
  assert.equal(approved.status, 200, JSON.stringify(approved.json));
  assert.equal(approved.json.status, 'Needed');
});

test('nested kits are rejected on assemble', async () => {
  const inner = await request('POST', '/api/items', {
    token,
    body: { name: 'Inner Kit', isKit: true, totalQty: 1, components: [] },
  });
  const outer = await request('POST', '/api/items', {
    token,
    body: {
      name: 'Outer Kit',
      isKit: true,
      totalQty: 0,
      components: [{ itemId: inner.json.id, name: 'Inner Kit', qty: 1 }],
    },
  });
  const res = await request('POST', `/api/items/${outer.json.id}/assemble`, { token, body: { qty: 1 } });
  assert.equal(res.status, 400);
});

test('password change increments token version', async () => {
  const created = await request('POST', '/api/users', {
    token,
    body: {
      name: 'Pass Changer',
      password: 'oldpass1',
      role: 'Member',
      mustChangePassword: false,
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));
  const login = await request('POST', '/api/auth/login', {
    body: { name: 'Pass Changer', password: 'oldpass1' },
  });
  assert.equal(login.status, 200);
  const userToken = login.json.token;
  const changed = await request('POST', '/api/auth/password', {
    token: userToken,
    body: { password: 'newpass1', currentPassword: 'oldpass1' },
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.json));
  const old = await request('GET', '/api/items', { token: userToken });
  assert.equal(old.status, 401);
  const ok = await request('GET', '/api/items', { token: changed.json.token });
  assert.equal(ok.status, 200);
  const adminStill = await request('GET', '/api/items', { token });
  assert.equal(adminStill.status, 200);
});
