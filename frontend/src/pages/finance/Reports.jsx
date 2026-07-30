import React, { useState, useEffect, useCallback } from 'react';
import { getBalanceSheet, getBudgetVsActual, getDonationsReport, getTransactions } from '../../lib/api';
import { useToast } from '../../App';

// ── CSV helpers ───────────────────────────────────────────────────────────────
function toCSV(rows, headers) {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return lines.join('\n');
}

function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Section component ─────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/40">
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stat({ label, value, color = 'text-gray-200' }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

export default function Reports() {
  const toast = useToast();
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [budgetReport, setBudgetReport] = useState([]);
  const [donationsReport, setDonationsReport] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getBalanceSheet(), getBudgetVsActual(), getDonationsReport(), getTransactions()])
      .then(([bs, bv, dr, txns]) => {
        setBalanceSheet(bs);
        setBudgetReport(bv);
        setDonationsReport(dr);
        setTransactions(txns);
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── CSV exports ─────────────────────────────────────────────────────────────
  const exportTransactions = () => {
    const headers = ['date', 'type', 'description', 'category', 'amount', 'receiptUrl'];
    const csv = toCSV(
      transactions.map((t) => ({
        date: new Date(t.date).toLocaleDateString(),
        type: t.type,
        description: t.description,
        category: t.category || '',
        amount: t.amount.toFixed(2),
        receiptUrl: t.receiptUrl || '',
      })),
      headers
    );
    downloadCSV('transactions.csv', csv);
    toast('Transactions exported', 'success');
  };

  const exportBudgetVsActual = () => {
    const headers = ['category', 'year', 'month', 'allocated', 'actual', 'variance'];
    const csv = toCSV(
      budgetReport.map((b) => ({
        category: b.category,
        year: b.year,
        month: b.month ?? 'Annual',
        allocated: (b.allocated || 0).toFixed(2),
        actual: (b.actual || 0).toFixed(2),
        variance: ((b.allocated || 0) - (b.actual || 0)).toFixed(2),
      })),
      headers
    );
    downloadCSV('budget-vs-actual.csv', csv);
    toast('Budget report exported', 'success');
  };

  const exportDonations = () => {
    if (!donationsReport) return;
    const rows = [];
    // Prefer per-fundraiser donations arrays from the API
    (donationsReport.fundraisers || []).forEach((f) => {
      (f.donations || []).forEach((d) => {
        rows.push({
          fundraiser: f.name,
          donor: d.donor || (d.isQuickTotal ? (d.label || 'Daily total') : 'Anonymous'),
          amount: Number(d.amount || 0).toFixed(2),
          date: d.date ? new Date(d.date).toLocaleDateString() : '',
          notes: d.notes || '',
        });
      });
    });
    if (rows.length === 0) {
      toast('No donation entries to export', 'info');
      return;
    }
    const csv = toCSV(rows, ['fundraiser', 'donor', 'amount', 'date', 'notes']);
    downloadCSV('donations.csv', csv);
    toast('Donations exported', 'success');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-gray-600">Loading reports…</div>;
  }

  // P&L breakdown by type
  const breakdown = balanceSheet?.breakdown || {};
  const INCOME_TYPES = new Set(['Donation', 'FundraiserIncome']);
  const incomeBreakdown = Object.entries(breakdown).filter(([k]) => INCOME_TYPES.has(k));
  const expenseBreakdown = Object.entries(breakdown).filter(([k]) => !INCOME_TYPES.has(k));

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-100">Reports</h2>
      </div>

      {/* Export buttons */}
      <Section title="📥 Export">
        <div className="flex flex-wrap gap-3">
          <button onClick={exportTransactions} className="btn-secondary text-sm">
            ⬇ Transactions CSV
          </button>
          <button onClick={exportBudgetVsActual} className="btn-secondary text-sm" disabled={budgetReport.length === 0}>
            ⬇ Budget vs Actual CSV
          </button>
          <button onClick={exportDonations} className="btn-secondary text-sm" disabled={!donationsReport}>
            ⬇ Donations CSV
          </button>
        </div>
      </Section>

      {/* Balance Sheet */}
      {balanceSheet && (
        <Section title="📋 Balance Sheet">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-800/40 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Total Income</p>
              <p className="text-2xl font-bold text-emerald-400">${balanceSheet.totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
              <p className="text-2xl font-bold text-red-400">${balanceSheet.totalExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800/40 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Net Balance</p>
              <p className={`text-2xl font-bold ${balanceSheet.netBalance >= 0 ? 'text-indigo-300' : 'text-red-400'}`}>
                ${balanceSheet.netBalance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* P&L breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Income Breakdown</p>
              {incomeBreakdown.length > 0 ? incomeBreakdown.map(([type, amt]) => (
                <Stat key={type} label={type} value={`$${amt.toFixed(2)}`} color="text-emerald-400" />
              )) : <p className="text-xs text-gray-600">No income recorded</p>}
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Expense Breakdown</p>
              {expenseBreakdown.length > 0 ? expenseBreakdown.map(([type, amt]) => (
                <Stat key={type} label={type} value={`$${amt.toFixed(2)}`} color="text-red-400" />
              )) : <p className="text-xs text-gray-600">No expenses recorded</p>}
            </div>
          </div>
        </Section>
      )}

      {/* Budget vs Actual summary */}
      {budgetReport.length > 0 && (
        <Section title="📊 Budget vs Actual Summary">
          <div className="space-y-0">
            {budgetReport.map((b) => {
              const variance = (b.allocated || 0) - (b.actual || 0);
              const pct = b.allocated > 0 ? Math.min(100, ((b.actual || 0) / b.allocated) * 100) : 0;
              return (
                <div key={b.id} className="py-2 border-b border-gray-800/50 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-300 flex-1">{b.category}</span>
                    <span className="text-xs text-gray-500">${(b.actual || 0).toFixed(2)} / ${(b.allocated || 0).toFixed(2)}</span>
                    <span className={`text-xs font-medium ${variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {variance >= 0 ? `+$${variance.toFixed(2)}` : `-$${Math.abs(variance).toFixed(2)}`}
                    </span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Donation summary */}
      {donationsReport && (
        <Section title="🏆 Donation Summary">
          <div className="mb-3">
            <p className="text-2xl font-bold text-emerald-400">${donationsReport.totalDonations.toFixed(2)}</p>
            <p className="text-xs text-gray-500">total across all fundraisers</p>
          </div>
          {donationsReport.fundraisers.map((f) => (
            <div key={f.id} className="flex items-center gap-3 py-2 border-b border-gray-800/50 last:border-0">
              <div className="flex-1">
                <p className="text-sm text-gray-300">{f.name}</p>
                <p className="text-xs text-gray-600">{new Date(f.date).toLocaleDateString()} · {f.donationCount} donation{f.donationCount !== 1 ? 's' : ''}</p>
              </div>
              <span className="text-sm font-semibold text-emerald-400">${f.actualAmount.toFixed(2)}</span>
              {f.targetAmount > 0 && (
                <span className="text-xs text-gray-600">/ ${f.targetAmount.toFixed(2)}</span>
              )}
            </div>
          ))}
          {donationsReport.fundraisers.length === 0 && (
            <p className="text-xs text-gray-600">No fundraisers recorded yet</p>
          )}
        </Section>
      )}
    </div>
  );
}
