import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { getBudgets, createBudget, updateBudget, deleteBudget } from '../../lib/api';
import { useAuth, useToast } from '../../App';
import { hasPermission } from '../../lib/permissions';
import ConfirmDialog from '../../components/ConfirmDialog';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

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
  if (variance > 0) return <span className="text-xs text-emerald-400">+${variance.toFixed(2)} under</span>;
  if (variance < 0) return <span className="text-xs text-red-400">${Math.abs(variance).toFixed(2)} over</span>;
  return <span className="text-xs text-gray-500">On budget</span>;
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

  const canEdit = hasPermission(user, 'finance.edit');

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
    plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: '#1f2937' } },
      y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: '#1f2937' }, beginAtZero: true },
    },
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-gray-100 mr-auto">Budget</h2>
        <select className="input w-auto" value={viewYear} onChange={(e) => setViewYear(parseInt(e.target.value))}>
          {[THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="input w-auto" value={viewMonth} onChange={(e) => setViewMonth(parseInt(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        {canEdit && (
          <button onClick={() => { setEditTarget(null); setAddOpen(true); }} className="btn-primary">+ Add Budget</button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Allocated</p>
          <p className="text-xl font-bold text-indigo-300">${totalAllocated.toFixed(2)}</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Actual</p>
          <p className={`text-xl font-bold ${totalActual > totalAllocated ? 'text-red-400' : 'text-emerald-400'}`}>
            ${totalActual.toFixed(2)}
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">Variance</p>
          <VarianceBadge variance={totalAllocated - totalActual} />
        </div>
      </div>

      {/* Chart */}
      {visible.length > 0 && (
        <div className="card p-4">
          <p className="text-sm text-gray-400 mb-3 font-medium">Allocated vs Actual</p>
          <div className="h-52">
            <Bar data={chartData} options={chartOpts} />
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-600">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-600 gap-2">
          <span className="text-3xl">📊</span>
          <p>No budgets for {MONTHS[viewMonth - 1]} {viewYear}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_120px_120px_120px_80px] gap-3 px-4 py-2 border-b border-gray-800 text-xs text-gray-600 font-medium">
            <span>Category</span>
            <span className="text-right">Allocated</span>
            <span className="text-right">Actual</span>
            <span className="text-right">Variance</span>
            <span></span>
          </div>
          {visible.map((b, idx) => {
            const pct = b.allocated > 0 ? Math.min(100, (b.actual / b.allocated) * 100) : 0;
            return (
              <div key={b.id} className={`px-4 py-3 ${idx < visible.length - 1 ? 'border-b border-gray-800/60' : ''}`}>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="font-medium text-gray-200 flex-1">{b.category}</span>
                  <span className="text-sm text-indigo-300 tabular-nums">${(b.allocated || 0).toFixed(2)}</span>
                  <span className={`text-sm tabular-nums ${(b.actual || 0) > (b.allocated || 0) ? 'text-red-400' : 'text-emerald-400'}`}>
                    ${(b.actual || 0).toFixed(2)}
                  </span>
                  <VarianceBadge variance={(b.allocated || 0) - (b.actual || 0)} />
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditTarget(b); setAddOpen(true); }} className="btn-ghost text-xs py-0.5 px-1.5">✏</button>
                      <button onClick={() => setDeleteTarget(b)} className="btn-ghost text-xs py-0.5 px-1.5 text-red-500">✕</button>
                    </div>
                  )}
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-0.5">{pct.toFixed(0)}% used</p>
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
