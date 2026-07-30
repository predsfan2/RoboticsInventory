import React, { useState, useEffect, useCallback } from 'react';
import {
  getGoals, createGoal, updateGoal, deleteGoal, addFundsToGoal,
  linkTransactionToGoal, getTransactions,
} from '../../lib/api';
import { useAuth, useToast } from '../../App';
import { hasPermission } from '../../lib/permissions';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  FinanceProgress, FinancePageHeader, FinanceEmpty, RowActions,
} from '../../components/finance';

function GoalFormModal({ initial, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(initial ? {
    name: initial.name || '',
    targetAmount: String(initial.targetAmount ?? ''),
    currentAmount: String(initial.currentAmount ?? ''),
    deadline: initial.deadline ? String(initial.deadline).slice(0, 10) : '',
  } : { name: '', targetAmount: '', currentAmount: '', deadline: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...form,
        targetAmount: parseFloat(form.targetAmount) || 0,
        currentAmount: parseFloat(form.currentAmount) || 0,
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
      <div className="modal-panel max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{initial ? 'Edit Savings Goal' : 'New Savings Goal'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Goal Name *</label>
            <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. New Robot Parts Fund" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Target ($)</label>
              <input type="number" step="0.01" min="0" className="input" value={form.targetAmount} onChange={(e) => set('targetAmount', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Current ($)</label>
              <input type="number" step="0.01" min="0" className="input" value={form.currentAmount} onChange={(e) => set('currentAmount', e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Deadline</label>
            <input type="date" className="input" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : initial ? 'Save' : 'Create Goal'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddFundsModal({ goal, transactions, onClose, onSuccess }) {
  const toast = useToast();
  const [mode, setMode] = useState('new');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState(`Contribution to: ${goal.name}`);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [saving, setSaving] = useState(false);

  const incomeTransactions = transactions.filter((t) =>
    ['Donation', 'FundraiserIncome'].includes(t.type) && !t.linkedGoalId
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === 'new') {
        await addFundsToGoal(goal.id, parseFloat(amount) || 0, description);
        toast(`$${parseFloat(amount).toFixed(2)} added to ${goal.name}`, 'success');
      } else {
        if (!selectedTxId) throw new Error('Select a transaction');
        await linkTransactionToGoal(goal.id, selectedTxId, description);
        const tx = transactions.find((t) => t.id === selectedTxId);
        toast(`$${tx?.amount?.toFixed(2) || '?'} linked to ${goal.name}`, 'success');
      }
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
          <h2 className="text-lg font-semibold">Add Funds</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <p className="text-sm text-gray-400 mb-4">Goal: <strong className="text-gray-200">{goal.name}</strong></p>

        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setMode('new')} className={mode === 'new' ? 'btn-primary flex-1 text-xs' : 'btn-secondary flex-1 text-xs'}>
            New Transaction
          </button>
          <button type="button" onClick={() => setMode('existing')} className={mode === 'existing' ? 'btn-primary flex-1 text-xs' : 'btn-secondary flex-1 text-xs'}>
            Link Existing
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'new' ? (
            <>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Amount ($)</label>
                <input type="number" step="0.01" min="0.01" className="input" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Select Income Transaction</label>
              <select className="input" required value={selectedTxId} onChange={(e) => setSelectedTxId(e.target.value)}>
                <option value="">Choose…</option>
                {incomeTransactions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {new Date(t.date).toLocaleDateString()} – {t.description} (${t.amount.toFixed(2)})
                  </option>
                ))}
              </select>
              {incomeTransactions.length === 0 && (
                <p className="text-xs text-amber-400 mt-1">No available income transactions. Use "New Transaction" instead.</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : mode === 'existing' ? 'Link' : 'Add Funds'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SavingsGoals() {
  const { user } = useAuth();
  const toast = useToast();
  const [goals, setGoals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [fundsTarget, setFundsTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canEdit = hasPermission(user, 'finance.goals.edit');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getGoals(), getTransactions()])
      .then(([g, t]) => { setGoals(g); setTransactions(t); })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    try {
      await deleteGoal(deleteTarget.id);
      toast('Goal deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <FinancePageHeader title="Savings Goals">
        {canEdit && (
          <button type="button" onClick={() => setAddOpen(true)} className="btn-primary">+ New Goal</button>
        )}
      </FinancePageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Loading…</div>
      ) : goals.length === 0 ? (
        <FinanceEmpty title="No savings goals yet" description="Create a goal to track progress toward a target." />
      ) : (
        <div className="space-y-3">
          {goals.map((g) => {
            const isComplete = g.currentAmount >= g.targetAmount;
            const isOverdue = g.deadline && new Date(g.deadline) < new Date() && !isComplete;

            return (
              <div key={g.id} className={`card p-5 ${isComplete ? 'border-emerald-800/60' : isOverdue ? 'border-red-800/60' : ''}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-gray-100">{g.name}</h3>
                      {isComplete && <span className="badge bg-emerald-900/60 text-emerald-400 border border-emerald-800/50">Complete</span>}
                      {isOverdue && <span className="badge bg-red-900/60 text-red-400 border border-red-800/50">Overdue</span>}
                    </div>
                    {g.deadline && (
                      <p className="text-xs text-gray-500 mt-1">
                        Deadline {new Date(g.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 items-center">
                    {canEdit && !isComplete && (
                      <button type="button" onClick={() => setFundsTarget(g)} className="btn-primary text-sm py-1.5 px-3">+ Funds</button>
                    )}
                    {canEdit && (
                      <RowActions
                        actions={[
                          { label: 'Edit', onClick: () => setEditTarget(g) },
                          { label: 'Delete', danger: true, onClick: () => setDeleteTarget(g) },
                        ]}
                      />
                    )}
                  </div>
                </div>
                <FinanceProgress current={g.currentAmount} target={g.targetAmount} />
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <GoalFormModal
          onSave={async (form) => { await createGoal(form); toast('Goal created', 'success'); load(); }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editTarget && (
        <GoalFormModal
          initial={editTarget}
          onSave={async (form) => { await updateGoal(editTarget.id, form); toast('Goal updated', 'success'); load(); }}
          onClose={() => setEditTarget(null)}
        />
      )}
      {fundsTarget && (
        <AddFundsModal
          goal={fundsTarget}
          transactions={transactions}
          onClose={() => setFundsTarget(null)}
          onSuccess={() => { setFundsTarget(null); load(); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Goal"
          message={`Delete goal "${deleteTarget.name}"?`}
          confirmLabel="Delete" dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
