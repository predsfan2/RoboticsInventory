import React, { useState, useEffect, useCallback } from 'react';
import {
  getFundraisers, createFundraiser, updateBudget, addDonation,
} from '../../lib/api';
import { useAuth, useToast } from '../../App';
import { api } from '../../lib/api';
import ConfirmDialog from '../../components/ConfirmDialog';

const deleteFundraiser = (id) => api.del(`/fundraisers/${id}`);

function FundraiserFormModal({ onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', date: new Date().toISOString().slice(0, 10), targetAmount: '', actualAmount: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, targetAmount: parseFloat(form.targetAmount) || 0, actualAmount: parseFloat(form.actualAmount) || 0 });
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
          <h2 className="text-lg font-semibold">New Fundraiser</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Event Name *</label>
            <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Bake Sale 2025" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date</label>
            <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Target ($)</label>
              <input type="number" step="0.01" min="0" className="input" value={form.targetAmount} onChange={(e) => set('targetAmount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Starting Amount ($)</label>
              <input type="number" step="0.01" min="0" className="input" value={form.actualAmount} onChange={(e) => set('actualAmount', e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DonationModal({ fundraiser, onClose, onSuccess }) {
  const toast = useToast();
  const [form, setForm] = useState({ donor: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addDonation(fundraiser.id, { ...form, amount: parseFloat(form.amount) || 0 });
      toast('Donation recorded', 'success');
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add Donation</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <p className="text-sm text-gray-400 mb-4">Fundraiser: <strong className="text-gray-200">{fundraiser.name}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Donor Name</label>
            <input className="input" value={form.donor} onChange={(e) => set('donor', e.target.value)} placeholder="Anonymous" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Amount ($) *</label>
              <input type="number" step="0.01" min="0.01" className="input" required value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Date</label>
              <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Record'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Fundraisers() {
  const { user } = useAuth();
  const toast = useToast();
  const [fundraisers, setFundraisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [donationTarget, setDonationTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [expanded, setExpanded] = useState({});

  const canEdit = ['Admin', 'Manager', 'Accounting Admin'].includes(user?.role);

  const load = useCallback(() => {
    setLoading(true);
    getFundraisers().then(setFundraisers).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try { await deleteFundraiser(deleteTarget.id); toast('Deleted', 'success'); setDeleteTarget(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-100">Fundraisers</h2>
        {canEdit && (
          <button onClick={() => setAddOpen(true)} className="btn-primary">+ New Fundraiser</button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : fundraisers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">🏆</span>
          <p>No fundraisers yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fundraisers.map((f) => {
            const pct = f.targetAmount > 0 ? Math.min(100, (f.actualAmount / f.targetAmount) * 100) : 0;
            const isExpanded = expanded[f.id];

            return (
              <div key={f.id} className="card overflow-hidden">
                {/* Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-100">{f.name}</h3>
                      <p className="text-xs text-gray-500">{new Date(f.date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {canEdit && (
                        <>
                          <button onClick={() => setDonationTarget(f)} className="btn-primary text-xs py-1 px-3">+ Donation</button>
                          <button onClick={() => setDeleteTarget(f)} className="btn-ghost text-xs text-red-500">✕</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>${f.actualAmount.toFixed(2)} raised</span>
                      {f.targetAmount > 0 && <span>${f.targetAmount.toFixed(2)} goal</span>}
                    </div>
                    {f.targetAmount > 0 && (
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-indigo-400 font-medium">{(f.donations || []).length} donations</span>
                      {f.targetAmount > 0 && <span className="text-gray-600">{pct.toFixed(0)}%</span>}
                    </div>
                  </div>
                </div>

                {/* Donor list toggle */}
                {(f.donations || []).length > 0 && (
                  <>
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [f.id]: !isExpanded }))}
                      className="w-full flex items-center justify-between px-4 py-2 bg-gray-800/40 hover:bg-gray-800 transition-colors border-t border-gray-800 text-xs text-gray-500"
                    >
                      <span>{isExpanded ? '▾' : '▸'} {isExpanded ? 'Hide' : 'Show'} donors</span>
                      <span className="font-medium text-gray-400">{(f.donations || []).length} entries</span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-800">
                        {[...(f.donations || [])].reverse().map((d) => (
                          <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/50 last:border-0">
                            <span className="text-gray-300 flex-1 text-sm">{d.donor || 'Anonymous'}</span>
                            <span className="text-xs text-gray-500">{new Date(d.date).toLocaleDateString()}</span>
                            <span className="font-semibold text-emerald-400 text-sm">${d.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <FundraiserFormModal
          onSave={async (form) => { await createFundraiser(form); toast('Fundraiser created', 'success'); load(); }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {donationTarget && (
        <DonationModal
          fundraiser={donationTarget}
          onClose={() => setDonationTarget(null)}
          onSuccess={() => { setDonationTarget(null); load(); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Fundraiser"
          message={`Delete "${deleteTarget.name}" and all donation records?`}
          confirmLabel="Delete" dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
