import React, { useState, useEffect } from 'react';
import { createMoveRequest } from '../lib/api';
import LocationSelect from '../components/LocationSelect';

export default function MoveRequestModal({ item, locations, onClose, onSuccess }) {
  const toast = useToast();
  const [form, setForm] = useState({
    requestedLocation: '',
    requestedPerson: '',
    notes: '',
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
      await createMoveRequest(item.id, form);
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
          <h2 className="text-lg font-semibold">Request Move</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Requesting move for <span className="text-gray-200 font-medium">{item.name}</span>
          {item.currentLocation && <span className="text-gray-500"> from {item.currentLocation}</span>}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Requested Location</label>
            <LocationSelect
              locations={locations}
              value={form.requestedLocation}
              onChange={(v) => setForm((f) => ({ ...f, requestedLocation: v }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Assign To Person</label>
            <input
              className="input"
              placeholder="Name (optional)"
              value={form.requestedPerson}
              onChange={(e) => setForm((f) => ({ ...f, requestedPerson: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Reason for move…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
