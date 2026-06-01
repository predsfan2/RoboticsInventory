import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Pie, Line, Bar } from 'react-chartjs-2';
import {
  getItems, getMoveRequests, getBorrows,
  getBalance, getTransactions, getBudgets,
} from '../lib/api';
import { useAuth, useToast } from '../App';
import { hasPermission } from '../lib/permissions';
import { CONDITION_COLORS } from '../lib/constants';

ChartJS.register(
  ArcElement, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Tooltip, Legend, Filler
);

const AXIS_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11 } } } },
  scales: {
    x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: '#1f2937' } },
    y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: '#1f2937' }, beginAtZero: true },
  },
};
const PIE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11 } } } },
};

function StatCard({ icon, label, value, sub, color = 'indigo' }) {
  const ring = { indigo: 'ring-indigo-700/30', amber: 'ring-amber-700/30', red: 'ring-red-700/30', emerald: 'ring-emerald-700/30', blue: 'ring-blue-700/30' };
  const text = { indigo: 'text-indigo-400', amber: 'text-amber-400', red: 'text-red-400', emerald: 'text-emerald-400', blue: 'text-blue-400' };
  return (
    <div className={`card p-4 ring-1 ${ring[color] || ring.indigo}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${text[color] || text.indigo}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

const INCOME_TYPES = new Set(['Donation', 'FundraiserIncome']);

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const canFinance = hasPermission(user, 'finance.view');
  const canInventory = hasPermission(user, 'inventory.view');

  const [items, setItems] = useState([]);
  const [moveRequests, setMoveRequests] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);

  useEffect(() => {
    const fetches = [
      canInventory ? getItems() : Promise.resolve([]),
      hasPermission(user, 'approvals.manage') ? getMoveRequests('pending') : Promise.resolve([]),
      canInventory ? getBorrows() : Promise.resolve([]),
    ];
    if (canFinance) {
      fetches.push(getBalance(), getTransactions(), getBudgets());
    }
    Promise.all(fetches)
      .then(([it, mr, bo, bal, txns, bud]) => {
        setItems(it || []);
        setMoveRequests(mr || []);
        setBorrows(bo || []);
        if (bal)  setBalance(bal);
        if (txns) setTransactions(txns);
        if (bud)  setBudgets(bud);
      })
      .catch((e) => toast(e.message, 'error'));
  }, [canFinance, canInventory]);

  const now = new Date();
  const lowStock = items.filter((i) => i.minStock > 0 && i.totalQty <= i.minStock);
  const overdueBorrows = borrows.filter(
    (b) => b.status === 'active' && b.expectedReturnDate && new Date(b.expectedReturnDate) < now
  );

  // ── Inventory charts ──────────────────────────────────────────────────────
  const condCounts = { New: 0, Good: 0, Fair: 0, Poor: 0 };
  items.forEach((i) => { if (condCounts[i.condition] !== undefined) condCounts[i.condition]++; });
  const pieData = {
    labels: Object.keys(condCounts),
    datasets: [{ data: Object.values(condCounts), backgroundColor: ['#1d4ed8', '#059669', '#d97706', '#dc2626'], borderWidth: 1 }],
  };

  const catCounts = {};
  items.forEach((i) => { catCounts[i.category || 'Other'] = (catCounts[i.category || 'Other'] || 0) + 1; });
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const barData = {
    labels: sortedCats.map(([k]) => k),
    datasets: [{ label: 'Items', data: sortedCats.map(([, v]) => v), backgroundColor: '#4f46e5', borderRadius: 4 }],
  };

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (29 - i)); return d.toISOString().slice(0, 10);
  });
  const dayCounts = Object.fromEntries(days.map((d) => [d, 0]));
  items.forEach((i) => { const d = (i.createdAt || '').slice(0, 10); if (dayCounts[d] !== undefined) dayCounts[d]++; });
  const lineData = {
    labels: days.map((d) => d.slice(5)),
    datasets: [{ label: 'Items Added', data: days.map((d) => dayCounts[d]), borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)', tension: 0.3, fill: true, pointRadius: 2 }],
  };

  // ── Finance analytics ─────────────────────────────────────────────────────
  // Spending by category (expense transactions)
  const spendByCategory = {};
  transactions.forEach((t) => {
    if (!INCOME_TYPES.has(t.type) && t.category) {
      spendByCategory[t.category] = (spendByCategory[t.category] || 0) + (t.amount || 0);
    }
  });
  const spendCats = Object.entries(spendByCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const spendBarData = {
    labels: spendCats.map(([k]) => k),
    datasets: [{ label: 'Spent ($)', data: spendCats.map(([, v]) => v), backgroundColor: '#dc2626', borderRadius: 4 }],
  };

  // Income vs expenses monthly (last 6 months)
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7); // "2025-01"
  });
  const monthIncome  = Object.fromEntries(monthLabels.map((m) => [m, 0]));
  const monthExpense = Object.fromEntries(monthLabels.map((m) => [m, 0]));
  transactions.forEach((t) => {
    const m = (t.date || '').slice(0, 7);
    if (monthIncome[m] !== undefined) {
      if (INCOME_TYPES.has(t.type)) monthIncome[m]  += t.amount || 0;
      else                           monthExpense[m] += t.amount || 0;
    }
  });
  const incomeExpenseData = {
    labels: monthLabels.map((m) => { const [y, mo] = m.split('-'); return new Date(y, mo - 1).toLocaleString('default', { month: 'short', year: '2-digit' }); }),
    datasets: [
      { label: 'Income',   data: monthLabels.map((m) => monthIncome[m]),  backgroundColor: '#059669', borderRadius: 4 },
      { label: 'Expenses', data: monthLabels.map((m) => monthExpense[m]), backgroundColor: '#dc2626', borderRadius: 4 },
    ],
  };

  // Budget utilization
  const now_year  = now.getFullYear();
  const now_month = now.getMonth() + 1;
  const currentBudgets = budgets.filter((b) => b.year === now_year && (b.month == null || b.month === now_month));
  const totalAllocated = currentBudgets.reduce((s, b) => s + (b.allocated || 0), 0);
  const totalActual    = currentBudgets.reduce((s, b) => s + (b.actual    || 0), 0);

  // Recent transactions
  const recentTxns = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-bold text-gray-100">Dashboard</h1>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {canInventory && (
          <>
            <StatCard icon="📦" label="Total Items" value={items.length} sub={`${items.reduce((s, i) => s + i.totalQty, 0)} units`} color="indigo" />
            <StatCard icon="⚠" label="Low Stock" value={lowStock.length} sub="below minimum" color="amber" />
          </>
        )}
        {hasPermission(user, 'approvals.manage') && (
          <StatCard icon="📋" label="Pending Moves" value={moveRequests.length} color="red" />
        )}
        {canFinance && balance && (
          <>
            <StatCard icon="💰" label="Net Balance" value={`$${balance.balance.toFixed(0)}`} sub={`$${balance.income.toFixed(0)} income`} color="emerald" />
            <StatCard icon="📊" label="Budget Used" value={totalAllocated > 0 ? `${Math.round((totalActual / totalAllocated) * 100)}%` : '—'} sub={`$${totalActual.toFixed(0)} / $${totalAllocated.toFixed(0)}`} color="blue" />
          </>
        )}
      </div>

      {/* ── Inventory charts ─────────────────────────────────────────────── */}
      {canInventory && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">Condition Distribution</h2>
              <div className="h-44"><Pie data={pieData} options={PIE_OPTS} /></div>
            </div>
            <div className="card p-4 md:col-span-2">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">Items Added (last 30 days)</h2>
              <div className="h-44"><Line data={lineData} options={AXIS_OPTS} /></div>
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">Items by Category</h2>
            <div className="h-48"><Bar data={barData} options={AXIS_OPTS} /></div>
          </div>
        </>
      )}

      {/* ── Finance analytics ────────────────────────────────────────────── */}
      {canFinance && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-300">Finance Overview</h2>
            <Link to="/finance" className="text-xs text-indigo-400 hover:underline">Open Finance →</Link>
          </div>

          {/* Income vs Expenses (6-month bar) + Spending by category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">Income vs Expenses (6 months)</h2>
              <div className="h-52"><Bar data={incomeExpenseData} options={{ ...AXIS_OPTS, plugins: { ...AXIS_OPTS.plugins, legend: { labels: { color: '#9ca3af', font: { size: 11 } } } } }} /></div>
            </div>
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">Spending by Category</h2>
              {spendCats.length > 0 ? (
                <div className="h-52"><Bar data={spendBarData} options={AXIS_OPTS} /></div>
              ) : (
                <div className="flex items-center justify-center h-52 text-gray-600 text-sm">No expense data</div>
              )}
            </div>
          </div>

          {/* Budget utilization + recent transactions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Budget utilization */}
            {currentBudgets.length > 0 && (
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-300">Budget Utilization</h2>
                  <span className="text-xs text-gray-500">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="p-4 space-y-3">
                  {currentBudgets.slice(0, 5).map((b) => {
                    const pct = b.allocated > 0 ? Math.min(100, ((b.actual || 0) / b.allocated) * 100) : 0;
                    return (
                      <div key={b.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-300">{b.category}</span>
                          <span className={pct >= 100 ? 'text-red-400' : pct >= 80 ? 'text-amber-400' : 'text-gray-500'}>
                            ${(b.actual || 0).toFixed(0)} / ${b.allocated.toFixed(0)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {currentBudgets.length > 5 && (
                    <Link to="/finance" className="block text-xs text-indigo-400 hover:underline text-center pt-1">
                      +{currentBudgets.length - 5} more →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Recent transactions */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-gray-300">Recent Transactions</h2>
                <Link to="/finance" className="text-xs text-indigo-400 hover:underline">View all →</Link>
              </div>
              {recentTxns.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-600">No transactions yet</div>
              ) : (
                recentTxns.map((t) => {
                  const isIncome = INCOME_TYPES.has(t.type);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/50 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{t.description}</p>
                        <p className="text-xs text-gray-600">{new Date(t.date).toLocaleDateString()} · {t.category || t.type}</p>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isIncome ? '+' : '-'}${(t.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Inventory action lists ────────────────────────────────────────── */}
      {canInventory && lowStock.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-amber-400">⚠ Low Stock Items</h2>
            <Link to="/inventory" className="text-xs text-indigo-400 hover:underline">View all →</Link>
          </div>
          {lowStock.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/50 last:border-0">
              <span className="text-xl">📦</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200 truncate">{item.name}</p>
                <p className="text-xs text-gray-500">{item.category}</p>
              </div>
              <span className="text-sm font-semibold text-amber-400">{item.totalQty}/{item.minStock}</span>
            </div>
          ))}
        </div>
      )}

      {canInventory && overdueBorrows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-red-400">🔴 Overdue Borrows</h2>
            <Link to="/borrows" className="text-xs text-indigo-400 hover:underline">View all →</Link>
          </div>
          {overdueBorrows.slice(0, 5).map((b) => {
            const item = items.find((i) => i.id === b.itemId);
            return (
              <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/50 last:border-0">
                <span className="text-xl">📋</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{item?.name || b.itemId}</p>
                  <p className="text-xs text-gray-500">{b.borrowerName}</p>
                </div>
                <span className="text-xs text-red-400">Due {new Date(b.expectedReturnDate).toLocaleDateString()}</span>
              </div>
            );
          })}
        </div>
      )}

      {hasPermission(user, 'approvals.manage') && moveRequests.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300">📋 Pending Move Requests</h2>
            <Link to="/approvals" className="text-xs text-indigo-400 hover:underline">View all →</Link>
          </div>
          {moveRequests.slice(0, 5).map((mr) => {
            const item = items.find((i) => i.id === mr.itemId);
            return (
              <div key={mr.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/50 last:border-0">
                <span className="text-xl">📍</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{item?.name || mr.itemId}</p>
                  <p className="text-xs text-gray-500">→ {mr.requestedLocation} · by {mr.requestedBy}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
