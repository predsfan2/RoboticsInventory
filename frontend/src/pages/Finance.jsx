import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { hasPermission, canAccessFinance } from '../lib/permissions';
import Transactions from './finance/Transactions';
import Budget from './finance/Budget';
import SavingsGoals from './finance/SavingsGoals';
import Reimbursements from './finance/Reimbursements';
import Fundraisers from './finance/Fundraisers';
import Reports from './finance/Reports';

const TABS = [
  {
    id: 'transactions',
    label: 'Transactions',
    canAccess: (user) => hasPermission(user, 'finance.transactions.view'),
  },
  {
    id: 'budget',
    label: 'Budget',
    canAccess: (user) => hasPermission(user, 'finance.budget.view'),
  },
  {
    id: 'goals',
    label: 'Savings Goals',
    canAccess: (user) => hasPermission(user, 'finance.goals.view'),
  },
  {
    id: 'reimburse',
    label: 'Reimbursements',
    canAccess: (user) =>
      hasPermission(user, 'finance.reimbursements.view')
      || hasPermission(user, 'finance.reimbursements.request')
      || hasPermission(user, 'finance.reimbursements.approve'),
  },
  {
    id: 'fundraisers',
    label: 'Fundraisers',
    canAccess: (user) => hasPermission(user, 'finance.fundraisers.view'),
  },
  {
    id: 'reports',
    label: 'Reports',
    canAccess: (user) => hasPermission(user, 'finance.reports.view'),
  },
];

function tabFromPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const sub = parts[1];
  if (sub && TABS.some((t) => t.id === sub)) return sub;
  return null;
}

export default function Finance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const visibleTabs = useMemo(
    () => TABS.filter((t) => t.canAccess(user)),
    [user]
  );

  const pathTab = tabFromPath(location.pathname);
  const [tab, setTab] = useState(() => pathTab || visibleTabs[0]?.id || 'transactions');

  useEffect(() => {
    if (!visibleTabs.length) return;
    const next = pathTab && visibleTabs.some((t) => t.id === pathTab)
      ? pathTab
      : visibleTabs[0].id;
    setTab(next);
    if (pathTab !== next) {
      navigate(`/finance/${next}`, { replace: true });
    }
  }, [location.pathname, visibleTabs, pathTab, navigate]);

  if (!canAccessFinance(user)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-2">
        <p className="text-sm font-medium">Finance is restricted.</p>
      </div>
    );
  }

  if (!visibleTabs.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-2">
        <p className="text-sm font-medium">No finance areas available.</p>
      </div>
    );
  }

  const selectTab = (id) => {
    setTab(id);
    navigate(`/finance/${id}`, { replace: true });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-800 bg-gray-900/60 px-4 flex overflow-x-auto gap-1 flex-shrink-0">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={`px-3.5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'transactions' && <Transactions />}
        {tab === 'budget' && <Budget />}
        {tab === 'goals' && <SavingsGoals />}
        {tab === 'reimburse' && <Reimbursements />}
        {tab === 'fundraisers' && <Fundraisers />}
        {tab === 'reports' && <Reports />}
      </div>
    </div>
  );
}
