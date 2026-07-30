/**
 * permissions.js
 *
 * Granular permission system.
 * Each user has a `permissions` array of string keys.
 * Admins bypass all permission checks.
 * If a user has no permissions array, falls back to role defaults.
 */

import { ROLE_DEFAULT_PERMISSIONS, FINANCE_PERMISSIONS, FINANCE_VIEW_PERMISSIONS } from './constants';

/**
 * Returns true if the user holds the given permission.
 * Admins always return true.
 * Falls back to role defaults if user.permissions is absent.
 */
export function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'Admin') return true;

  const perms = Array.isArray(user.permissions)
    ? user.permissions
    : (ROLE_DEFAULT_PERMISSIONS[user.role] || []);

  return perms.includes(permission);
}

/**
 * Returns true if the user holds any of the given permissions.
 * Admins always return true.
 */
export function hasAnyPermission(user, permissions) {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (!Array.isArray(permissions) || permissions.length === 0) return false;
  return permissions.some((p) => hasPermission(user, p));
}

/** True if user can access the Finance section at all. */
export function canAccessFinance(user) {
  return hasAnyPermission(user, FINANCE_PERMISSIONS);
}

/** True if user can see the Dashboard finance overview (any finance view key). */
export function canViewFinanceOverview(user) {
  return hasAnyPermission(user, FINANCE_VIEW_PERMISSIONS);
}

/**
 * Returns the default permissions array for a role.
 */
export function getDefaultPermissions(role) {
  return [...(ROLE_DEFAULT_PERMISSIONS[role] || [])];
}
