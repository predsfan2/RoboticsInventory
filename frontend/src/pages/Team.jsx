import React, { useState, useEffect, useCallback } from 'react';
import { getUsers, createUser, updateUser, deleteUser, changePassword } from '../lib/api';
import { useAuth, useToast } from '../App';
import { ROLES, PERMISSION_GROUPS, ROLE_DEFAULT_PERMISSIONS } from '../lib/constants';
import { getDefaultPermissions } from '../lib/permissions';
import ConfirmDialog from '../components/ConfirmDialog';

const ROLE_BADGE = {
  Admin:             'bg-red-900/60 text-red-400 border-red-800/50',
  Manager:           'bg-amber-900/60 text-amber-400 border-amber-800/50',
  'Accounting Admin':'bg-blue-900/60 text-blue-400 border-blue-800/50',
  Member:            'bg-indigo-900/60 text-indigo-400 border-indigo-800/50',
  Viewer:            'bg-gray-800 text-gray-400 border-gray-700',
};

// ── UserFormModal ─────────────────────────────────────────────────────────────
function UserFormModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, role: initial.role }
      : { name: '', password: '', role: 'Member' }
  );
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{initial ? 'Edit User' : 'Add User'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          {!initial && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password *</label>
              <input type="password" className="input" required value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Initial password" />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ChangePasswordModal ───────────────────────────────────────────────────────
function ChangePasswordModal({ target, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast('Passwords do not match', 'error'); return; }
    setSaving(true);
    try { await changePassword(target.id, password); toast('Password changed', 'success'); onClose(); }
    catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Change Password</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <p className="text-sm text-gray-400 mb-4">For <strong className="text-gray-200">{target.name}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">New Password</label>
            <input type="password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Confirm Password</label>
            <input type="password" className="input" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Change'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── PermissionsModal ──────────────────────────────────────────────────────────
function PermissionsModal({ target, onSave, onClose }) {
  const toast = useToast();
  // Initialise from user's current permissions, or role defaults
  const [perms, setPerms] = useState(() =>
    new Set(
      Array.isArray(target.permissions) && target.permissions.length > 0
        ? target.permissions
        : getDefaultPermissions(target.role)
    )
  );
  const [saving, setSaving] = useState(false);

  const toggle = (key) =>
    setPerms((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const resetToRole = () => setPerms(new Set(getDefaultPermissions(target.role)));
  const selectAll   = () => setPerms(new Set(PERMISSION_GROUPS.flatMap((g) => g.perms.map((p) => p.key))));
  const clearAll    = () => setPerms(new Set());

  const handleSave = async () => {
    setSaving(true);
    try { await onSave([...perms]); onClose(); }
    catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  // Admin always has all perms — show a notice instead
  if (target.role === 'Admin') {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-panel max-w-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Permissions</h2>
            <button onClick={onClose} className="btn-ghost">✕</button>
          </div>
          <div className="bg-red-900/30 border border-red-700/40 rounded-lg px-4 py-3 text-sm text-red-300">
            Admins have full access to everything and bypass all permission checks. You can change their role to restrict access.
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-lg p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold">Permissions — {target.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Role: {target.role} · Customise exactly what this person can access.</p>
          </div>
          <button onClick={onClose} className="btn-ghost flex-shrink-0">✕</button>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={resetToRole} className="btn-secondary text-xs py-1">↺ Reset to {target.role} defaults</button>
          <button onClick={selectAll}   className="btn-secondary text-xs py-1">Select all</button>
          <button onClick={clearAll}    className="btn-secondary text-xs py-1">Clear all</button>
        </div>

        {/* Permission groups */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{group.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {group.perms.map(({ key, label }) => {
                  const checked = perms.has(key);
                  const isDefault = getDefaultPermissions(target.role).includes(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
                        checked
                          ? 'bg-indigo-900/30 border-indigo-700/50'
                          : 'bg-gray-800/40 border-gray-800 hover:border-gray-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(key)}
                        className="rounded accent-indigo-500 flex-shrink-0"
                      />
                      <span className="text-sm text-gray-200 flex-1">{label}</span>
                      {isDefault && (
                        <span className="text-xs text-gray-600 flex-shrink-0" title="Default for this role">default</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-800">
          <span className="text-xs text-gray-600">{perms.size} permission{perms.size !== 1 ? 's' : ''} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Permissions'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Team page ─────────────────────────────────────────────────────────────────
export default function Team() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget]   = useState(null);
  const [addOpen, setAddOpen]         = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pwdTarget, setPwdTarget]     = useState(null);
  const [permsTarget, setPermsTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getUsers().then(setUsers).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    if (editTarget) {
      await updateUser(editTarget.id, { name: form.name, role: form.role });
      // When role changes, reset permissions to new role defaults
      if (form.role !== editTarget.role) {
        await updateUser(editTarget.id, { permissions: getDefaultPermissions(form.role) });
      }
      toast('User updated', 'success');
    } else {
      const newUser = await createUser(form);
      // Auto-assign default permissions for the chosen role
      if (newUser?.id) {
        await updateUser(newUser.id, { permissions: getDefaultPermissions(form.role) });
      }
      toast('User created', 'success');
    }
    load();
  };

  const handleSavePermissions = async (userId, permissionsArray) => {
    await updateUser(userId, { permissions: permissionsArray });
    toast('Permissions saved', 'success');
    load();
  };

  const handleDelete = async () => {
    try { await deleteUser(deleteTarget.id); toast('User deleted', 'success'); setDeleteTarget(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-100">Team Management</h1>
        <button onClick={() => { setEditTarget(null); setAddOpen(true); }} className="btn-primary">+ Add User</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : (
        <div className="card overflow-hidden">
          {users.map((u, idx) => {
            const effectivePerms = Array.isArray(u.permissions) ? u.permissions : getDefaultPermissions(u.role);
            const isCustom = Array.isArray(u.permissions) && u.permissions.length > 0;
            return (
              <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${idx < users.length - 1 ? 'border-b border-gray-800' : ''}`}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-indigo-800 flex items-center justify-center font-bold text-sm text-white flex-shrink-0">
                  {u.name[0]?.toUpperCase()}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-200">{u.name}</span>
                    {u.id === me?.id && <span className="text-xs text-gray-600">(you)</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`badge border text-xs ${ROLE_BADGE[u.role] || ROLE_BADGE.Member}`}>{u.role}</span>
                    {u.role !== 'Admin' && (
                      <span className="text-xs text-gray-600">
                        {isCustom ? `${effectivePerms.length} custom permission${effectivePerms.length !== 1 ? 's' : ''}` : `${effectivePerms.length} default`}
                      </span>
                    )}
                    {isCustom && u.role !== 'Admin' && (
                      <span className="badge bg-purple-900/50 text-purple-400 border border-purple-800/50 text-xs">custom</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => setPermsTarget(u)}
                    className="btn-secondary text-xs py-1 px-2"
                    title="Edit permissions"
                  >
                    🔐 Permissions
                  </button>
                  <button onClick={() => { setEditTarget(u); setAddOpen(true); }} className="btn-secondary text-xs py-1 px-2">Edit</button>
                  <button onClick={() => setPwdTarget(u)} className="btn-secondary text-xs py-1 px-2" title="Change password">🔑</button>
                  {u.id !== me?.id && (
                    <button onClick={() => setDeleteTarget(u)} className="btn-ghost text-xs py-1 px-2 text-red-500">✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Role guide */}
      <div className="mt-6 card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Default permissions by role</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {['Manager', 'Accounting Admin', 'Member', 'Viewer'].map((role) => (
            <div key={role} className="bg-gray-800/40 rounded-lg p-3">
              <p className={`badge border mb-2 ${ROLE_BADGE[role] || ROLE_BADGE.Member}`}>{role}</p>
              <ul className="space-y-0.5">
                {getDefaultPermissions(role).map((p) => (
                  <li key={p} className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="text-gray-700">·</span>
                    {PERMISSION_GROUPS.flatMap((g) => g.perms).find((x) => x.key === p)?.label || p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {(addOpen || editTarget) && (
        <UserFormModal initial={editTarget} onSave={handleSave} onClose={() => { setAddOpen(false); setEditTarget(null); }} />
      )}
      {pwdTarget && <ChangePasswordModal target={pwdTarget} onClose={() => setPwdTarget(null)} />}
      {permsTarget && (
        <PermissionsModal
          target={permsTarget}
          onSave={(perms) => handleSavePermissions(permsTarget.id, perms)}
          onClose={() => setPermsTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete User"
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete" dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
