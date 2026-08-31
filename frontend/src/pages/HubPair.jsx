import React, { useState, useEffect, useCallback } from 'react';
import {
  getHubPairing, approveHubPairing, denyHubPairing,
  getHubDevices, revokeHubDevice, getUsers,
} from '../lib/api';
import { useToast } from '../App';
import ConfirmDialog from '../components/ConfirmDialog';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function HubPair() {
  const toast = useToast();
  const [pairing, setPairing] = useState([]);
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [userId, setUserId] = useState('');
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getHubPairing(), getHubDevices(), getUsers()])
      .then(([p, d, u]) => {
        setPairing(p.pairing || []);
        setDevices(d.devices || []);
        setUsers(Array.isArray(u) ? u : []);
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (userCode) => {
    setBusy(true);
    try {
      await approveHubPairing(userCode, userId ? { user_id: userId } : {});
      toast('Device approved — the phone can finish pairing', 'success');
      setCode('');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeny = async (userCode) => {
    setBusy(true);
    try {
      await denyHubPairing(userCode);
      toast('Pairing denied', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeHubDevice(revokeTarget.device_id);
      toast('Device revoked', 'success');
      setRevokeTarget(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-100 mb-1">Hub devices</h1>
      <p className="text-sm text-gray-500 mb-6">
        Approve a code shown on Homelab Hub to pair a phone. Pairing is private-network only unless
        you set <code className="text-gray-300">HUB_PAIRING_NETWORK=public_allowed</code>.
      </p>

      <div className="card p-4 mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Approve pairing code</p>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) handleApprove(code.trim().toUpperCase());
          }}
        >
          <input
            className="input font-mono tracking-widest uppercase"
            placeholder="ABCD-EFGH"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={9}
          />
          <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Act as me (approver)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
          <button type="submit" disabled={busy || !code.trim()} className="btn-primary w-full sm:w-auto">Approve</button>
        </form>
      </div>

      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Pending codes</h2>
      {loading ? (
        <div className="text-gray-600 mb-6">Loading…</div>
      ) : pairing.length === 0 ? (
        <p className="text-sm text-gray-600 mb-6">No phones waiting.</p>
      ) : (
        <div className="card overflow-hidden mb-6">
          {pairing.map((s, idx) => (
            <div key={s.pairing_session_id} className={`flex items-center gap-3 px-4 py-3 ${idx < pairing.length - 1 ? 'border-b border-gray-800' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-lg tracking-widest text-indigo-300">{s.user_code}</p>
                <p className="text-xs text-gray-500">{s.device_name} · expires {formatWhen(s.expires_at)}</p>
              </div>
              <button disabled={busy} onClick={() => handleApprove(s.user_code)} className="btn-primary text-xs">Approve</button>
              <button disabled={busy} onClick={() => handleDeny(s.user_code)} className="btn-ghost text-xs text-red-500">Deny</button>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">Paired devices</h2>
      {devices.length === 0 ? (
        <p className="text-sm text-gray-600">None yet.</p>
      ) : (
        <div className="card overflow-hidden">
          {devices.map((d, idx) => (
            <div key={d.device_id} className={`flex items-center gap-3 px-4 py-3 ${idx < devices.length - 1 ? 'border-b border-gray-800' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-200">{d.name}</p>
                <p className="text-xs text-gray-500">
                  Bound to {d.user_name || d.user_id || 'unknown'} · Last seen {formatWhen(d.last_seen_at)} · {d.revoked ? 'revoked' : 'active'}
                </p>
              </div>
              {!d.revoked && (
                <button onClick={() => setRevokeTarget(d)} className="btn-ghost text-xs text-red-500">Revoke</button>
              )}
              {d.revoked && <span className="text-xs text-gray-600">Revoked</span>}
            </div>
          ))}
        </div>
      )}

      {revokeTarget && (
        <ConfirmDialog
          title="Revoke device"
          message={`Revoke “${revokeTarget.name}”? It will need to pair again.`}
          confirmLabel="Revoke"
          dangerous
          onConfirm={handleRevoke}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}
