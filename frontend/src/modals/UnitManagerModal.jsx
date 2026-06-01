import React, { useState, useEffect } from 'react';
import { updateUnit } from '../lib/api';
import { useToast } from '../App';
import { CONDITIONS, CONDITION_COLORS } from '../lib/constants';

export default function UnitManagerModal({ unit, onClose, onSuccess }) {
  const toast = useToast();
  const [form, setForm] = useState({
    condition: unit.condition || 'Good',
    conditionNote: '',
    currentLocation: unit.currentLocation || '',
    currentPerson: unit.currentPerson || '',
  });
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
      await updateUnit(unit.id, form);
      onSuccess?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Edit Unit</h2>
            <p className="text-xs text-gray-500 font-mono">{unit.unitSku}</p>
          </div>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>

        {/* Condition log */}
        {unit.conditionLog?.length > 0 && (
          <div className="mb-4 bg-gray-800/40 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2 font-medium">Condition History</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {[...unit.conditionLog].reverse().map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={CONDITION_COLORS[e.condition] || ''}>{e.condition}</span>
                  <span className="text-gray-500 flex-1 truncate">{e.note}</span>
                  <span className="text-gray-600">{new Date(e.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Condition</label>
            <select className="input" value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}>
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Condition Note</label>
            <input className="input" placeholder="Optional note…" value={form.conditionNote} onChange={(e) => setForm((f) => ({ ...f, conditionNote: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Location</label>
            <input className="input" value={form.currentLocation} onChange={(e) => setForm((f) => ({ ...f, currentLocation: e.target.value }))} placeholder="Location" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Assigned Person</label>
            <input className="input" value={form.currentPerson} onChange={(e) => setForm((f) => ({ ...f, currentPerson: e.target.value }))} placeholder="Person" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Unit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
