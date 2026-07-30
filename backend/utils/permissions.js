'use strict';

const ROLE_DEFAULT_PERMISSIONS = {
  Admin: [
    'inventory.view', 'inventory.edit', 'inventory.delete',
    'moves.request', 'moves.approve',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
    'finance.view', 'finance.edit',
    'approvals.manage', 'audit.view',
    'admin.users', 'admin.locations',
  ],
  Manager: [
    'inventory.view', 'inventory.edit',
    'moves.request', 'moves.approve',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
    'finance.view', 'finance.edit',
    'approvals.manage', 'audit.view',
  ],
  'Accounting Admin': [
    'inventory.view',
    'purchases.view',
    'finance.view', 'finance.edit',
    'audit.view',
  ],
  Member: [
    'inventory.view',
    'moves.request',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
  ],
  Viewer: [
    'inventory.view',
    'purchases.view',
    'borrows.view',
  ],
};

function getUserPermissions(user) {
  if (!user) return [];
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions;
  }
  return (ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.Member).slice();
}

function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  return getUserPermissions(user).includes(permission);
}

module.exports = {
  ROLE_DEFAULT_PERMISSIONS,
  getUserPermissions,
  hasPermission,
};
