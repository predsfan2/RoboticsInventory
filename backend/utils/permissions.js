'use strict';

const FINANCE_PERMISSIONS = [
  'finance.transactions.view',
  'finance.transactions.edit',
  'finance.budget.view',
  'finance.budget.edit',
  'finance.goals.view',
  'finance.goals.edit',
  'finance.fundraisers.view',
  'finance.fundraisers.edit',
  'finance.reimbursements.view',
  'finance.reimbursements.request',
  'finance.reimbursements.approve',
  'finance.reports.view',
];

const ROLE_DEFAULT_PERMISSIONS = {
  Admin: [
    'inventory.view', 'inventory.edit', 'inventory.delete',
    'moves.request', 'moves.approve',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
    ...FINANCE_PERMISSIONS,
    'approvals.manage', 'audit.view',
    'admin.users', 'admin.locations',
  ],
  Manager: [
    'inventory.view', 'inventory.edit',
    'moves.request', 'moves.approve',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
    ...FINANCE_PERMISSIONS,
    'approvals.manage', 'audit.view',
  ],
  'Accounting Admin': [
    'inventory.view',
    'purchases.view',
    ...FINANCE_PERMISSIONS,
    'audit.view',
  ],
  Member: [
    'inventory.view',
    'moves.request',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
    'finance.reimbursements.view',
    'finance.reimbursements.request',
  ],
  Viewer: [
    'inventory.view',
    'purchases.view',
    'borrows.view',
  ],
};

const FINANCE_VIEW_FROM_LEGACY = [
  'finance.transactions.view',
  'finance.budget.view',
  'finance.goals.view',
  'finance.fundraisers.view',
  'finance.reimbursements.view',
  'finance.reports.view',
  'finance.reimbursements.request',
];

const FINANCE_EDIT_FROM_LEGACY = [
  'finance.transactions.edit',
  'finance.budget.edit',
  'finance.goals.edit',
  'finance.fundraisers.edit',
  'finance.reimbursements.approve',
];

/**
 * Expand legacy finance.view / finance.edit into granular keys (idempotent).
 * Returns a new deduplicated array.
 */
function migrateFinancePermissions(perms) {
  if (!Array.isArray(perms)) return perms;
  const set = new Set(perms);
  const hadView = set.has('finance.view');
  const hadEdit = set.has('finance.edit');
  if (!hadView && !hadEdit) return perms;

  if (hadView) {
    FINANCE_VIEW_FROM_LEGACY.forEach((k) => set.add(k));
    set.delete('finance.view');
  }
  if (hadEdit) {
    FINANCE_EDIT_FROM_LEGACY.forEach((k) => set.add(k));
    set.delete('finance.edit');
  }
  return Array.from(set);
}

function getUserPermissions(user) {
  if (!user) return [];
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return migrateFinancePermissions(user.permissions);
  }
  return (ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.Member).slice();
}

function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  return getUserPermissions(user).includes(permission);
}

function hasAnyPermission(user, permissions) {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (!Array.isArray(permissions) || permissions.length === 0) return false;
  return permissions.some((p) => hasPermission(user, p));
}

module.exports = {
  ROLE_DEFAULT_PERMISSIONS,
  FINANCE_PERMISSIONS,
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  migrateFinancePermissions,
};
