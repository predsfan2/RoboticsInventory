'use strict';

/**
 * Shared auth helpers — mirrors frontend permission checks.
 * Admins bypass all permission checks.
 * Falls back to role defaults when user.permissions is absent.
 */

const ROLE_DEFAULT_PERMISSIONS = {
  Admin: [
    'inventory.view', 'inventory.edit', 'inventory.delete',
    'moves.request', 'moves.approve',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
    'finance.view', 'finance.edit', 'finance.reimburse',
    'approvals.manage', 'audit.view',
    'admin.users', 'admin.locations',
  ],
  Manager: [
    'inventory.view', 'inventory.edit',
    'moves.request', 'moves.approve',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
    'finance.view', 'finance.edit', 'finance.reimburse',
    'approvals.manage', 'audit.view',
  ],
  'Accounting Admin': [
    'inventory.view',
    'purchases.view',
    'finance.view', 'finance.edit', 'finance.reimburse',
    'audit.view',
  ],
  Member: [
    'inventory.view',
    'moves.request',
    'purchases.view', 'purchases.edit',
    'borrows.view', 'borrows.manage',
    'finance.reimburse',
  ],
  Viewer: [
    'inventory.view',
    'purchases.view',
    'borrows.view',
  ],
};

function getUserPermissions(user) {
  if (!user) return [];
  if (Array.isArray(user.permissions)) return user.permissions;
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
  const perms = getUserPermissions(user);
  return permissions.some((p) => perms.includes(p));
}

/** Express middleware: require authentication + at least one of the given permissions. */
function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (permissions.length === 0) return next();
    if (!hasAnyPermission(req.user, permissions)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/** Legacy role check (kept for admin-only destructive ops where role is intentional). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = {
  ROLE_DEFAULT_PERMISSIONS,
  getUserPermissions,
  hasPermission,
  hasAnyPermission,
  requirePermission,
  requireRole,
};
