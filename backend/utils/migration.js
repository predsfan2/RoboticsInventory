/**
 * migration.js — idempotent flat-file DB migration.
 * Accepts a file path (reads/writes JSON) or a plain object (in-memory).
 */
'use strict';

const fs   = require('fs');
const path = require('path');

var ROLE_DEFAULT_PERMISSIONS = {
  Admin: [
    'inventory.view','inventory.edit','inventory.delete',
    'moves.request','moves.approve',
    'purchases.view','purchases.edit',
    'borrows.view','borrows.manage',
    'finance.view','finance.edit',
    'approvals.manage','audit.view',
    'admin.users','admin.locations',
  ],
  Manager: [
    'inventory.view','inventory.edit',
    'moves.request','moves.approve',
    'purchases.view','purchases.edit',
    'borrows.view','borrows.manage',
    'finance.view','finance.edit',
    'approvals.manage','audit.view',
  ],
  'Accounting Admin': [
    'inventory.view',
    'purchases.view',
    'finance.view','finance.edit',
    'audit.view',
  ],
  Member: [
    'inventory.view',
    'moves.request',
    'purchases.view','purchases.edit',
    'borrows.view','borrows.manage',
  ],
  Viewer: [
    'inventory.view',
    'purchases.view',
    'borrows.view',
  ],
};

var TABLE_DEFAULTS = [
  'rt:users','rt:locs','rt:items','rt:units',
  'rt:purchases','rt:borrows','rt:moveRequests','rt:auditLog',
  'rt:customFields','rt:accountingTransactions','rt:budgets',
  'rt:savingsGoals','rt:reimbursements','rt:fundraisers','rt:activityLog',
];

function migrateData(data) {
  if (!data || typeof data !== 'object') data = {};

  // 1. Ensure all tables exist
  TABLE_DEFAULTS.forEach(function(key) {
    if (data[key] === undefined) {
      data[key] = [];
      console.log('[migration] Added missing table: ' + key);
    }
  });

  // 2. Normalise users
  data['rt:users'] = data['rt:users'].map(function(u) {
    if (!u.role) {
      if (u.isAdmin === true)   u.role = 'Admin';
      else if (u.isManager === true) u.role = 'Manager';
      else u.role = 'Member';
    }
    delete u.isAdmin;
    delete u.isManager;
    if (!u.password) {
      u.password = u.pin ? String(u.pin) : 'changeme';
    }
    delete u.pin;
    if (!Array.isArray(u.permissions)) {
      u.permissions = (ROLE_DEFAULT_PERMISSIONS[u.role] || ROLE_DEFAULT_PERMISSIONS['Member']).slice();
      console.log('[migration] Set default permissions for user: ' + u.name);
    }
    return u;
  });

  // 3. Normalise items + generate units
  var existingUnitParentIds = new Set(
    (data['rt:units'] || []).map(function(u) { return u.parentId; })
  );

  data['rt:items'] = data['rt:items'].map(function(item) {
    if (!Array.isArray(item.conditionLog))  item.conditionLog  = [];
    if (!Array.isArray(item.locationLog))   item.locationLog   = [];
    if (!Array.isArray(item.invoices))      item.invoices      = [];
    if (!Array.isArray(item.comments))      item.comments      = [];
    if (!Array.isArray(item.quantityLog))   item.quantityLog   = [];
    if (!Array.isArray(item.components))    item.components    = [];
    if (typeof item.customFields !== 'object' || Array.isArray(item.customFields)) {
      item.customFields = {};
    }
    if (item.minStock  == null) item.minStock  = 0;
    if (item.isKit     == null) item.isKit     = false;
    if (!item.imageUrl)         item.imageUrl  = '';
    if (!item.createdAt)        item.createdAt = new Date().toISOString();
    if (!item.condition)        item.condition = 'Good';

    var qty = parseInt(item.totalQty, 10) || 1;
    if (qty > 1 && !existingUnitParentIds.has(item.id)) {
      for (var i = 1; i <= qty; i++) {
        data['rt:units'].push({
          id:              item.id + '-unit-' + i,
          parentId:        item.id,
          unitSku:         item.id + '-' + i,
          condition:       item.condition,
          conditionLog:    [],
          currentLocation: item.currentLocation || '',
          currentPerson:   item.currentPerson   || '',
        });
      }
      existingUnitParentIds.add(item.id);
      console.log('[migration] Generated ' + qty + ' units for item: ' + item.name);
    }
    return item;
  });

  // 4. Normalise purchases
  data['rt:purchases'] = data['rt:purchases'].map(function(p) {
    if (!p.priority)  p.priority  = 'Medium';
    if (!p.status)    p.status    = 'Needed';
    if (!p.category)  p.category  = '';
    if (!p.link)      p.link      = '';
    if (!p.notes)     p.notes     = '';
    if (!p.requester) p.requester = '';
    if (!p.date)      p.date      = new Date().toISOString();
    return p;
  });

  // 5. Normalise borrows
  data['rt:borrows'] = data['rt:borrows'].map(function(b) {
    if (!b.status)    b.status    = 'active';
    if (!b.contact)   b.contact   = '';
    if (!b.notes)     b.notes     = '';
    if (!b.createdAt) b.createdAt = new Date().toISOString();
    if (b.returnedAt === undefined) b.returnedAt = null;
    return b;
  });

  // 6. Normalise accounting transactions
  data['rt:accountingTransactions'] = data['rt:accountingTransactions'].map(function(t) {
    if (!t.type)        t.type        = 'Purchase';
    if (!t.description) t.description = '';
    if (!t.category)    t.category    = '';
    if (!t.receiptUrl)  t.receiptUrl  = '';
    if (t.amount === undefined) t.amount = 0;
    return t;
  });

  // 7. Normalise reimbursements
  data['rt:reimbursements'] = data['rt:reimbursements'].map(function(r) {
    if (!r.status)     r.status     = 'pending';
    if (!r.reason)     r.reason     = '';
    if (!r.receiptUrl) r.receiptUrl = '';
    if (!r.userName)   r.userName   = '';
    if (r.approvedBy   === undefined) r.approvedBy   = null;
    if (r.approvedAt   === undefined) r.approvedAt   = null;
    if (r.denialReason === undefined) r.denialReason = null;
    if (!r.createdAt)  r.createdAt  = new Date().toISOString();
    return r;
  });

  // 8. Normalise fundraisers
  data['rt:fundraisers'] = data['rt:fundraisers'].map(function(f) {
    if (!Array.isArray(f.donations)) f.donations = [];
    if (f.targetAmount === undefined) f.targetAmount = 0;
    if (f.actualAmount === undefined) f.actualAmount = 0;
    return f;
  });

  return data;
}

function migrateFile(filePath) {
  var raw  = fs.readFileSync(filePath, 'utf8');
  var data = JSON.parse(raw);
  var migrated = migrateData(data);

  var tmp  = filePath + '.tmp';
  var bak  = filePath + '.bak';
  var json = JSON.stringify(migrated, null, 2) + '\n';

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
