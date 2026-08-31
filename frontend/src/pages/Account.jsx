import React, { useState } from 'react';
import { useAuth, useToast } from '../App';
import { changeOwnPassword, revokeOtherSessions, setSession } from '../lib/api';

export default function Account() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const handlePassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    if (password !== confirm) {
      toast('Passwords do not match', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await changeOwnPassword(password, currentPassword || undefined);
      if (res.token && res.user) {
        setSession(res.user, res.token);
        setUser?.(res.user);
      }
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
      toast('Password updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const res = await revokeOtherSessions();
      if (res.token && res.user) {
        setSession(res.user, res.token);
        setUser?.(res.user);
      }
      toast('Other sessions signed out', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-100">My account</h1>
      {user?.mustChangePassword && (
        <div className="rounded-lg bg-amber-900/30 border border-amber-700/40 px-4 py-3 text-sm text-amber-300">
          You must change your password before continuing.
        </div>
      )}
      <div className="card p-5">
        <p className="text-sm text-gray-300 font-medium">{user?.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">{user?.role}</p>
      </div>
      <form onSubmit={handlePassword} className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-200">Change password</h2>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Current password</label>
          <input type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">New password</label>
          <input type="password" className="input" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Confirm new password</label>
          <input type="password" className="input" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Update password'}
        </button>
      </form>
      <div className="card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-200">Sessions</h2>
        <p className="text-xs text-gray-500">Sign out every other browser and device using your account. This device stays signed in.</p>
        <button type="button" onClick={handleRevoke} disabled={revoking} className="btn-secondary">
          {revoking ? 'Signing out…' : 'Sign out other sessions'}
        </button>
      </div>
    </div>
  );
}
