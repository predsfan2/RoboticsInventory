import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  importTransactions, getBalance, getPurchases, getFundraisers, uploadReceipt,
} from '../../lib/api';
import { useAuth, useToast } from '../../App';
import { hasPermission } from '../../lib/permissions';
import { TRANSACTION_TYPES, CATEGORIES } from '../../lib/constants';
import {
  parseCSV, validateTransactionImportRows, buildTransactionImportTemplate, downloadCSV,
} from '../../lib/csv';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReceiptField from '../../components/ReceiptField';

const TYPE_STYLES = {
  Purchase:         'bg-red-900/50 text-red-400 border-red-800/50',
  Donation:         'bg-emerald-900/50 text-emerald-400 border-emerald-800/50',
  FundraiserIncome: 'bg-blue-900/50 text-blue-400 border-blue-800/50',
  Reimbursement:    'bg-amber-900/50 text-amber-400 border-amber-800/50',
};
const INCOME_TYPES = new Set(['Donation', 'FundraiserIncome']);

const ALL_CATEGORIES = [
  ...CATEGORIES,
  'Travel', 'Food', 'Registration', 'Fundraiser', 'Savings', 'Reimbursement', 'Other',
];

function TxFormModal({ initial, purchases, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(initial || {
    type: 'Purchase',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    category: '',
    receiptUrl: '',
    receiptName: '',
    linkedPurchaseId: '',
  });
  const [saving, setSaving]     = useState(false);
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
      const result = await uploadReceipt(base64, file.name, file.type);
      return result; // { url, name }
    } finally {
      setUploading(false);
    }
  };

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
              <input type="number" step="0.01" min="0" className="input" required value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select…</option>
                {ALL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {form.type === 'Purchase' && (
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Link to Purchase Order</label>
                <select className="input" value={form.linkedPurchaseId || ''} onChange={(e) => set('linkedPurchaseId', e.target.value)}>
                  <option value="">None</option>
                  {purchases.map((p) => <option key={p.id} value={p.id}>{p.name} – {p.status}</option>)}
                </select>
              </div>
            )}
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

function ImportCSVModal({ fundraisers, onImported, onClose }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [valid, setValid] = useState([]);
  const [errors, setErrors] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = () => {
    downloadCSV('transactions-import-template.csv', buildTransactionImportTemplate());
  };

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const { rows } = parseCSV(text);
      if (rows.length === 0) {
        setValid([]);
        setErrors([{ row: 1, error: 'CSV has no data rows' }]);
        return;
      }
      const result = validateTransactionImportRows(rows, fundraisers);
      setValid(result.valid);
      setErrors(result.errors);
    } catch (err) {
      setValid([]);
      setErrors([{ row: '?', error: err.message || 'Failed to parse CSV' }]);
    }
  };

  const handleImport = async () => {
    if (valid.length === 0) return;
    setImporting(true);
    try {
      const payload = valid.map(({ type, date, description, amount, category, receiptUrl, fundraiser, donor }) => ({
        type, date, description, amount, category, receiptUrl, fundraiser, donor,
      }));
      const result = await importTransactions(payload);
      const linked = result.linkedFundraiserDonations || 0;
      toast(
        linked > 0
          ? `Imported ${result.imported} transactions (${linked} linked to fundraisers)`
          : `Imported ${result.imported} transactions`,
        'success'
      );
      onImported();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Import Transactions CSV</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>

        <p className="text-sm text-gray-400 mb-3">
          One CSV for purchases, donations, fundraiser income, and reimbursements.
          Optional <code className="text-gray-300">fundraiser</code> column links FundraiserIncome rows by name.
        </p>

        <div className="flex flex-wrap gap-2 items-center mb-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
            Choose CSV…
          </button>
          <button type="button" className="btn-ghost text-sm" onClick={handleDownloadTemplate}>
            Download template
          </button>
          {fileName && <span className="text-xs text-gray-500 truncate">{fileName}</span>}
        </div>

        {errors.length > 0 && (
          <div className="mb-4 rounded border border-red-900/50 bg-red-950/30 p-3">
            <p className="text-xs font-semibold text-red-400 mb-2">{errors.length} row{errors.length === 1 ? '' : 's'} with errors</p>
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {errors.map((e, i) => (
                <li key={i} className="text-xs text-red-300">Row {e.row}: {e.error}</li>
              ))}
            </ul>
          </div>
        )}

        {valid.length > 0 && (
          <div className="card overflow-hidden mb-4">
            <div className="px-3 py-2 border-b border-gray-800 bg-gray-800/40">
              <p className="text-xs text-gray-400">{valid.length} valid row{valid.length === 1 ? '' : 's'} ready to import</p>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {valid.map((r, idx) => (
                <div key={idx} className={`flex flex-wrap items-center gap-2 px-3 py-2 text-xs ${idx < valid.length - 1 ? 'border-b border-gray-800/60' : ''}`}>
                  <span className="text-gray-500 tabular-nums w-20 flex-shrink-0">{r.date}</span>
                  <span className={`badge border flex-shrink-0 ${TYPE_STYLES[r.type] || ''}`}>
                    {r.type === 'FundraiserIncome' ? 'Fundraiser' : r.type}
                  </span>
                  <span className="text-gray-200 truncate flex-1 min-w-24">{r.description}</span>
                  <span className="tabular-nums text-gray-300">${Number(r.amount).toFixed(2)}</span>
                  {r.willLinkFundraiser ? (
                    <span className="text-blue-400 truncate max-w-36" title={r.resolvedFundraiserName}>
                      → {r.resolvedFundraiserName}
                    </span>
                  ) : r.type === 'FundraiserIncome' ? (
                    <span className="text-gray-600">unlinked</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            type="button"
            disabled={importing || valid.length === 0}
            className="btn-primary"
            onClick={handleImport}
          >
            {importing ? 'Importing…' : `Import ${valid.length} valid`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Transactions() {
  const { user } = useAuth();
  const toast    = useToast();
  const [txns, setTxns]           = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [fundraisers, setFundraisers] = useState([]);
  const [balance, setBalance]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [filterType, setFilterType] = useState('');
  const [search, setSearch]         = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canEdit = hasPermission(user, 'finance.edit');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getTransactions(), getBalance(), getPurchases(), getFundraisers()])
      .then(([t, b, p, f]) => { setTxns(t); setBalance(b); setPurchases(p); setFundraisers(f); })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    if (editTarget) { await updateTransaction(editTarget.id, form); toast('Updated', 'success'); }
    else            { await createTransaction(form);                toast('Transaction added', 'success'); }
    load();
  };

  const handleDelete = async () => {
    try { await deleteTransaction(deleteTarget.id); toast('Deleted', 'success'); setDeleteTarget(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const filtered = useMemo(() => {
    let list = [...txns].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (filterType) list = list.filter((t) => t.type === filterType);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.description.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q));
    }
    return list;
  }, [txns, filterType, search]);

  // Running balance (oldest → newest, then reversed for display)
  const withRunning = useMemo(() => {
    const rev = [...filtered].reverse();
    let running = 0;
    const calc = rev.map((t) => {
      INCOME_TYPES.has(t.type) ? (running += t.amount) : (running -= t.amount);
      return { ...t, running };
    });
    return calc.reverse();
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
        <input className="input flex-1 min-w-48" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All types</option>
          {TRANSACTION_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        {canEdit && (
          <>
            <button onClick={() => setImportOpen(true)} className="btn-secondary">Import CSV</button>
            <button onClick={() => { setEditTarget(null); setAddOpen(true); }} className="btn-primary">+ Add</button>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">💳</span><p>No transactions yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {withRunning.map((t, idx) => {
            const isIncome = INCOME_TYPES.has(t.type);
            return (
              <div key={t.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-3 ${idx < withRunning.length - 1 ? 'border-b border-gray-800/60' : ''} hover:bg-gray-800/30`}>
                <span className="text-xs text-gray-500 tabular-nums flex-shrink-0 w-24">{new Date(t.date).toLocaleDateString()}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{t.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {t.category && <span className="text-xs text-gray-500">{t.category}</span>}
                    {t.receiptUrl && (
                      <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:underline flex-shrink-0">
                        📎 {t.receiptName || 'Receipt'}
                      </a>
                    )}
                  </div>
                </div>
                <span className={`badge border flex-shrink-0 ${TYPE_STYLES[t.type] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                  {t.type === 'FundraiserIncome' ? 'Fundraiser' : t.type}
                </span>
                <span className={`text-sm font-semibold tabular-nums flex-shrink-0 w-24 text-right ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isIncome ? '+' : '-'}${t.amount.toFixed(2)}
                </span>
                <span className={`text-xs tabular-nums font-mono flex-shrink-0 w-20 text-right ${t.running >= 0 ? 'text-gray-500' : 'text-red-400'}`}>
                  ${t.running.toFixed(2)}
                </span>
                {canEdit && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => { setEditTarget(t); setAddOpen(true); }} className="btn-ghost text-xs py-0.5 px-1.5">✏</button>
                    <button onClick={() => setDeleteTarget(t)} className="btn-ghost text-xs py-0.5 px-1.5 text-red-500">✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(addOpen || editTarget) && (
        <TxFormModal initial={editTarget} purchases={purchases} onSave={handleSave}
          onClose={() => { setAddOpen(false); setEditTarget(null); }} />
      )}
      {importOpen && (
        <ImportCSVModal
          fundraisers={fundraisers}
          onImported={load}
          onClose={() => setImportOpen(false)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog title="Delete Transaction" message={`Delete "${deleteTarget.description}"?`}
          confirmLabel="Delete" dangerous onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
