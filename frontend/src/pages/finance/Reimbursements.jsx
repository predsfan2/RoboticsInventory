import React, { useState, useEffect, useCallback } from 'react';
import {
  getReimbursements, createReimbursement,
  approveReimbursement, denyReimbursement, deleteReimbursement,
  uploadReceipt,
} from '../../lib/api';
import { useAuth, useToast } from '../../App';
import ConfirmDialog from '../../components/ConfirmDialog';
import ReceiptField from '../../components/ReceiptField';

const STATUS_STYLES = {
  pending:  'bg-amber-900/60 text-amber-400 border-amber-800/50',
  approved: 'bg-emerald-900/60 text-emerald-400 border-emerald-800/50',
  denied:   'bg-red-900/60 text-red-400 border-red-800/50',
};

function SubmitModal({ onSave, onClose, isAdmin }) {
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
          <h2 className="text-lg font-semibold">{isAdmin ? 'Add Reimbursement' : 'Request Reimbursement'}</h2>
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
            <button type="submit" disabled={saving || uploading} className="btn-primary">
              {saving ? (isAdmin ? 'Adding…' : 'Submitting…') : (isAdmin ? 'Add' : 'Submit')}
            </button>
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

  const isAdmin = ['Admin', 'Manager', 'Accounting Admin'].includes(user?.role);

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

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-100">Reimbursements</h2>
          {pendingCount > 0 && <span className="badge bg-amber-900/60 text-amber-400 border border-amber-800/50">{pendingCount} pending</span>}
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary">{isAdmin ? '+ Add' : '+ Request'}</button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'approved', 'denied'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === s ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}>
            {s === '' ? `All (${reimbs.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${reimbs.filter((r) => r.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2"><span className="text-4xl">💸</span><p>No reimbursements</p></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-100">${r.amount.toFixed(2)}</span>
                  <span className={`badge border ${STATUS_STYLES[r.status] || ''}`}>{r.status}</span>
                  {isAdmin && <span className="text-xs text-gray-500">from {r.userName}</span>}
                </div>
                <p className="text-sm text-gray-400">{r.reason}</p>
                <div className="flex flex-wrap gap-x-3 text-xs text-gray-600 mt-1">
                  <span>Submitted {new Date(r.createdAt).toLocaleDateString()}</span>
                  {r.approvedAt && <span>{r.status === 'approved' ? '✓ Approved' : '✕ Denied'} {new Date(r.approvedAt).toLocaleDateString()} by {r.approvedBy}</span>}
                  {r.denialReason && <span>Reason: {r.denialReason}</span>}
                  {r.receiptUrl && (
                    <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                      📎 {r.receiptName || 'Receipt'}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0 flex-wrap">
                {isAdmin && r.status === 'pending' && (
                  <>
                    <button onClick={() => handleApprove(r.id)} disabled={busy[r.id]} className="btn-primary text-xs py-1 px-3">{busy[r.id] ? '…' : 'Approve'}</button>
                    <button onClick={() => setDenyTarget(r)} disabled={busy[r.id]} className="btn-danger text-xs py-1 px-3">Deny</button>
                  </>
                )}
                {isAdmin && (
                  <button onClick={() => setDeleteTarget(r)} className="btn-ghost text-xs py-1 px-2 text-red-500" title="Delete">🗑</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <SubmitModal
          isAdmin={isAdmin}
          onSave={async (form) => {
            await createReimbursement(form);
            toast(isAdmin ? 'Reimbursement added' : 'Request submitted', 'success');
            load();
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {denyTarget && (
        <DenyModal target={denyTarget} onClose={() => setDenyTarget(null)}
          onDeny={async (reason) => { await denyReimbursement(denyTarget.id, reason); toast('Denied', 'info'); load(); }} />
      )}
      {deleteTarget && (
        <ConfirmDialog title="Delete Reimbursement"
          message={`Delete this $${deleteTarget.amount.toFixed(2)} request from ${deleteTarget.userName}?`}
          confirmLabel="Delete" dangerous onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
