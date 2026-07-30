import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  uploadReceipt,
} from '../../lib/api';
import { useAuth, useToast } from '../../App';
import { CATEGORIES } from '../../lib/constants';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReceiptField from '../../components/ReceiptField';

const DONATION_CATEGORIES = [
  ...CATEGORIES,
  'Fundraiser', 'Savings', 'Other',
];

function DonationFormModal({ initial, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(initial || {
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    category: '',
    receiptUrl: '',
    receiptName: '',
  });
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      return await uploadReceipt(base64, file.name, file.type);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        type: 'Donation',
        amount: parseFloat(form.amount) || 0,
      });
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
          <h2 className="text-lg font-semibold">{initial ? 'Edit Donation' : 'Add Donation'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date</label>
              <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" min="0" className="input" required value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Description *</label>
              <input className="input" required value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Donor name or what this donation is for" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select…</option>
                {DONATION_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Receipt</label>
              <ReceiptField
                value={form.receiptUrl}
                onChange={(url, name) => setForm((f) => ({ ...f, receiptUrl: url, receiptName: name || f.receiptName }))}
                onUpload={handleUpload}
                uploading={uploading}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || uploading} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Donations() {
  const { user } = useAuth();
  const toast    = useToast();
  const [donations, setDonations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canEdit = ['Admin', 'Manager', 'Accounting Admin'].includes(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    getTransactions()
      .then((txns) => setDonations((txns || []).filter((t) => t.type === 'Donation')))
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    const payload = { ...form, type: 'Donation' };
    if (editTarget) { await updateTransaction(editTarget.id, payload); toast('Updated', 'success'); }
    else            { await createTransaction(payload);                toast('Donation added', 'success'); }
    load();
  };

  const handleDelete = async () => {
    try { await deleteTransaction(deleteTarget.id); toast('Deleted', 'success'); setDeleteTarget(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const filtered = useMemo(() => {
    let list = [...donations].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [donations, search]);

  const total = useMemo(
    () => donations.reduce((s, t) => s + (t.amount || 0), 0),
    [donations]
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="card p-4 text-center sm:text-left sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">Total Donations</p>
          <p className="text-2xl font-bold text-emerald-400">${total.toFixed(2)}</p>
        </div>
        <p className="text-xs text-gray-600 mt-1 sm:mt-0">{donations.length} donation{donations.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input
          className="input flex-1 min-w-48"
          placeholder="Search donations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canEdit && (
          <button onClick={() => { setEditTarget(null); setAddOpen(true); }} className="btn-primary">
            + Add Donation
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">🎁</span>
          <p>{search ? 'No donations match your search' : 'No donations yet'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map((t, idx) => (
            <div
              key={t.id}
              className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 ${idx < filtered.length - 1 ? 'border-b border-gray-800/60' : ''} hover:bg-gray-800/30`}
            >
              <span className="text-xs text-gray-500 tabular-nums flex-shrink-0 w-24">
                {new Date(t.date).toLocaleDateString()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{t.description}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {t.category && <span className="text-xs text-gray-500">{t.category}</span>}
                  {t.receiptUrl && (
                    <a
                      href={t.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-400 hover:underline flex-shrink-0"
                    >
                      📎 {t.receiptName || 'Receipt'}
                    </a>
                  )}
                </div>
              </div>
              <span className="badge border flex-shrink-0 bg-emerald-900/50 text-emerald-400 border-emerald-800/50">
                Donation
              </span>
              <span className="text-sm font-semibold tabular-nums flex-shrink-0 w-24 text-right text-emerald-400">
                +${(t.amount || 0).toFixed(2)}
              </span>
              {canEdit && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditTarget(t); setAddOpen(true); }} className="btn-ghost text-xs py-0.5 px-1.5">✏</button>
                  <button onClick={() => setDeleteTarget(t)} className="btn-ghost text-xs py-0.5 px-1.5 text-red-500">✕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(addOpen || editTarget) && (
        <DonationFormModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setAddOpen(false); setEditTarget(null); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Donation"
          message={`Delete "${deleteTarget.description}"?`}
          confirmLabel="Delete"
          dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
