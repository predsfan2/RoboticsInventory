import React, { useState } from 'react';
import { useAuth } from '../App';
import Transactions from './finance/Transactions';
import Budget from './finance/Budget';
import SavingsGoals from './finance/SavingsGoals';
import Reimbursements from './finance/Reimbursements';
import Fundraisers from './finance/Fundraisers';
import Reports from './finance/Reports';

const TABS = [
  { id: 'transactions', label: 'Transactions', icon: '💳' },
  { id: 'budget',       label: 'Budget',       icon: '📊' },
  { id: 'goals',        label: 'Savings Goals', icon: '🎯' },
  { id: 'reimburse',    label: 'Reimbursements', icon: '💸' },
  { id: 'fundraisers',  label: 'Fundraisers',  icon: '🏆' },
  { id: 'reports',      label: 'Reports',      icon: '📄' },
];

export default function Finance() {
  const { user } = useAuth();
  const [tab, setTab] = useState('transactions');

  const canFinance = ['Admin', 'Manager', 'Accounting Admin'].includes(user?.role);
  if (!canFinance) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-2">
        <span className="text-4xl">🔒</span>
        <p>Finance is restricted to Managers and Admins.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-nav */}
      <div className="border-b border-gray-800 bg-gray-900/60 px-4 flex overflow-x-auto gap-1 flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'transactions' && <Transactions />}
        {tab === 'budget'       && <Budget />}
        {tab === 'goals'        && <SavingsGoals />}
        {tab === 'reimburse'    && <Reimbursements />}
        {tab === 'fundraisers'  && <Fundraisers />}
        {tab === 'reports'      && <Reports />}
      </div>
    </div>
  );
}
