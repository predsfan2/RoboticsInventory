'use strict';

const { hasPermission } = require('../utils/permissions');

const ALL_SCOPES = [
  'read:inventory',
  'write:inventory',
  'read:purchases',
  'write:purchases',
  'read:borrows',
  'write:borrows',
  'read:approvals',
  'write:approvals',
  'read:finance',
  'write:finance',
  'admin:devices',
];

const PERMISSION_SCOPES = [
  { permission: 'inventory.view', scopes: ['read:inventory'] },
  { permission: 'inventory.edit', scopes: ['write:inventory'] },
  { permission: 'purchases.view', scopes: ['read:purchases'] },
  { permission: 'purchases.edit', scopes: ['write:purchases'] },
  { permission: 'borrows.view', scopes: ['read:borrows'] },
  { permission: 'borrows.manage', scopes: ['write:borrows'] },
  { permission: 'approvals.manage', scopes: ['read:approvals', 'write:approvals'] },
  { permission: 'finance.transactions.view', scopes: ['read:finance'] },
  { permission: 'finance.transactions.edit', scopes: ['write:finance'] },
  { permission: 'admin.users', scopes: ['admin:devices'] },
];

function scopesForUser(user) {
  if (!user) return [];
  if (user.role === 'Admin') return ALL_SCOPES.slice();
  const set = new Set();
  for (const row of PERMISSION_SCOPES) {
    if (hasPermission(user, row.permission)) {
      row.scopes.forEach((s) => set.add(s));
    }
  }
  if (set.has('write:inventory')) set.add('read:inventory');
  if (set.has('write:purchases')) set.add('read:purchases');
  if (set.has('write:borrows')) set.add('read:borrows');
  if (set.has('write:approvals')) set.add('read:approvals');
  if (set.has('write:finance')) set.add('read:finance');
  return ALL_SCOPES.filter((s) => set.has(s));
}

function hasScope(granted, needed) {
  const set = new Set(granted || []);
  if (Array.isArray(needed)) return needed.some((s) => set.has(s));
  return set.has(needed);
}

const DATA_KEY_SCOPES = {
  'home.summary': null, // any granted read scope; filtered per-stat
  'home.approvals': 'read:approvals',
  'inventory.list': 'read:inventory',
  'inventory.item': 'read:inventory',
  'purchases.list': 'read:purchases',
  'borrows.list': 'read:borrows',
  'approvals.pending': 'read:approvals',
  'finance.summary': 'read:finance',
  'finance.transactions': 'read:finance',
};

const ACTION_SCOPES = {
  'inventory.adjust_stock': 'write:inventory',
  'inventory.update_condition': 'write:inventory',
  'purchases.create': 'write:purchases',
  'purchases.set_status': 'write:purchases',
  'borrows.create': 'write:borrows',
  'borrows.return': 'write:borrows',
  'approvals.decide': 'write:approvals',
  'finance.add_transaction': 'write:finance',
};

function scopeForDataKey(key) {
  return DATA_KEY_SCOPES[key];
}

function scopeForAction(actionId) {
  return ACTION_SCOPES[actionId];
}

module.exports = {
  ALL_SCOPES,
  scopesForUser,
  hasScope,
  scopeForDataKey,
  scopeForAction,
  DATA_KEY_SCOPES,
  ACTION_SCOPES,
};
