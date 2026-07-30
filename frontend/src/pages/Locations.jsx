import React, { useState, useEffect, useCallback } from 'react';
import { getLocations, createLocation, updateLocation, deleteLocation, getItems } from '../lib/api';
import { useToast } from '../App';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Locations() {
  const toast = useToast();
  const [locations, setLocations] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getLocations(), getItems()])
      .then(([locs, its]) => { setLocations(locs); setItems(its); })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await createLocation(newName.trim());
      setNewName('');
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
    setEditName(loc.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleRename = async (e) => {
    e?.preventDefault();
    if (!editName.trim() || !editingId) return;
    setSavingEdit(true);
    try {
      await updateLocation(editingId, editName.trim());
      toast('Location renamed', 'success');
      setEditingId(null);
      setEditName('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteLocation(deleteTarget.id);
      toast('Location deleted. Items remain at that location until reassigned.', 'info');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const itemCountAt = (locName) => items.filter((i) => i.currentLocation === locName).length;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-gray-100 mb-4">Locations</h1>

      <form onSubmit={handleAdd} className="flex gap-2 mb-5">
        <input
          className="input flex-1"
          placeholder="New location name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
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
          {locations.map((loc, idx) => {
            const count = itemCountAt(loc.name);
            const isEditing = editingId === loc.id;
            return (
              <div key={loc.id} className={`flex items-center gap-3 px-4 py-3 ${idx < locations.length - 1 ? 'border-b border-gray-800' : ''}`}>
                <span className="text-xl">📍</span>
                {isEditing ? (
                  <form onSubmit={handleRename} className="flex-1 flex gap-2 items-center">
                    <input
                      className="input flex-1 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" disabled={savingEdit || !editName.trim()} className="btn-primary text-xs py-1 px-2">
                      {savingEdit ? '…' : 'Save'}
                    </button>
                    <button type="button" onClick={cancelEdit} className="btn-secondary text-xs py-1 px-2">Cancel</button>
                  </form>
                ) : (
                  <>
                    <span className="font-medium text-gray-200 flex-1">{loc.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">{count} item{count !== 1 ? 's' : ''}</span>
                    <button
                      onClick={() => startEdit(loc)}
                      className="btn-ghost text-xs py-1 px-2"
                      title="Rename location"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(loc)}
                      className="btn-ghost text-xs py-1 px-2 text-red-500"
                      title="Delete location"
                    >
                      ✕
                    </button>
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
          message={`Delete "${deleteTarget.name}"? Items at this location will remain but the location will no longer appear in menus. Items retain their currentLocation value.`}
          confirmLabel="Delete"
          dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
