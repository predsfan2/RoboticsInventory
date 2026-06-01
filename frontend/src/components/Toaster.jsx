import React from 'react';

const ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const COLORS = {
  success: 'bg-emerald-900 border-emerald-700 text-emerald-200',
  error: 'bg-red-900 border-red-700 text-red-200',
  info: 'bg-gray-800 border-gray-700 text-gray-200',
  warning: 'bg-amber-900 border-amber-700 text-amber-200',
};

const ICON_COLORS = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-gray-400',
  warning: 'text-amber-400',
};

export default function Toaster({ toasts, dismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl text-sm animate-in slide-in-from-right ${COLORS[t.type] || COLORS.info}`}
          style={{ animation: 'slideInRight 0.2s ease-out' }}
        >
          <span className={`text-base font-bold mt-0.5 ${ICON_COLORS[t.type] || ICON_COLORS.info}`}>
            {ICONS[t.type] || ICONS.info}
          </span>
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="opacity-60 hover:opacity-100 transition-opacity ml-1 mt-0.5"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
