import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  getBalance, getPurchases,
} from '../../lib/api';
import { useAuth, useToast } from '../../App';
import { TRANSACTION_TYPES, CATEGORIES } from '../../lib/constants';
import ConfirmDialog from '../../components/ConfirmDialog';

const TYPE_STYLES = {
  Purchase:        'bg-red-900/50 text-red-400 border-red-800/50',
  Donation:        'bg-emerald-900/50 text-emerald-400 border-emerald-800/50',
  FundraiserIncome:'bg-blue-900/50 text-blue-400 border-blue-800/50',
  Reimbursement:   'bg-amber-900/50 text-amber-400 border-amber-800/50',
};

const INCOME_TYPES = new Set(['Donation', 'FundraiserIncome']);

function TxFormModal({ initial, purchases, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(initial || {
    type: 'Purchase', date: new Date().toISOString().slice(0, 10),
    description: '', amount: '', category: '', receiptUrl: '',
    linkedPurchaseId: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, amount: parseFloat(form.amount) || 0 });
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
          <h2 className="text-lg font-semibold">{initial ? 'Edit Transaction' : 'Add Transaction'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                {TRANSACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date</label>
              <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Description *</label>
              <input className="input" required value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What is this for?" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Amount ($) *</label>
              <input
                type="number" step="0.01" min="0" className="input" required
                value={form.amount} onChange={(e) => set('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                <option>Travel</option>
                <option>Food</option>
                <option>Registration</option>
                <option>Fundraiser</option>
                <option>Savings</option>
                <option>Reimbursement</option>
                <option>Other</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Receipt URL</label>
              <input className="input" value={form.receiptUrl} onChange={(e) => set('receiptUrl', e.target.value)} placeholder="https://… or paste Google Drive link" />
            </div>
            {form.type === 'Purchase' && (
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Link to Purchase Order</label>
                <select className="input" value={form.linkedPurchaseId || ''} onChange={(e) => set('linkedPurchaseId', e.target.value)}>
                  <option value="">None</option>
                  {purchases.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} – {p.status}</option>
                  ))}
                </select>
              </div>
            )}
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

export default function Transactions() {
  const { user } = useAuth();
  const toast = useToast();
  const [txns, setTxns] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canEdit = ['Admin', 'Manager', 'Accounting Admin'].includes(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getTransactions(), getBalance(), getPurchases()])
      .then(([t, b, p]) => { setTxns(t); setBalance(b); setPurchases(p); })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    if (editTarget) {
      await updateTransaction(editTarget.id, form);
      toast('Transaction updated', 'success');
    } else {
      await createTransaction(form);
      toast('Transaction added', 'success');
    }
    load();
  };

  const handleDelete = async () => {
    try {
      await deleteTransaction(deleteTarget.id);
      toast('Deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const filtered = useMemo(() => {
    let list = [...txns].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (filterType) list = list.filter((t) => t.type === filterType);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [txns, filterType, search]);

  // Running balance for displayed list (newest-first → reverse for calc)
  const withRunning = useMemo(() => {
    const reversed = [...filtered].reverse();
    let running = 0;
    const withBal = reversed.map((t) => {
      if (INCOME_TYPES.has(t.type)) running += t.amount;
      else running -= t.amount;
      return { ...t, running };
    });
    return withBal.reverse();
  }, [filtered]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      {/* Balance summary */}
      {balance && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Income',   value: balance.income,   color: 'text-emerald-400' },
            { label: 'Total Expenses', value: balance.expenses, color: 'text-red-400' },
            { label: 'Net Balance',    value: balance.balance,  color: balance.balance >= 0 ? 'text-indigo-300' : 'text-red-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>${value.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <input className="input flex-1 min-w-48" placeholder="Search description, category…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All types</option>
          {TRANSACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        {canEdit && (
          <button onClick={() => { setEditTarget(null); setAddOpen(true); }} className="btn-primary">+ Add</button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">💳</span>
          <p>No transactions yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Header row */}
          <div className="hidden md:grid grid-cols-[100px_1fr_120px_80px_90px_100px_80px] gap-3 px-4 py-2 border-b border-gray-800 text-xs text-gray-600 font-medium">
            <span>Date</span><span>Description</span><span>Category</span>
            <span className="text-right">Amount</span><span>Type</span>
            <span className="text-right">Balance</span><span></span>
          </div>
          {withRunning.map((t, idx) => {
            const isIncome = INCOME_TYPES.has(t.type);
            return (
              <div
                key={t.id}
                className={`flex flex-col md:grid md:grid-cols-[100px_1fr_120px_80px_90px_100px_80px] gap-2 md:gap-3 px-4 py-3 ${
                  idx < withRunning.length - 1 ? 'border-b border-gray-800/60' : ''
                } hover:bg-gray-800/30 transition-colors`}
              >
                <span className="text-xs text-gray-500 tabular-nums">{new Date(t.date).toLocaleDateString()}</span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{t.description}</p>
                  {t.receiptUrl && (
                    <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">📎 Receipt</a>
                  )}
                </div>
                <span className="text-xs text-gray-500 truncate">{t.category || '—'}</span>
                <span className={`text-sm font-semibold tabular-nums text-right ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isIncome ? '+' : '-'}${t.amount.toFixed(2)}
                </span>
                <span className={`badge self-start md:self-center border ${TYPE_STYLES[t.type] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                  {t.type === 'FundraiserIncome' ? 'Fundraiser' : t.type}
                </span>
                <span className={`text-sm tabular-nums text-right font-mono ${t.running >= 0 ? 'text-gray-400' : 'text-red-400'}`}>
                  ${t.running.toFixed(2)}
                </span>
                {canEdit ? (
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => { setEditTarget(t); setAddOpen(true); }} className="btn-ghost text-xs py-0.5 px-1.5">✏</button>
                    <button onClick={() => setDeleteTarget(t)} className="btn-ghost text-xs py-0.5 px-1.5 text-red-500">✕</button>
                  </div>
                ) : <div />}
              </div>
            );
          })}
        </div>
      )}

      {(addOpen || editTarget) && (
        <TxFormModal
          initial={editTarget}
          purchases={purchases}
          onSave={handleSave}
          onClose={() => { setAddOpen(false); setEditTarget(null); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Transaction"
          message={`Delete "${deleteTarget.description}"?`}
          confirmLabel="Delete" dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
