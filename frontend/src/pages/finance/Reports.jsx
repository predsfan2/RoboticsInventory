import React, { useState, useEffect, useCallback } from 'react';
import { getBalanceSheet, getBudgetVsActual, getDonationsReport, getTransactions } from '../../lib/api';
import { useToast } from '../../App';
import {
  formatMoney, MoneyStat, FinanceProgress, FinancePageHeader, FinanceEmpty,
} from '../../components/finance';

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

function Section({ title, children, className = '' }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-gray-800 bg-gray-800/40">
        <h3 className="text-base font-semibold text-gray-200">{title}</h3>
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
    return <div className="flex items-center justify-center h-40 text-gray-500 text-sm">Loading reports…</div>;
  }

  const breakdown = balanceSheet?.breakdown || {};
  const INCOME_TYPES = new Set(['Donation', 'FundraiserIncome']);
  const incomeBreakdown = Object.entries(breakdown).filter(([k]) => INCOME_TYPES.has(k));
  const expenseBreakdown = Object.entries(breakdown).filter(([k]) => !INCOME_TYPES.has(k));

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <FinancePageHeader title="Reports">
        <button type="button" onClick={exportTransactions} className="btn-secondary text-sm">
          Export Transactions
        </button>
        <button
          type="button"
          onClick={exportBudgetVsActual}
          className="btn-secondary text-sm"
          disabled={budgetReport.length === 0}
        >
          Export Budget
        </button>
        <button
          type="button"
          onClick={exportDonations}
          className="btn-secondary text-sm"
          disabled={!donationsReport}
        >
          Export Donations
        </button>
      </FinancePageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {balanceSheet && (
          <Section title="Balance Sheet">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <MoneyStat label="Income" value={balanceSheet.totalIncome} color="text-emerald-400" />
              <MoneyStat label="Expenses" value={balanceSheet.totalExpenses} color="text-red-400" />
              <MoneyStat
                label="Net"
                value={balanceSheet.netBalance}
                color={balanceSheet.netBalance >= 0 ? 'text-indigo-300' : 'text-red-400'}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Income</p>
                {incomeBreakdown.length > 0 ? incomeBreakdown.map(([type, amt]) => (
                  <Stat key={type} label={type} value={formatMoney(amt)} color="text-emerald-400" />
                )) : <p className="text-xs text-gray-600">No income recorded</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Expenses</p>
                {expenseBreakdown.length > 0 ? expenseBreakdown.map(([type, amt]) => (
                  <Stat key={type} label={type} value={formatMoney(amt)} color="text-red-400" />
                )) : <p className="text-xs text-gray-600">No expenses recorded</p>}
              </div>
            </div>
          </Section>
        )}

        {donationsReport && (
          <Section title="Donation Summary">
            <div className="mb-4">
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">
                {formatMoney(donationsReport.totalDonations)}
              </p>
              <p className="text-xs text-gray-500 mt-1">total across all fundraisers</p>
            </div>
            {donationsReport.fundraisers.length === 0 ? (
              <FinanceEmpty title="No fundraisers recorded yet" />
            ) : (
              <div className="space-y-0">
                {donationsReport.fundraisers.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 py-2.5 border-b border-gray-800/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{f.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(f.date).toLocaleDateString()} · {f.donationCount} donation{f.donationCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                        {formatMoney(f.actualAmount)}
                      </span>
                      {f.targetAmount > 0 && (
                        <p className="text-xs text-gray-600 tabular-nums">of {formatMoney(f.targetAmount)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
      </div>

      {budgetReport.length > 0 && (
        <Section title="Budget vs Actual">
          <div className="space-y-4">
            {budgetReport.map((b) => {
              const variance = (b.allocated || 0) - (b.actual || 0);
              return (
                <div key={b.id} className="pb-4 border-b border-gray-800/50 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-200 flex-1">{b.category}</span>
                    <span className={`text-xs font-medium tabular-nums ${variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {variance >= 0 ? `${formatMoney(variance)} under` : `${formatMoney(Math.abs(variance))} over`}
                    </span>
                  </div>
                  <FinanceProgress
                    current={b.actual || 0}
                    target={b.allocated || 0}
                    showRemaining={false}
                    overColor="bg-red-500"
                    completeColor="bg-red-500"
                    midColor="bg-amber-500"
                    lowColor="bg-indigo-500"
                    height="h-1.5"
                  />
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
