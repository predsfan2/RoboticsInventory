import React from 'react';
import { formatMoney } from './formatMoney';

export default function MoneyStat({ label, value, color = 'text-gray-100', hint }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1.5">{label}</p>
      <p className={`text-xl md:text-2xl font-bold tabular-nums ${color}`}>
        {typeof value === 'number' ? formatMoney(value) : value}
      </p>
      {hint != null && hint !== '' && (
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      )}
    </div>
  );
}
