import React from 'react';

export default function FinanceEmpty({ title = 'Nothing here yet', description }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <p className="text-sm font-medium text-gray-400">{title}</p>
      {description && <p className="text-xs text-gray-600 mt-1 max-w-sm">{description}</p>}
    </div>
  );
}
