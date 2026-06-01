import React, { useState, useEffect } from 'react';
import { updateCondition } from '../lib/api';
import { useToast } from '../App';
import { CONDITIONS } from '../lib/constants';

export default function ConditionUpdateModal({ item, onClose, onSuccess }) {
  const toast = useToast();
  const [condition, setCondition] = useState(item.condition || 'Good');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCondition(item.id, condition, note);
      onSuccess?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const COND_STYLES = {
    New: 'border-blue-600 bg-blue-900/30 text-blue-300',
    Good: 'border-emerald-600 bg-emerald-900/30 text-emerald-300',
    Fair: 'border-amber-600 bg-amber-900/30 text-amber-300',
    Poor: 'border-red-600 bg-red-900/30 text-red-300',
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Update Condition</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <p className="text-sm text-gray-400 mb-4">{item.name}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Condition selector */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">New Condition</label>
            <div className="grid grid-cols-2 gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    condition === c
                      ? COND_STYLES[c]
                      : 'border-gray-700 text-gray-500 hover:border-gray-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Note</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Describe the condition…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
