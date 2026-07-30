import React, { useState, useEffect, useCallback } from 'react';
import {
  getReimbursements, createReimbursement,
  approveReimbursement, denyReimbursement, deleteReimbursement,
  uploadReceipt,
} from '../../lib/api';
import { useAuth, useToast } from '../../App';
import { hasPermission } from '../../lib/permissions';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReceiptField from '../../components/ReceiptField';
import {
  formatMoney, FinancePageHeader, FinanceEmpty, RowActions,
} from '../../components/finance';

const STATUS_STYLES = {
  pending:  'bg-amber-900/60 text-amber-400 border-amber-800/50',
  approved: 'bg-emerald-900/60 text-emerald-400 border-emerald-800/50',
  denied:   'bg-red-900/60 text-red-400 border-red-800/50',
};

function SubmitModal({ onSave, onClose }) {
  const toast = useToast();
  const [form, setForm]         = useState({ amount: '', reason: '', receiptUrl: '', receiptName: '' });
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
      return await uploadReceipt(base64, file.name, file.type);
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
      <div className="modal-panel max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Request Reimbursement</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Amount ($) *</label>
            <input type="number" step="0.01" min="0.01" className="input" required value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Reason *</label>
            <textarea className="input resize-none" rows={3} required value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="What did you purchase and why?" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Receipt</label>
            <ReceiptField
              value={form.receiptUrl}
              onChange={(url, name) => setForm((f) => ({ ...f, receiptUrl: url, receiptName: name || f.receiptName }))}
              onUpload={handleUpload}
              uploading={uploading}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || uploading} className="btn-primary">{saving ? 'Submitting…' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DenyModal({ target, onClose, onDeny }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-3">Deny Reimbursement</h2>
        <p className="text-sm text-gray-400 mb-4">${target.amount.toFixed(2)} from <strong className="text-gray-200">{target.userName}</strong></p>
        <textarea className="input resize-none mb-4 w-full" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button disabled={saving} onClick={async () => {
            setSaving(true);
            try { await onDeny(reason); onClose(); }
            catch (e) { toast(e.message, 'error'); }
            finally { setSaving(false); }
          }} className="btn-danger">{saving ? '…' : 'Deny'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Reimbursements() {
  const { user }  = useAuth();
  const toast     = useToast();
  const [reimbs, setReimbs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [denyTarget, setDenyTarget]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState({});
  const [filterStatus, setFilterStatus] = useState('');

  const canApprove = hasPermission(user, 'finance.reimbursements.approve')
    || hasPermission(user, 'approvals.manage');
  const canRequest = hasPermission(user, 'finance.reimbursements.request');

  const load = useCallback(() => {
    setLoading(true);
    getReimbursements().then(setReimbs).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try { await approveReimbursement(id); toast('Approved — transaction created', 'success'); load(); }
    catch (e) { toast(e.message, 'error'); }
    finally { setBusy((b) => ({ ...b, [id]: false })); }
  };

  const handleDelete = async () => {
    try { await deleteReimbursement(deleteTarget.id); toast('Deleted', 'success'); setDeleteTarget(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const filtered = filterStatus ? reimbs.filter((r) => r.status === filterStatus) : reimbs;
  const pendingCount = reimbs.filter((r) => r.status === 'pending').length;

  const filters = [
    { key: '', label: `All (${reimbs.length})` },
    { key: 'pending', label: `Pending (${reimbs.filter((r) => r.status === 'pending').length})` },
    { key: 'approved', label: `Approved (${reimbs.filter((r) => r.status === 'approved').length})` },
    { key: 'denied', label: `Denied (${reimbs.filter((r) => r.status === 'denied').length})` },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <FinancePageHeader
        title="Reimbursements"
        badge={pendingCount > 0 ? (
          <span className="badge bg-amber-900/60 text-amber-400 border border-amber-800/50">{pendingCount} pending</span>
        ) : null}
      >
        {canRequest && (
          <button type="button" onClick={() => setAddOpen(true)} className="btn-primary">+ Request</button>
        )}
      </FinancePageHeader>

      <div className="inline-flex flex-wrap rounded-lg border border-gray-700 overflow-hidden">
        {filters.map((f) => (
          <button
            key={f.key || 'all'}
            type="button"
            onClick={() => setFilterStatus(f.key)}
            className={`px-3.5 py-2 text-sm font-medium transition-colors border-r border-gray-700 last:border-r-0 ${
              filterStatus === f.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <FinanceEmpty title="No reimbursements" description="Submitted requests will show up here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="card p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                    <span className="text-lg font-bold text-gray-100 tabular-nums">{formatMoney(r.amount)}</span>
                    <span className={`badge border ${STATUS_STYLES[r.status] || ''}`}>{r.status}</span>
                    {canApprove && (
                      <span className="text-xs text-gray-500">from {r.userName}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{r.reason}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-800/60">
                    <span>Submitted {new Date(r.createdAt).toLocaleDateString()}</span>
                    {r.approvedAt && (
                      <span>
                        {r.status === 'approved' ? 'Approved' : 'Denied'}{' '}
                        {new Date(r.approvedAt).toLocaleDateString()}
                        {r.approvedBy ? ` by ${r.approvedBy}` : ''}
                      </span>
                    )}
                    {r.denialReason && <span>Reason: {r.denialReason}</span>}
                    {r.receiptUrl && (
                      <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                        Receipt{r.receiptName ? `: ${r.receiptName}` : ''}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap items-center">
                  {canApprove && r.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApprove(r.id)}
                        disabled={busy[r.id]}
                        className="btn-primary text-sm py-1.5 px-3"
                      >
                        {busy[r.id] ? '…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDenyTarget(r)}
                        disabled={busy[r.id]}
                        className="btn-danger text-sm py-1.5 px-3"
                      >
                        Deny
                      </button>
                    </>
                  )}
                  {canApprove && (
                    <RowActions
                      actions={[
                        { label: 'Delete', danger: true, onClick: () => setDeleteTarget(r) },
                      ]}
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <SubmitModal
          onSave={async (form) => { await createReimbursement(form); toast('Request submitted', 'success'); load(); }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {denyTarget && (
        <DenyModal target={denyTarget} onClose={() => setDenyTarget(null)}
          onDeny={async (reason) => { await denyReimbursement(denyTarget.id, reason); toast('Denied', 'info'); load(); }} />
      )}
      {deleteTarget && (
        <ConfirmDialog title="Delete Reimbursement"
          message={`Delete reimbursement for ${formatMoney(deleteTarget.amount)}?`}
          confirmLabel="Delete" dangerous onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
