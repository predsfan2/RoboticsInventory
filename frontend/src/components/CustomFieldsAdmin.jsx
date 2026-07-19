import React, { useState, useEffect, useCallback } from 'react';
import {
  getCustomFields, createCustomFields, updateCustomFields, deleteCustomFields,
} from '../lib/api';
import { useToast } from '../App';
import { CATEGORIES } from '../lib/constants';
import ConfirmDialog from './ConfirmDialog';

function FieldDefForm({ initial, onSave, onClose }) {
  const toast = useToast();
  const [category, setCategory] = useState(initial?.category || '');
  const [fields, setFields] = useState(
    Array.isArray(initial?.fields) && initial.fields.length
      ? initial.fields.map((f) => (
        typeof f === 'string'
          ? { key: f, label: f, type: 'text' }
          : { key: f.key || f.label || '', label: f.label || f.key || '', type: f.type || 'text' }
      ))
      : [{ key: '', label: '', type: 'text' }]
  );
  const [saving, setSaving] = useState(false);

  const setField = (i, k, v) => {
    setFields((fs) => fs.map((f, idx) => {
      if (idx !== i) return f;
      const next = { ...f, [k]: v };
      if (k === 'label' && !initial) {
        next.key = v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      }
      return next;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category) { toast('Select a category', 'error'); return; }
    const cleaned = fields
      .map((f) => ({
        key: (f.key || f.label || '').trim(),
        label: (f.label || f.key || '').trim(),
        type: f.type === 'number' ? 'number' : 'text',
      }))
      .filter((f) => f.key && f.label);
    if (!cleaned.length) { toast('Add at least one field', 'error'); return; }
    setSaving(true);
    try {
      await onSave({ category, fields: cleaned });
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{initial ? 'Edit Custom Fields' : 'Custom Fields for Category'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Category *</label>
            <select className="input" required value={category} onChange={(e) => setCategory(e.target.value)} disabled={!!initial}>
              <option value="">Select…</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-gray-400">Fields</p>
            {fields.map((f, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className="input flex-1"
                  placeholder="Label"
                  value={f.label}
                  onChange={(e) => setField(i, 'label', e.target.value)}
                />
                <select className="input w-24" value={f.type} onChange={(e) => setField(i, 'type', e.target.value)}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                </select>
                <button
                  type="button"
                  className="btn-ghost text-red-500 text-xs"
                  onClick={() => setFields((fs) => fs.filter((_, idx) => idx !== i))}
                  disabled={fields.length <= 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setFields((fs) => [...fs, { key: '', label: '', type: 'text' }])}
            >
              + Field
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomFieldsAdmin() {
  const toast = useToast();
  const [defs, setDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getCustomFields()
      .then(setDefs)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mt-6 card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom Fields by Category</p>
          <p className="text-xs text-gray-600 mt-0.5">Extra fields shown when creating or editing items in that category.</p>
        </div>
        <button onClick={() => { setEditTarget(null); setAddOpen(true); }} className="btn-primary text-xs">+ Define</button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600 py-4">Loading…</p>
      ) : defs.length === 0 ? (
        <p className="text-sm text-gray-600 py-4">No custom field definitions yet.</p>
      ) : (
        <div className="space-y-2">
          {defs.map((d) => (
            <div key={d.id} className="flex items-start gap-3 bg-gray-800/40 rounded-lg px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200">{d.category}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(d.fields || []).map((f) => (typeof f === 'string' ? f : f.label || f.key)).join(' · ') || 'No fields'}
                </p>
              </div>
              <button onClick={() => setEditTarget(d)} className="btn-ghost text-xs py-0.5 px-1.5">Edit</button>
              <button onClick={() => setDeleteTarget(d)} className="btn-ghost text-xs py-0.5 px-1.5 text-red-500">✕</button>
            </div>
          ))}
        </div>
      )}

      {(addOpen || editTarget) && (
        <FieldDefForm
          initial={editTarget}
          onSave={async (body) => {
            if (editTarget) {
              await updateCustomFields(editTarget.id, body);
              toast('Custom fields updated', 'success');
            } else {
              await createCustomFields(body);
              toast('Custom fields created', 'success');
            }
            load();
          }}
          onClose={() => { setAddOpen(false); setEditTarget(null); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Custom Fields"
          message={`Remove custom field definitions for "${deleteTarget.category}"? Existing values on items are kept.`}
          confirmLabel="Delete"
          dangerous
          onConfirm={async () => {
            try {
              await deleteCustomFields(deleteTarget.id);
              toast('Deleted', 'success');
              setDeleteTarget(null);
              load();
            } catch (e) {
              toast(e.message, 'error');
            }
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

/** Resolve field defs for a category into {key,label,type}[]. */
export function normalizeFieldDefs(defs, category) {
  const def = (defs || []).find((d) => d.category === category);
  if (!def) return [];
  return (def.fields || []).map((f) => (
    typeof f === 'string'
      ? { key: f, label: f, type: 'text' }
      : { key: f.key || f.label, label: f.label || f.key, type: f.type || 'text' }
  )).filter((f) => f.key);
}
