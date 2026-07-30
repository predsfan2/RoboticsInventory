import React, { useState, useEffect, useCallback } from 'react';
import {
  getCustomFields, createCustomFields, updateCustomFields, deleteCustomFields,
} from '../lib/api';
import { useToast } from '../App';
import { CATEGORIES } from '../lib/constants';
import ConfirmDialog from '../components/ConfirmDialog';

const FIELD_TYPES = ['text', 'number', 'select'];

function emptyField() {
  return { name: '', type: 'text', label: '', options: [] };
}

function FieldEditor({ fields, onChange }) {
  const setField = (i, k, v) => {
    onChange(fields.map((f, idx) => (idx === i ? { ...f, [k]: v } : f)));
  };

  const addField = () => onChange([...fields, emptyField()]);
  const removeField = (i) => onChange(fields.filter((_, idx) => idx !== i));

  const setOptions = (i, raw) => {
    const options = raw.split(',').map((s) => s.trim()).filter(Boolean);
    setField(i, 'options', options);
  };

  return (
    <div className="space-y-3">
      {fields.map((f, i) => (
        <div key={i} className="bg-gray-800/50 rounded-lg p-3 space-y-2 border border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500 font-medium">Field {i + 1}</span>
            <button type="button" onClick={() => removeField(i)} className="btn-ghost text-xs text-red-500 py-0.5 px-1.5">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Key (name) *</label>
              <input
                className="input text-sm"
                value={f.name}
                onChange={(e) => setField(i, 'name', e.target.value.replace(/\s+/g, '_').toLowerCase())}
                placeholder="e.g. voltage"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Label *</label>
              <input
                className="input text-sm"
                value={f.label}
                onChange={(e) => setField(i, 'label', e.target.value)}
                placeholder="e.g. Voltage"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select className="input text-sm" value={f.type} onChange={(e) => setField(i, 'type', e.target.value)}>
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {f.type === 'select' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Options (comma-separated)</label>
                <input
                  className="input text-sm"
                  value={(f.options || []).join(', ')}
                  onChange={(e) => setOptions(i, e.target.value)}
                  placeholder="A, B, C"
                />
              </div>
            )}
          </div>
        </div>
      ))}
      <button type="button" onClick={addField} className="btn-secondary text-xs">+ Add Field</button>
    </div>
  );
}

function DefinitionModal({ initial, usedCategories, onSave, onClose }) {
  const toast = useToast();
  const [category, setCategory] = useState(initial?.category || '');
  const [fields, setFields] = useState(
    initial?.fields?.length
      ? initial.fields.map((f) => ({ ...f, options: f.options || [] }))
      : [emptyField()]
  );
  const [saving, setSaving] = useState(false);

  const availableCategories = CATEGORIES.filter(
    (c) => c === initial?.category || !usedCategories.includes(c)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleaned = fields
      .filter((f) => f.name.trim() && f.label.trim())
      .map((f) => ({
        name: f.name.trim(),
        type: f.type || 'text',
        label: f.label.trim(),
        ...(f.type === 'select' ? { options: f.options || [] } : {}),
      }));
    if (!category) { toast('Select a category', 'error'); return; }
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
      <div className="modal-panel max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{initial ? 'Edit Custom Fields' : 'New Custom Fields'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Category *</label>
            <select className="input" required value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select…</option>
              {availableCategories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Fields</p>
            <FieldEditor fields={fields} onChange={setFields} />
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

export default function CustomFields() {
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

  const handleDelete = async () => {
    try {
      await deleteCustomFields(deleteTarget.id);
      toast('Custom fields deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const usedCategories = defs.map((d) => d.category);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Custom Fields</h1>
          <p className="text-xs text-gray-500 mt-0.5">Define extra fields per inventory category</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary">+ New Definition</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : defs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">🧩</span>
          <p>No custom field definitions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {defs.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-gray-100">{d.category}</h3>
                  <p className="text-xs text-gray-500">{(d.fields || []).length} field{(d.fields || []).length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setEditTarget(d)} className="btn-secondary text-xs py-1 px-2">Edit</button>
                  <button onClick={() => setDeleteTarget(d)} className="btn-ghost text-xs text-red-500">✕</button>
                </div>
              </div>
              <div className="space-y-1">
                {(d.fields || []).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-gray-800/50 last:border-0">
                    <span className="text-gray-300 flex-1">{f.label || f.name}</span>
                    <span className="text-xs text-gray-600 font-mono">{f.name}</span>
                    <span className="badge bg-gray-800 text-gray-400 border border-gray-700 text-xs">{f.type}</span>
                    {f.type === 'select' && f.options?.length > 0 && (
                      <span className="text-xs text-gray-600 truncate max-w-[120px]">{f.options.join(', ')}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <DefinitionModal
          usedCategories={usedCategories}
          onSave={async (body) => {
            await createCustomFields(body);
            toast('Custom fields created', 'success');
            load();
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editTarget && (
        <DefinitionModal
          initial={editTarget}
          usedCategories={usedCategories}
          onSave={async (body) => {
            await updateCustomFields(editTarget.id, body);
            toast('Custom fields updated', 'success');
            load();
          }}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Custom Fields"
          message={`Delete custom field definition for "${deleteTarget.category}"? Existing item values are kept but will no longer show in forms.`}
          confirmLabel="Delete"
          dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
