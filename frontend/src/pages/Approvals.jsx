import React, { useState, useEffect, useCallback } from 'react';
import {
  getPendingApprovals, getApprovalHistory, approveMoveRequest, denyMoveRequest,
  approveReimbursement, denyReimbursement, approvePurchase, denyPurchase, getItems,
} from '../lib/api';
import { useToast } from '../App';

function DenyModal({ title, onDeny, onClose }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-3">Deny: {title}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Reason (optional)</label>
            <textarea className="input resize-none" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this is being denied…" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try { await onDeny(reason); onClose(); } catch (e) { toast(e.message, 'error'); } finally { setSaving(false); }
              }}
              className="btn-danger"
            >
              {saving ? 'Denying…' : 'Deny'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Approvals() {
  const toast = useToast();
  const [data, setData] = useState({ moveRequests: [], reimbursements: [], purchases: [] });
  const [history, setHistory] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [filter, setFilter] = useState('all');
  const [denyTarget, setDenyTarget] = useState(null);
  const [busy, setBusy] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getPendingApprovals(), getApprovalHistory().catch(() => ({ items: [] })), getItems()])
      .then(([approvals, hist, its]) => {
        setData({
          moveRequests: approvals.moveRequests || [],
          reimbursements: approvals.reimbursements || [],
          purchases: approvals.purchases || [],
        });
        setHistory(hist.items || []);
        setItems(its);
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const setBusyFor = (id, val) => setBusy((b) => ({ ...b, [id]: val }));

  const total = data.moveRequests.length + data.reimbursements.length + data.purchases.length;
  const showMoves = filter === 'all' || filter === 'move';
  const showReimb = filter === 'all' || filter === 'reimburse';
  const showPo = filter === 'all' || filter === 'purchase';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-100">Approvals</h1>
        {total > 0 && <span className="badge bg-red-900/60 text-red-400 border border-red-800/50">{total} pending</span>}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('pending')} className={tab === 'pending' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>Pending</button>
        <button type="button" onClick={() => setTab('history')} className={tab === 'history' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>History</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {['all', 'move', 'reimburse', 'purchase'].map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`text-xs px-3 py-1 rounded-full border ${filter === f ? 'border-indigo-500 text-indigo-300' : 'border-gray-700 text-gray-500'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : tab === 'history' ? (
        history.filter((h) => {
          if (filter === 'move') return h.approvalType === 'moveRequest';
          if (filter === 'reimburse') return h.approvalType === 'reimbursement';
          if (filter === 'purchase') return h.approvalType === 'purchase';
          return true;
        }).length === 0 ? (
          <p className="text-sm text-gray-500">No history yet</p>
        ) : (
          <div className="space-y-2">
            {history.filter((h) => {
              if (filter === 'move') return h.approvalType === 'moveRequest';
              if (filter === 'reimburse') return h.approvalType === 'reimbursement';
              if (filter === 'purchase') return h.approvalType === 'purchase';
              return true;
            }).map((h) => (
              <div key={`${h.approvalType}-${h.id}`} className="card p-4 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-gray-200 font-medium">{h.approvalType}</span>
                  <span className={h.status === 'denied' || h.status === 'Denied' ? 'text-red-400' : 'text-emerald-400'}>{h.status}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {h.name || h.requestedLocation || h.reason || h.userName} · {h.approvedBy || ''}
                  {h.denialReason ? ` · Denied: ${h.denialReason}` : ''}
                </p>
              </div>
            ))}
          </div>
        )
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">✅</span>
          <p>No pending approvals</p>
        </div>
      ) : (
        <>
          {showMoves && data.moveRequests.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Move Requests ({data.moveRequests.length})</h2>
              <div className="space-y-2">
                {data.moveRequests.map((mr) => {
                  const item = items.find((i) => i.id === mr.itemId);
                  return (
                    <div key={mr.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-200">{item?.name || mr.itemId}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 text-xs text-gray-500">
                          <span>From: {item?.currentLocation || '—'}</span>
                          <span>To: <span className="text-gray-300">{mr.requestedLocation || '—'}</span></span>
                          {mr.requestedPerson && <span>Assign: {mr.requestedPerson}</span>}
                          <span>By: {mr.requestedBy}</span>
                        </div>
                        {mr.notes && <p className="text-xs text-gray-600 mt-1">{mr.notes}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={async () => { setBusyFor(mr.id, true); try { await approveMoveRequest(mr.id); toast('Move approved', 'success'); load(); } catch (e) { toast(e.message, 'error'); } finally { setBusyFor(mr.id, false); } }} disabled={busy[mr.id]} className="btn-primary text-xs py-1 px-3">
                          {busy[mr.id] ? '…' : 'Approve'}
                        </button>
                        <button onClick={() => setDenyTarget({ id: mr.id, label: item?.name || 'Move', fn: denyMoveRequest })} disabled={busy[mr.id]} className="btn-danger text-xs py-1 px-3">Deny</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showReimb && data.reimbursements.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Reimbursement Requests ({data.reimbursements.length})</h2>
              <div className="space-y-2">
                {data.reimbursements.map((r) => (
                  <div key={r.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-200">${r.amount.toFixed(2)}</span>
                        <span className="text-xs text-gray-400">from {r.userName}</span>
                      </div>
                      <p className="text-sm text-gray-400">{r.reason}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={async () => { setBusyFor(r.id, true); try { await approveReimbursement(r.id); toast('Reimbursement approved', 'success'); load(); } catch (e) { toast(e.message, 'error'); } finally { setBusyFor(r.id, false); } }} disabled={busy[r.id]} className="btn-primary text-xs py-1 px-3">Approve</button>
                      <button onClick={() => setDenyTarget({ id: r.id, label: `$${r.amount}`, fn: denyReimbursement })} className="btn-danger text-xs py-1 px-3">Deny</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showPo && data.purchases.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">High-priority purchases ({data.purchases.length})</h2>
              <div className="space-y-2">
                {data.purchases.map((p) => (
                  <div key={p.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-200">{p.name}</span>
                      <p className="text-xs text-gray-500">Qty {p.quantity} · {p.requester} · High</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={async () => { setBusyFor(p.id, true); try { await approvePurchase(p.id); toast('PO approved', 'success'); load(); } catch (e) { toast(e.message, 'error'); } finally { setBusyFor(p.id, false); } }} className="btn-primary text-xs py-1 px-3">Approve</button>
                      <button onClick={() => setDenyTarget({ id: p.id, label: p.name, fn: denyPurchase })} className="btn-danger text-xs py-1 px-3">Deny</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {denyTarget && (
        <DenyModal
          title={denyTarget.label}
          onDeny={async (reason) => { await denyTarget.fn(denyTarget.id, reason); toast('Denied', 'info'); load(); }}
          onClose={() => setDenyTarget(null)}
        />
      )}
    </div>
  );
}
