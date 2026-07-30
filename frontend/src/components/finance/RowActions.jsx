import React, { useState, useEffect, useRef } from 'react';

/**
 * Overflow menu for secondary row actions (Edit / Delete).
 * actions: [{ label, onClick, danger?: boolean }]
 */
export default function RowActions({ actions = [], label = 'Actions' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!actions.length) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost text-sm py-1 px-2 text-gray-400"
        aria-label={label}
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[8rem] card py-1 shadow-xl border border-gray-700">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                setOpen(false);
                a.onClick?.();
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-gray-800 ${
                a.danger ? 'text-red-400' : 'text-gray-200'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
