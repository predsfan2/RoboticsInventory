/**
 * permissions.js
 *
 * Granular permission system.
 * Each user has a `permissions` array of string keys.
 * Admins bypass all permission checks.
 * If a user has no permissions array, falls back to role defaults.
 */

import { ROLE_DEFAULT_PERMISSIONS } from './constants';

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
 * Returns the default permissions array for a role.
 */
export function getDefaultPermissions(role) {
  return [...(ROLE_DEFAULT_PERMISSIONS[role] || [])];
}
