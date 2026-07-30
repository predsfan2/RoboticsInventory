import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getBudgets, createBudget, updateBudget, deleteBudget } from '../../lib/api';
import { useAuth, useToast } from '../../App';
import { hasPermission } from '../../lib/permissions';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  formatMoney, MoneyStat, FinancePageHeader, FinanceEmpty, RowActions,
} from '../../components/finance';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const BUDGET_GRID = 'grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_7rem_7rem_8rem_2.5rem] md:gap-x-3 md:items-center';

const BUDGET_CATEGORIES = [
  'Tools', 'Electronics', 'Pneumatics', 'Mechanical', 'Structural',
  'Drive Train', 'Safety', 'Travel', 'Food', 'Registration', 'Sensors', 'Other',
];

const now = new Date();
const THIS_YEAR = now.getFullYear();
const THIS_MONTH = now.getMonth() + 1;

function BudgetFormModal({ initial, onSave, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(initial || {
    category: '', year: THIS_YEAR, month: THIS_MONTH, allocated: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, allocated: parseFloat(form.allocated) || 0 });
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
          <h2 className="text-lg font-semibold">{initial ? 'Edit Budget' : 'Add Budget'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Category *</label>
            <select className="input" required value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Select…</option>
              {BUDGET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Year</label>
              <input type="number" className="input" value={form.year} onChange={(e) => set('year', parseInt(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Month (1–12, blank = annual)</label>
              <input type="number" min="1" max="12" className="input" value={form.month ?? ''} onChange={(e) => set('month', e.target.value ? parseInt(e.target.value) : null)} placeholder="Annual" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Allocated ($)</label>
            <input type="number" step="0.01" min="0" className="input" value={form.allocated} onChange={(e) => set('allocated', e.target.value)} placeholder="0.00" />
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

function VarianceBadge({ variance }) {
  if (variance > 0) {
    return <span className="text-sm tabular-nums text-emerald-400">{formatMoney(variance)} under</span>;
  }
  if (variance < 0) {
    return <span className="text-sm tabular-nums text-red-400">{formatMoney(Math.abs(variance))} over</span>;
  }
  return <span className="text-sm text-gray-500">On budget</span>;
}

export default function Budget() {
  const { user } = useAuth();
  const toast = useToast();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewYear, setViewYear] = useState(THIS_YEAR);
  const [viewMonth, setViewMonth] = useState(THIS_MONTH);

  const canEdit = hasPermission(user, 'finance.budget.edit');

  const load = useCallback(() => {
    setLoading(true);
    getBudgets().then(setBudgets).catch((e) => toast(e.message, 'error')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    if (editTarget) { await updateBudget(editTarget.id, form); toast('Budget updated', 'success'); }
    else { await createBudget(form); toast('Budget added', 'success'); }
    load();
  };

  const handleDelete = async () => {
    try { await deleteBudget(deleteTarget.id); toast('Deleted', 'success'); setDeleteTarget(null); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  // Filter to current view
  const visible = budgets.filter((b) =>
    b.year === viewYear && (b.month == null || b.month === viewMonth)
  );

  const totalAllocated = visible.reduce((s, b) => s + (b.allocated || 0), 0);
  const totalActual = visible.reduce((s, b) => s + (b.actual || 0), 0);

  // Chart data
  const chartData = {
    labels: visible.map((b) => b.category),
    datasets: [
      {
        label: 'Allocated',
        data: visible.map((b) => b.allocated || 0),
        backgroundColor: '#4f46e5',
        borderRadius: 4,
      },
      {
        label: 'Actual',
        data: visible.map((b) => b.actual || 0),
        backgroundColor: (ctx) => {
          const b = visible[ctx.dataIndex];
          return (b?.actual || 0) > (b?.allocated || 0) ? '#dc2626' : '#059669';
        },
        borderRadius: 4,
      },
    ],
  };

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9ca3af', font: { size: 12 } } } },
    scales: {
      x: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { color: '#1f2937' } },
      y: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { color: '#1f2937' }, beginAtZero: true },
    },
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const varianceTotal = totalAllocated - totalActual;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <FinancePageHeader title="Budget">
        <select className="input w-auto" value={viewYear} onChange={(e) => setViewYear(parseInt(e.target.value))}>
          {[THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="input w-auto" value={viewMonth} onChange={(e) => setViewMonth(parseInt(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        {canEdit && (
          <button type="button" onClick={() => { setEditTarget(null); setAddOpen(true); }} className="btn-primary">+ Add Budget</button>
        )}
      </FinancePageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MoneyStat label="Allocated" value={totalAllocated} color="text-indigo-300" />
        <MoneyStat
          label="Actual"
          value={totalActual}
          color={totalActual > totalAllocated ? 'text-red-400' : 'text-emerald-400'}
        />
        <MoneyStat
          label="Variance"
          value={varianceTotal}
          color={varianceTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}
          hint={varianceTotal > 0 ? 'under budget' : varianceTotal < 0 ? 'over budget' : 'on budget'}
        />
      </div>

      {visible.length > 0 && (
        <div className="card p-4">
          <p className="text-sm text-gray-300 mb-3 font-medium">Allocated vs Actual</p>
          <div className="h-60">
            <Bar data={chartData} options={chartOpts} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Loading…</div>
      ) : visible.length === 0 ? (
        <FinanceEmpty
          title={`No budgets for ${MONTHS[viewMonth - 1]} ${viewYear}`}
          description="Add a budget category to track spending."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_7rem_7rem_8rem_2.5rem] md:gap-x-3 md:items-center px-4 py-2.5 border-b border-gray-800 bg-gray-800/40 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Category</span>
            <span className="text-right">Allocated</span>
            <span className="text-right">Actual</span>
            <span className="text-right">Variance</span>
            <span />
          </div>
          {visible.map((b) => {
            const allocated = b.allocated || 0;
            const actual = b.actual || 0;
            const variance = allocated - actual;
            const pct = allocated > 0 ? Math.min(100, (actual / allocated) * 100) : 0;
            return (
              <div key={b.id} className="px-4 py-3 border-b border-gray-800/60 last:border-0">
                <div className={BUDGET_GRID}>
                  <span className="font-medium text-gray-100">{b.category}</span>
                  <span className="text-sm text-indigo-300 tabular-nums md:text-right">{formatMoney(allocated)}</span>
                  <span className={`text-sm tabular-nums md:text-right ${actual > allocated ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatMoney(actual)}
                  </span>
                  <div className="md:text-right">
                    <VarianceBadge variance={variance} />
                  </div>
                  <div className="flex justify-end">
                    {canEdit && (
                      <RowActions
                        actions={[
                          { label: 'Edit', onClick: () => { setEditTarget(b); setAddOpen(true); } },
                          { label: 'Delete', danger: true, onClick: () => setDeleteTarget(b) },
                        ]}
                      />
                    )}
                  </div>
                </div>
                <div className="mt-2.5">
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 tabular-nums">{pct.toFixed(0)}% used</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(addOpen || editTarget) && (
        <BudgetFormModal initial={editTarget} onSave={handleSave} onClose={() => { setAddOpen(false); setEditTarget(null); }} />
      )}
      {deleteTarget && (
        <ConfirmDialog title="Delete Budget" message={`Delete budget for "${deleteTarget.category}"?`}
          confirmLabel="Delete" dangerous onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
