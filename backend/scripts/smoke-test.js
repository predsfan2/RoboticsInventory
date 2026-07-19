#!/usr/bin/env node
'use strict';

/**
 * Smoke tests: migration, auth helpers, kit contents API, role permissions.
 * Uses a temporary DATA_DIR so existing data is never touched.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const { migrateData } = require('../utils/migration');
const { hasPermission } = require('../utils/auth');

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('OK  ', msg);
  }
}

// ── Unit-ish: migration kit components ───────────────────────────────────────
function testMigrationKits() {
  const data = migrateData({
    'rt:users': [{ id: 'u1', name: 'Admin', role: 'Admin', password: 'admin123' }],
    'rt:items': [
      {
        id: 'kit1', name: 'Tool Kit', isKit: true, currentLocation: 'Trailer', condition: 'Good',
        totalQty: 1,
        components: [
          { itemId: 'motor1', quantity: 3 },
          { id: 'already', itemId: 'bat1', condition: 'New', currentLocation: 'BHSE', notes: '', addedAt: '2020-01-01T00:00:00.000Z' },
        ],
      },
      { id: 'motor1', name: 'Motor', totalQty: 5, condition: 'Good' },
      { id: 'bat1', name: 'Battery', totalQty: 2, condition: 'New' },
    ],
  });

  const kit = data['rt:items'].find((i) => i.id === 'kit1');
  assert(kit.components.length === 4, 'legacy quantity:3 expands + keeps 1 canonical = 4 pieces');
  const motors = kit.components.filter((c) => c.itemId === 'motor1');
  assert(motors.length === 3, 'three motor instances');
  assert(motors.every((c) => c.currentLocation === 'Trailer'), 'expanded pieces default to kit location');
  assert(motors.every((c) => c.id && c.condition), 'expanded pieces have id + condition');
  const bat = kit.components.find((c) => c.id === 'already');
  assert(bat && bat.currentLocation === 'BHSE', 'canonical piece location preserved');

  const member = data['rt:users'].find((u) => u.name === 'Admin');
  // Admin from migrate with permissions set
  const m = migrateData({
    'rt:users': [{ id: 'm1', name: 'Mem', role: 'Member', password: 'x', permissions: ['inventory.view', 'purchases.edit'] }],
  });
  const mem = m['rt:users'][0];
  assert(mem.permissions.includes('finance.reimburse'), 'migration adds finance.reimburse to Member');
}

function testAuthHelpers() {
  const acct = { id: 'a', role: 'Accounting Admin', permissions: ['finance.view', 'finance.edit'] };
  assert(hasPermission(acct, 'finance.edit'), 'Accounting Admin has finance.edit');
  assert(!hasPermission(acct, 'admin.users'), 'Accounting Admin lacks admin.users');

  const member = { id: 'm', role: 'Member' }; // no permissions array → role defaults
  assert(hasPermission(member, 'finance.reimburse'), 'Member default includes finance.reimburse');
  assert(!hasPermission(member, 'finance.view'), 'Member default lacks finance.view');

  const admin = { id: 'ad', role: 'Admin' };
  assert(hasPermission(admin, 'anything.fake'), 'Admin bypasses permission checks');
}

function request(port, method, urlPath, body, userId) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch { json = raw; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function testHttp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-smoke-'));
  const seed = {
    'rt:users': [
      { id: 'u-admin', name: 'Admin', password: 'admin123', role: 'Admin', permissions: [] },
      {
        id: 'u-acct', name: 'Acct', password: 'acct123', role: 'Accounting Admin',
        permissions: ['inventory.view', 'purchases.view', 'finance.view', 'finance.edit', 'finance.reimburse', 'audit.view'],
      },
      {
        id: 'u-mem', name: 'Member', password: 'mem123', role: 'Member',
        permissions: ['inventory.view', 'moves.request', 'purchases.view', 'purchases.edit', 'borrows.view', 'borrows.manage', 'finance.reimburse'],
      },
    ],
    'rt:locs': [{ id: 'l1', name: 'Trailer' }, { id: 'l2', name: 'BHSE' }],
    'rt:items': [
      { id: 'motor1', name: 'CIM Motor', totalQty: 10, condition: 'Good', currentLocation: 'Trailer', category: 'Drive Train', isKit: false, components: [], customFields: {}, conditionLog: [], locationLog: [], invoices: [], comments: [], quantityLog: [], minStock: 0, createdAt: new Date().toISOString() },
      { id: 'kit1', name: 'Drive Kit', totalQty: 1, condition: 'Good', currentLocation: 'Trailer', category: 'Drive Train', isKit: true, components: [], customFields: {}, conditionLog: [], locationLog: [], invoices: [], comments: [], quantityLog: [], minStock: 0, createdAt: new Date().toISOString() },
    ],
    'rt:units': [],
    'rt:purchases': [],
    'rt:borrows': [],
    'rt:moveRequests': [],
    'rt:auditLog': [],
    'rt:activityLog': [],
    'rt:customFields': [],
    'rt:accountingTransactions': [],
    'rt:budgets': [],
    'rt:savingsGoals': [],
    'rt:reimbursements': [],
    'rt:fundraisers': [],
  };
  fs.writeFileSync(path.join(tmp, 'data.json'), JSON.stringify(seed, null, 2));

  const port = 3099;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, DATA_DIR: tmp, PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let ready = false;
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server start timeout')), 15000);
    child.stdout.on('data', (buf) => {
      if (String(buf).includes('running on')) {
        ready = true;
        clearTimeout(t);
        resolve();
      }
    });
    child.stderr.on('data', (buf) => process.stderr.write(buf));
    child.on('exit', (code) => {
      if (!ready) { clearTimeout(t); reject(new Error('server exited ' + code)); }
    });
  });

  try {
    const login = await request(port, 'POST', '/api/auth/login', { name: 'Admin', password: 'admin123' });
    assert(login.status === 200 && login.body.user?.id === 'u-admin', 'Admin login admin123');

    const add = await request(port, 'POST', '/api/items/kit1/components', {
      itemId: 'motor1', quantity: 3, condition: 'Good',
    }, 'u-admin');
    assert(add.status === 201 && add.body.length === 3, 'add 3 motors to kit');
    assert(add.body.every((p) => p.currentLocation === 'Trailer'), 'pieces default to kit location');

    const pieceId = add.body[0].id;
    const upd = await request(port, 'PUT', `/api/items/kit1/components/${pieceId}`, {
      condition: 'Poor', currentLocation: 'BHSE',
    }, 'u-admin');
    assert(upd.status === 200 && upd.body.condition === 'Poor' && upd.body.currentLocation === 'BHSE', 'per-piece condition/location update');

    const list = await request(port, 'GET', '/api/items/kit1/components', null, 'u-admin');
    assert(list.status === 200 && list.body.length === 3, 'list kit contents');
    const poor = list.body.filter((p) => p.condition === 'Poor');
    assert(poor.length === 1 && poor[0].currentLocation === 'BHSE', 'one Poor @ BHSE');

    const del = await request(port, 'DELETE', `/api/items/kit1/components/${pieceId}`, null, 'u-admin');
    assert(del.status === 200, 'remove kit piece');

    const tx = await request(port, 'POST', '/api/transactions', {
      type: 'Donation', description: 'Test', amount: 10, category: 'Misc',
    }, 'u-acct');
    assert(tx.status === 201, 'Accounting Admin can create transaction');

    const reimb = await request(port, 'POST', '/api/reimbursements', {
      amount: 5, reason: 'Bolts',
    }, 'u-mem');
    assert(reimb.status === 201, 'Member can submit reimbursement');

    const purchase = await request(port, 'POST', '/api/purchases', {
      name: 'Screws', quantity: 1, priority: 'Low',
    }, 'u-mem');
    assert(purchase.status === 201, 'Member can create purchase request');

    const rejectKit = await request(port, 'POST', '/api/items/kit1/components', {
      itemId: 'kit1', quantity: 1,
    }, 'u-admin');
    assert(rejectKit.status === 400, 'cannot add kit into itself');
  } finally {
    child.kill('SIGTERM');
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  }
}

(async () => {
  console.log('=== Migration / auth ===');
  testMigrationKits();
  testAuthHelpers();
  console.log('=== HTTP smoke ===');
  await testHttp();
  if (failed) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log('\nAll smoke tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
