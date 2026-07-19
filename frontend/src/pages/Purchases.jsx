import React, { useState, useEffect, useCallback } from 'react';
import { getPurchases, createPurchase, updatePurchase, deletePurchase, setPurchaseStatus } from '../lib/api';
import { useAuth, useToast } from '../App';
import { CATEGORIES, PRIORITIES, PURCHASE_STATUSES } from '../lib/constants';
import ConfirmDialog from '../components/ConfirmDialog';
import { hasPermission } from '../lib/permissions';

const STATUS_STYLES = {
  Needed: 'badge bg-amber-900/60 text-amber-400 border border-amber-800/50',
  Ordered: 'badge bg-blue-900/60 text-blue-400 border border-blue-800/50',
  Received: 'badge bg-emerald-900/60 text-emerald-400 border border-emerald-800/50',
};
const PRIORITY_STYLES = {
  Low: 'text-gray-500',
  Medium: 'text-amber-400',
  High: 'text-red-400',
};

function PurchaseFormModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    name: '', quantity: 1, category: '', priority: 'Medium',
    link: '', status: 'Needed', notes: '', requester: '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{initial ? 'Edit Purchase' : 'Add Purchase Request'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Item Name *</label>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Name of item to purchase" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Quantity</label>
              <input type="number" min="1" className="input" value={form.quantity} onChange={(e) => set('quantity', parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Priority</label>
              <select className="input" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Status</label>
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {PURCHASE_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Link / URL</label>
              <input className="input" type="url" value={form.link || ''} onChange={(e) => set('link', e.target.value)} placeholder="https://…" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea className="input resize-none" rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Requester</label>
              <input className="input" value={form.requester || ''} onChange={(e) => set('requester', e.target.value)} placeholder="Your name" />
            </div>
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

export default function Purchases() {
  const { user } = useAuth();
  const toast = useToast();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusLoading, setStatusLoading] = useState({});
  const [filterStatus, setFilterStatus] = useState('');

  const canCreate = hasPermission(user, 'purchases.edit');
  const canManage = hasPermission(user, 'approvals.manage');
  const canEdit = canCreate;
  const canDelete = canManage || canCreate;

  const load = useCallback(() => {
    setLoading(true);
    getPurchases()
      .then(setPurchases)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    if (editTarget) {
      await updatePurchase(editTarget.id, form);
      toast('Purchase updated', 'success');
    } else {
      await createPurchase(form);
      toast('Purchase request created', 'success');
    }
    load();
  };

  const handleStatusChange = async (p, newStatus) => {
    setStatusLoading((s) => ({ ...s, [p.id]: true }));
    try {
      await setPurchaseStatus(p.id, newStatus);
      if (newStatus === 'Received') {
        toast(`"${p.name}" marked received — inventory updated`, 'success');
      } else {
        toast('Status updated', 'success');
      }
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setStatusLoading((s) => ({ ...s, [p.id]: false }));
    }
  };

  const handleDelete = async () => {
    try {
      await deletePurchase(deleteTarget.id);
      toast('Deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const filtered = filterStatus ? purchases.filter((p) => p.status === filterStatus) : purchases;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-100">Purchases</h1>
        <div className="flex gap-2">
          {canCreate && (
            <button onClick={() => { setEditTarget(null); setAddOpen(true); }} className="btn-primary">+ Add Request</button>
          )}
        </div>
      </div>

      {/* Filter by status */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterStatus('')} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!filterStatus ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
          All ({purchases.length})
        </button>
        {PURCHASE_STATUSES.map((s) => (
          <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === s ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
            {s} ({purchases.filter((p) => p.status === s).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">🛒</span>
          <p>No purchases {filterStatus && `with status "${filterStatus}"`}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map((p, idx) => (
            <div key={p.id} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 ${idx < filtered.length - 1 ? 'border-b border-gray-800' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-medium text-gray-200">{p.name}</span>
                  <span className={STATUS_STYLES[p.status] || 'badge bg-gray-800 text-gray-400'}>{p.status}</span>
                  <span className={`text-xs font-medium ${PRIORITY_STYLES[p.priority] || 'text-gray-500'}`}>
                    {p.priority === 'High' ? '🔴' : p.priority === 'Medium' ? '🟡' : '🟢'} {p.priority}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
                  <span>Qty: {p.quantity}</span>
                  {p.category && <span>{p.category}</span>}
                  {p.requester && <span>by {p.requester}</span>}
                  {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">🔗 Link</a>}
                </div>
                {p.notes && <p className="text-xs text-gray-600 mt-0.5 truncate">{p.notes}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {canManage && (
                  <select
                    value={p.status}
                    disabled={statusLoading[p.id]}
                    onChange={(e) => handleStatusChange(p, e.target.value)}
                    className="input w-auto text-xs py-1"
                  >
                    {PURCHASE_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                )}
                {(canManage || (canCreate && p.status === 'Needed' && (p.createdBy === user?.id || p.requester === user?.name))) && (
                  <button onClick={() => { setEditTarget(p); setAddOpen(true); }} className="btn-secondary text-xs py-1 px-2">Edit</button>
                )}
                {(canManage || (canCreate && p.status === 'Needed' && (p.createdBy === user?.id || p.requester === user?.name))) && (
                  <button onClick={() => setDeleteTarget(p)} className="btn-ghost text-xs py-1 px-2 text-red-500">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(addOpen || editTarget) && (
        <PurchaseFormModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setAddOpen(false); setEditTarget(null); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Purchase"
          message={`Delete "${deleteTarget.name}"?`}
          confirmLabel="Delete"
          dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
