import React, { useState, useEffect, useCallback } from 'react';
import { getFundraisers, createFundraiser, updateFundraiser, deleteFundraiser, addDonation, addQuickTotal } from '../../lib/api';
import { useAuth, useToast } from '../../App';
import { hasPermission } from '../../lib/permissions';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  formatMoney, FinanceProgress, FinancePageHeader, FinanceEmpty, RowActions,
} from '../../components/finance';

// ── Fundraiser form modal ─────────────────────────────────────────────────────
function FundraiserFormModal({ initial, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(initial ? {
    name: initial.name || '',
    date: initial.date ? String(initial.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    targetAmount: String(initial.targetAmount ?? ''),
    actualAmount: String(initial.actualAmount ?? ''),
  } : {
    name: '', date: new Date().toISOString().slice(0, 10),
    targetAmount: '', actualAmount: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, targetAmount: parseFloat(form.targetAmount) || 0, actualAmount: parseFloat(form.actualAmount) || 0 });
      onClose();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{initial ? 'Edit Fundraiser' : 'New Fundraiser'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Event Name *</label>
            <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Car Wash, Bake Sale, Booth #3" />
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
              <label className="block text-xs text-gray-400 mb-1">{initial ? 'Actual ($)' : 'Starting Amount ($)'}</label>
              <input type="number" step="0.01" min="0" className="input" value={form.actualAmount} onChange={(e) => set('actualAmount', e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : initial ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Quick Total modal (end-of-day cash / stand total) ─────────────────────────
function QuickTotalModal({ fundraiser, onClose, onSuccess }) {
  const toast = useToast();
  const [form, setForm] = useState({
    amount: '',
    label: 'Daily total',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) { toast('Enter an amount', 'error'); return; }
    setSaving(true);
    try {
      await addQuickTotal(fundraiser.id, { ...form, amount: parseFloat(form.amount) });
      toast('Total recorded — $' + parseFloat(form.amount).toFixed(2) + ' added', 'success');
      onSuccess();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Record Daily Total</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Fundraiser: <strong className="text-gray-200">{fundraiser.name}</strong>
        </p>
        <div className="bg-indigo-900/20 border border-indigo-800/40 rounded-lg px-3 py-2 text-xs text-indigo-300 mb-4">
          Use this for end-of-day cash totals (stand, booth, etc.). No individual donor breakdown needed.
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Total Amount Earned ($) *</label>
            <input
              type="number" step="0.01" min="0.01" className="input text-lg font-semibold"
              required autoFocus
              value={form.amount} onChange={(e) => set('amount', e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Label</label>
            <input className="input" value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Saturday Stand, Morning Shift" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Date</label>
            <input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? 'Saving…' : '+ Record $' + (parseFloat(form.amount) || 0).toFixed(2)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Individual Donation modal ─────────────────────────────────────────────────
function DonationModal({ fundraiser, onClose, onSuccess }) {
  const toast = useToast();
  const [form, setForm] = useState({
    donor: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await addDonation(fundraiser.id, { ...form, amount: parseFloat(form.amount) || 0 });
      toast('Donation recorded', 'success');
      onSuccess();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Fundraisers() {
  const { user }  = useAuth();
  const toast     = useToast();
  const [fundraisers, setFundraisers] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [addOpen, setAddOpen]         = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [donationTarget, setDonationTarget]     = useState(null);
  const [quickTotalTarget, setQuickTotalTarget] = useState(null);
  const [deleteTarget, setDeleteTarget]         = useState(null);
  const [expanded, setExpanded]                 = useState({});

  const canEdit = hasPermission(user, 'finance.fundraisers.edit');

  const load = useCallback(() => {
    setLoading(true);
    getFundraisers().then(setFundraisers).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try { await deleteFundraiser(deleteTarget.id); toast('Deleted', 'success'); setDeleteTarget(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const toggleExpanded = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <FinancePageHeader title="Fundraisers">
        {canEdit && <button type="button" onClick={() => setAddOpen(true)} className="btn-primary">+ New Fundraiser</button>}
      </FinancePageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Loading…</div>
      ) : fundraisers.length === 0 ? (
        <FinanceEmpty title="No fundraisers yet" description="Create a fundraiser to track donations and daily totals." />
      ) : (
        <div className="space-y-3">
          {fundraisers.map((f) => {
            const isExpanded = expanded[f.id];
            const entries = f.donations || [];

            return (
              <div key={f.id} className="card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-100">{f.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{new Date(f.date).toLocaleDateString()}</p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end items-center">
                        <button
                          type="button"
                          onClick={() => setQuickTotalTarget(f)}
                          className="btn-primary text-sm py-1.5 px-3"
                          title="Record end-of-day total"
                        >
                          Quick Total
                        </button>
                        <button
                          type="button"
                          onClick={() => setDonationTarget(f)}
                          className="btn-secondary text-sm py-1.5 px-3"
                          title="Add individual donor"
                        >
                          + Donation
                        </button>
                        <RowActions
                          actions={[
                            { label: 'Edit', onClick: () => setEditTarget(f) },
                            { label: 'Delete', danger: true, onClick: () => setDeleteTarget(f) },
                          ]}
                        />
                      </div>
                    )}
                  </div>

                  <FinanceProgress
                    current={f.actualAmount}
                    target={f.targetAmount}
                    showRemaining={f.targetAmount > 0}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
                  </p>
                </div>

                {entries.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(f.id)}
                      className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-800/40 hover:bg-gray-800 transition-colors border-t border-gray-800 text-sm text-gray-400"
                    >
                      <span>{isExpanded ? 'Hide entries' : 'Show entries'}</span>
                      <span className="font-medium text-gray-500">{entries.length}</span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-800">
                        <div className="hidden md:grid grid-cols-[6.5rem_minmax(0,1fr)_6.5rem] gap-3 px-5 py-2 bg-gray-800/30 text-xs font-medium uppercase tracking-wide text-gray-500">
                          <span>Date</span>
                          <span>Donor</span>
                          <span className="text-right">Amount</span>
                        </div>
                        {[...entries].reverse().map((d) => (
                          <div
                            key={d.id}
                            className="grid grid-cols-1 md:grid-cols-[6.5rem_minmax(0,1fr)_6.5rem] gap-1 md:gap-3 px-5 py-2.5 border-b border-gray-800/50 last:border-0"
                          >
                            <span className="text-xs text-gray-500 tabular-nums md:text-sm md:text-gray-400">
                              {new Date(d.date).toLocaleDateString()}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm text-gray-200 truncate">{d.donor || 'Anonymous'}</p>
                                {d.isQuickTotal && (
                                  <span className="badge bg-indigo-900/50 text-indigo-400 border border-indigo-800/50">Total</span>
                                )}
                              </div>
                              {d.notes && <p className="text-xs text-gray-600 mt-0.5">{d.notes}</p>}
                            </div>
                            <span className="font-semibold text-emerald-400 text-sm tabular-nums md:text-right">
                              {formatMoney(d.amount)}
                            </span>
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
      {editTarget && (
        <FundraiserFormModal
          initial={editTarget}
          onSave={async (form) => { await updateFundraiser(editTarget.id, form); toast('Fundraiser updated', 'success'); load(); }}
          onClose={() => setEditTarget(null)}
        />
      )}
      {quickTotalTarget && (
        <QuickTotalModal
          fundraiser={quickTotalTarget}
          onClose={() => setQuickTotalTarget(null)}
          onSuccess={() => { setQuickTotalTarget(null); load(); }}
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
        <ConfirmDialog title="Delete Fundraiser" message={`Delete "${deleteTarget.name}" and all entries?`}
          confirmLabel="Delete" dangerous onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
