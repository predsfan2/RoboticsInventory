import React from 'react';

export default function FinancePageHeader({ title, badge, children }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <h2 className="text-lg font-bold text-gray-100 truncate">{title}</h2>
        {badge}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
