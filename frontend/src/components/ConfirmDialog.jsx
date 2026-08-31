import React, { useEffect } from 'react';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm', cancelLabel = 'Cancel', dangerous = false, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-panel max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-2">{title}</h2>
        {message && <p className="text-sm text-gray-400 mb-4">{message}</p>}
        {children}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="btn-secondary">{cancelLabel}</button>
          <button onClick={onConfirm} className={dangerous ? 'btn-danger' : 'btn-primary'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
