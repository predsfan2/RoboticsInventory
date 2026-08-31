import React, { useState, useEffect, useCallback } from 'react';
import {
  getLocations, createLocation, updateLocation, deleteLocation, mergeLocation, getItems,
} from '../lib/api';
import { useToast } from '../App';
import ConfirmDialog from '../components/ConfirmDialog';
import LocationSelect from '../components/LocationSelect';
import { locationLabel, sortLocationsTree } from '../lib/locations';

export default function Locations() {
  const toast = useToast();
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [replacementId, setReplacementId] = useState('');
  const [leaveAsText, setLeaveAsText] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', parentId: '', startDate: '', endDate: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [mergeSource, setMergeSource] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getLocations(), getItems()])
      .then(([locs, its]) => { setLocations(locs); setItems(its); })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const parentIdFromName = (name) => {
    const loc = locations.find((l) => l.name === name);
    return loc ? loc.id : null;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await createLocation({
        name: newName.trim(),
        parentId: parentIdFromName(newParent),
      });
      setNewName('');
      setNewParent('');
      toast('Location added', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (loc) => {
    setEditingId(loc.id);
    const parent = locations.find((l) => l.id === loc.parentId);
    setEditForm({
      name: loc.name,
      parentId: parent ? parent.name : '',
      startDate: loc.startDate || '',
      endDate: loc.endDate || '',
    });
  };

  const handleRename = async (e) => {
    e?.preventDefault();
    if (!editForm.name.trim() || !editingId) return;
    setSavingEdit(true);
    try {
      await updateLocation(editingId, {
        name: editForm.name.trim(),
        parentId: parentIdFromName(editForm.parentId),
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
      });
      toast('Location saved', 'success');
      setEditingId(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteLocation(deleteTarget.id, {
        replacementId: replacementId || undefined,
        leaveAsText: leaveAsText || undefined,
      });
      toast('Location deleted', 'info');
      setDeleteTarget(null);
      setReplacementId('');
      setLeaveAsText(false);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleMerge = async () => {
    try {
      await mergeLocation(mergeSource.id, mergeTargetId);
      toast('Locations merged', 'success');
      setMergeSource(null);
      setMergeTargetId('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const itemCountAt = (locName) => items.filter((i) => i.currentLocation === locName).length;
  const tree = sortLocationsTree(locations);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-100 mb-4">Locations</h1>
      <p className="text-xs text-gray-500 mb-4">
        One-level parent (for example a bin that belongs to Shop). Optional start/end dates hide event locations outside that range.
      </p>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-5">
        <input
          className="input flex-1"
          placeholder="New location name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <LocationSelect
          locations={locations}
          value={newParent}
          onChange={setNewParent}
          emptyLabel="No parent"
          className="input sm:w-48"
        />
        <button type="submit" disabled={adding || !newName.trim()} className="btn-primary">
          {adding ? 'Adding…' : 'Add'}
        </button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : locations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">📍</span>
          <p>No locations defined</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {tree.map((loc, idx) => {
            const count = itemCountAt(loc.name);
            const isEditing = editingId === loc.id;
            return (
              <div key={loc.id} className={`flex items-start gap-3 px-4 py-3 ${idx < tree.length - 1 ? 'border-b border-gray-800' : ''}`} style={{ paddingLeft: 16 + (loc.depth || 0) * 16 }}>
                <span className="text-xl">📍</span>
                {isEditing ? (
                  <form onSubmit={handleRename} className="flex-1 space-y-2">
                    <input className="input text-sm" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
                    <LocationSelect
                      locations={locations.filter((l) => l.id !== loc.id)}
                      value={editForm.parentId}
                      onChange={(v) => setEditForm((f) => ({ ...f, parentId: v }))}
                      emptyLabel="No parent"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" className="input text-sm" value={editForm.startDate} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} />
                      <input type="date" className="input text-sm" value={editForm.endDate} onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={savingEdit || !editForm.name.trim()} className="btn-primary text-xs py-1 px-2">{savingEdit ? '…' : 'Save'}</button>
                      <button type="button" onClick={() => setEditingId(null)} className="btn-secondary text-xs py-1 px-2">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-200">{locationLabel(loc, locations)}</span>
                      {(loc.startDate || loc.endDate) && (
                        <p className="text-xs text-gray-500">{loc.startDate || '…'} → {loc.endDate || '…'}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">{count}</span>
                    <button onClick={() => startEdit(loc)} className="btn-ghost text-xs py-1 px-2">Edit</button>
                    <button onClick={() => { setMergeSource(loc); setMergeTargetId(''); }} className="btn-ghost text-xs py-1 px-2">Merge</button>
                    <button onClick={() => { setDeleteTarget(loc); setReplacementId(''); setLeaveAsText(false); }} className="btn-ghost text-xs py-1 px-2 text-red-500">✕</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Location"
          message={`Delete "${deleteTarget.name}"? Choose a replacement so item counts do not split, or leave the name as free text.`}
          confirmLabel="Delete"
          dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        >
          <div className="space-y-2 mb-3 text-left">
            <label className="block text-xs text-gray-400">Move items to</label>
            <select className="input" value={replacementId} onChange={(e) => setReplacementId(e.target.value)}>
              <option value="">—</option>
              {locations.filter((l) => l.id !== deleteTarget.id).map((l) => (
                <option key={l.id} value={l.id}>{locationLabel(l, locations)}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={leaveAsText} onChange={(e) => setLeaveAsText(e.target.checked)} />
              Leave as free-text on items
            </label>
          </div>
        </ConfirmDialog>
      )}

      {mergeSource && (
        <ConfirmDialog
          title="Merge location"
          message={`Merge "${mergeSource.name}" into another location. All items and pending moves are rewritten.`}
          confirmLabel="Merge"
          onConfirm={handleMerge}
          onCancel={() => setMergeSource(null)}
        >
          <select className="input mb-3" value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
            <option value="">Select surviving location…</option>
            {locations.filter((l) => l.id !== mergeSource.id).map((l) => (
              <option key={l.id} value={l.id}>{locationLabel(l, locations)}</option>
            ))}
          </select>
        </ConfirmDialog>
      )}
    </div>
  );
}
