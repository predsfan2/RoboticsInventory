/**
 * migration.js — idempotent flat-file DB migration.
 * Accepts a file path (reads/writes JSON) or a plain object (in-memory).
 */
'use strict';

const fs = require('fs');
const { ROLE_DEFAULT_PERMISSIONS, migrateFinancePermissions } = require('./permissions');
const { hashPassword, isHashedPassword } = require('./auth');

const TABLE_DEFAULTS = [
  'rt:users', 'rt:locs', 'rt:items', 'rt:units',
  'rt:purchases', 'rt:borrows', 'rt:moveRequests', 'rt:auditLog',
  'rt:customFields', 'rt:accountingTransactions', 'rt:budgets',
  'rt:savingsGoals', 'rt:reimbursements', 'rt:fundraisers', 'rt:activityLog',
  'hub:devices', 'hub:pairingSessions', 'hub:refreshTokens', 'hub:idempotency',
];

const MAX_UNITS_PER_ITEM = 500;

function migrateData(data) {
  if (!data || typeof data !== 'object') data = {};

  // Drop abandoned tables
  if (data['rt:kits'] !== undefined) {
    delete data['rt:kits'];
    console.log('[migration] Removed abandoned table: rt:kits');
  }

  TABLE_DEFAULTS.forEach(function (key) {
    if (data[key] === undefined) {
      data[key] = [];
      console.log('[migration] Added missing table: ' + key);
    }
  });

  data['rt:users'] = data['rt:users'].map(function (u) {
    if (!u.role) {
      if (u.isAdmin === true) u.role = 'Admin';
      else if (u.isManager === true) u.role = 'Manager';
      else u.role = 'Member';
    }
    delete u.isAdmin;
    delete u.isManager;

    if (!u.password) {
      u.password = u.pin ? String(u.pin) : 'changeme';
    }
    delete u.pin;

    if (!isHashedPassword(u.password)) {
      u.password = hashPassword(u.password);
      console.log('[migration] Hashed password for user: ' + u.name);
    }

    if (!Array.isArray(u.permissions)) {
      u.permissions = (ROLE_DEFAULT_PERMISSIONS[u.role] || ROLE_DEFAULT_PERMISSIONS.Member).slice();
      console.log('[migration] Set default permissions for user: ' + u.name);
    } else {
      const before = u.permissions.slice();
      u.permissions = migrateFinancePermissions(u.permissions);
      if (u.permissions.length !== before.length || u.permissions.some((p, i) => p !== before[i])) {
        console.log('[migration] Expanded legacy finance permissions for user: ' + u.name);
      }
    }
    return u;
  });

  var existingUnitParentIds = new Set(
    (data['rt:units'] || []).map(function (u) { return u.parentId; })
  );

  data['rt:items'] = data['rt:items'].map(function (item) {
    if (!Array.isArray(item.conditionLog)) item.conditionLog = [];
    if (!Array.isArray(item.locationLog)) item.locationLog = [];
    if (!Array.isArray(item.invoices)) item.invoices = [];
    if (!Array.isArray(item.comments)) item.comments = [];
    if (!Array.isArray(item.quantityLog)) item.quantityLog = [];
    if (!Array.isArray(item.components)) item.components = [];
    if (typeof item.customFields !== 'object' || Array.isArray(item.customFields)) {
      item.customFields = {};
    }
    if (item.minStock == null) item.minStock = 0;
    if (item.isKit == null) item.isKit = false;
    if (!item.imageUrl) item.imageUrl = '';
    if (!item.createdAt) item.createdAt = new Date().toISOString();
    if (!item.condition) item.condition = 'Good';

    var qty = parseInt(item.totalQty, 10) || 1;
    if (qty > MAX_UNITS_PER_ITEM) {
      console.log('[migration] Capping units for ' + item.name + ' from ' + qty + ' to ' + MAX_UNITS_PER_ITEM);
      qty = MAX_UNITS_PER_ITEM;
      item.totalQty = MAX_UNITS_PER_ITEM;
    }
    if (qty > 1 && !existingUnitParentIds.has(item.id)) {
      for (var i = 1; i <= qty; i++) {
        data['rt:units'].push({
          id: item.id + '-unit-' + i,
          parentId: item.id,
          unitSku: item.id + '-' + i,
          condition: item.condition,
          conditionLog: [],
          currentLocation: item.currentLocation || '',
          currentPerson: item.currentPerson || '',
        });
      }
      existingUnitParentIds.add(item.id);
      console.log('[migration] Generated ' + qty + ' units for item: ' + item.name);
    }
    return item;
  });

  data['rt:purchases'] = data['rt:purchases'].map(function (p) {
    if (p.quantity == null && p.qty != null) {
      p.quantity = p.qty;
      delete p.qty;
    }
    if (!p.requester && p.requestedBy) {
      p.requester = p.requestedBy;
      delete p.requestedBy;
    }
    if (p.quantity == null) p.quantity = 1;
    if (!p.priority) p.priority = 'Medium';
    if (!p.status) p.status = 'Needed';
    if (!p.category) p.category = '';
    if (!p.link) p.link = '';
    if (!p.notes) p.notes = '';
    if (!p.requester) p.requester = '';
    if (!p.date) p.date = new Date().toISOString();
    return p;
  });

  data['rt:borrows'] = data['rt:borrows'].map(function (b) {
    if (!b.status) b.status = 'active';
    if (!b.contact) b.contact = '';
    if (!b.notes) b.notes = '';
    if (!b.createdAt) b.createdAt = new Date().toISOString();
    if (b.returnedAt === undefined) b.returnedAt = null;
    return b;
  });

  data['rt:accountingTransactions'] = data['rt:accountingTransactions'].map(function (t) {
    if (!t.type) t.type = 'Purchase';
    if (!t.description) t.description = '';
    if (!t.category) t.category = '';
    if (!t.receiptUrl) t.receiptUrl = '';
    if (t.amount === undefined) t.amount = 0;
    return t;
  });

  data['rt:reimbursements'] = data['rt:reimbursements'].map(function (r) {
    if (!r.status) r.status = 'pending';
    if (!r.reason) r.reason = '';
    if (!r.receiptUrl) r.receiptUrl = '';
    if (!r.userName) r.userName = '';
    if (r.approvedBy === undefined) r.approvedBy = null;
    if (r.approvedAt === undefined) r.approvedAt = null;
    if (r.denialReason === undefined) r.denialReason = null;
    if (!r.createdAt) r.createdAt = new Date().toISOString();
    return r;
  });

  data['rt:fundraisers'] = data['rt:fundraisers'].map(function (f) {
    if (!Array.isArray(f.donations)) f.donations = [];
    if (f.targetAmount === undefined) f.targetAmount = 0;
    if (f.actualAmount === undefined) f.actualAmount = 0;
    return f;
  });

  return data;
}

function migrateFile(filePath) {
  var raw = fs.readFileSync(filePath, 'utf8');
  var data = JSON.parse(raw);
  var migrated = migrateData(data);

  var tmp = filePath + '.tmp';
  var bak = filePath + '.bak';
  var json = JSON.stringify(migrated, null, 2) + '\n';

  if (json === raw) {
    console.log('[migration] No changes for ' + filePath);
    return migrated;
  }

  fs.writeFileSync(tmp, json, 'utf8');
  try { fs.copyFileSync(filePath, bak); } catch (_) {}
  fs.renameSync(tmp, filePath);
  console.log('[migration] Wrote migrated data to ' + filePath);
  return migrated;
}

function migrate(input) {
  if (typeof input === 'string') return migrateFile(input);
  return migrateData(input);
}

module.exports = { migrate, migrateData, migrateFile };
