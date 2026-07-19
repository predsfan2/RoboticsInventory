import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getKitComponents, addKitComponents, updateKitComponent, removeKitComponent, getItems, getLocations,
} from '../lib/api';
import { useAuth, useToast } from '../App';
import { hasPermission } from '../lib/permissions';
import { CONDITIONS, CONDITION_COLORS } from '../lib/constants';
import ConfirmDialog from '../components/ConfirmDialog';

function AddPieceModal({ kit, catalogItems, locations, onClose, onSaved }) {
  const toast = useToast();
  const [itemId, setItemId] = useState('');
  const [query, setQuery] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState('Good');
  const [currentLocation, setCurrentLocation] = useState(kit.currentLocation || '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogItems
      .filter((i) => !i.isKit && i.id !== kit.id)
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.itemNumber || '').toLowerCase().includes(q))
      .slice(0, 12);
  }, [catalogItems, kit.id, query]);

  const selected = catalogItems.find((i) => i.id === itemId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!itemId) { toast('Select an item', 'error'); return; }
    setSaving(true);
    try {
      await addKitComponents(kit.id, {
        itemId,
        quantity: Math.max(1, parseInt(quantity, 10) || 1),
        condition,
        currentLocation,
        notes,
      });
      toast(`Added to kit`, 'success');
      onSaved();
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
          <h2 className="text-lg font-semibold">Add to Kit</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <label className="block text-xs text-gray-400 mb-1">Catalog Item *</label>
            {selected ? (
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-200 flex-1">{selected.name}</span>
                <button type="button" onClick={() => { setItemId(''); setQuery(''); }} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
              </div>
            ) : (
              <>
                <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search inventory…" autoFocus />
                {query.trim() && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                    {options.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-500">No matching items</p>
                    ) : options.map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => {
                          setItemId(i.id);
                          setQuery(i.name);
                          setCondition(i.condition || 'Good');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-sm text-left"
                      >
                        <span className="text-gray-200">{i.name}</span>
                        <span className="text-xs text-gray-500 ml-auto">{i.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Quantity</label>
              <input type="number" min="1" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Condition</label>
              <select className="input" value={condition} onChange={(e) => setCondition(e.target.value)}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Location</label>
            <select className="input" value={currentLocation} onChange={(e) => setCurrentLocation(e.target.value)}>
              <option value="">—</option>
              {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
            <p className="text-xs text-gray-600 mt-1">Defaults to kit location ({kit.currentLocation || 'unset'}). Each piece can be changed later.</p>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding…' : 'Add Pieces'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPieceModal({ kit, piece, locations, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    condition: piece.condition || 'Good',
    currentLocation: piece.currentLocation || '',
    notes: piece.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateKitComponent(kit.id, piece.id, form);
      toast('Piece updated', 'success');
      onSaved();
      onClose();
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
            <h2 className="text-lg font-semibold">Edit Piece</h2>
            <p className="text-xs text-gray-500">{piece.itemName}</p>
          </div>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Condition</label>
            <select className="input" value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}>
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Location</label>
            <select className="input" value={form.currentLocation} onChange={(e) => setForm((f) => ({ ...f, currentLocation: e.target.value }))}>
              <option value="">Use kit location ({kit.currentLocation || 'unset'})</option>
              {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function KitContentsTab({ item, onRefresh }) {
  const { user } = useAuth();
  const toast = useToast();
  const canEdit = hasPermission(user, 'inventory.edit');
  const [pieces, setPieces] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editPiece, setEditPiece] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getKitComponents(item.id), getItems(), getLocations()])
      .then(([comps, items, locs]) => {
        setPieces(comps);
        setCatalog(items);
        setLocations(locs);
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [item.id]);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const p of pieces) {
      if (!map.has(p.itemId)) {
        map.set(p.itemId, { itemId: p.itemId, itemName: p.itemName, itemNumber: p.itemNumber, pieces: [] });
      }
      map.get(p.itemId).pieces.push(p);
    }
    return [...map.values()].sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [pieces]);

  const typeCount = groups.length;
  const conditionBreakdown = useMemo(() => {
    const counts = {};
    pieces.forEach((p) => { counts[p.condition] = (counts[p.condition] || 0) + 1; });
    return counts;
  }, [pieces]);

  if (loading) return <div className="text-center py-8 text-gray-600">Loading contents…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-gray-100">{pieces.length}</span> piece{pieces.length !== 1 ? 's' : ''}
            {' · '}
            <span className="font-semibold text-gray-100">{typeCount}</span> type{typeCount !== 1 ? 's' : ''}
          </p>
          {pieces.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {Object.entries(conditionBreakdown).map(([c, n]) => `${n} ${c}`).join(' · ')}
            </p>
          )}
        </div>
        {canEdit && (
          <button onClick={() => setAddOpen(true)} className="btn-primary text-xs">+ Add Items</button>
        )}
      </div>

      {pieces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-600 gap-2">
          <span className="text-3xl">🧰</span>
          <p className="text-sm">No items in this kit yet</p>
          {canEdit && <p className="text-xs">Add catalog items as individual pieces with their own condition and location.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.itemId} className="border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-800/50 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-200">{g.itemName}</span>
                  {g.itemNumber && <span className="text-xs text-gray-500 ml-2">#{g.itemNumber}</span>}
                </div>
                <span className="text-xs text-gray-500">×{g.pieces.length}</span>
              </div>
              <div className="divide-y divide-gray-800/80">
                {g.pieces.map((p, idx) => (
                  <div key={p.id} className="px-3 py-2.5 flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-5">{idx + 1}</span>
                    <span className={CONDITION_COLORS[p.condition] || 'badge bg-gray-800 text-gray-400'}>{p.condition}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 truncate">
                        📍 {p.displayLocation || p.currentLocation || item.currentLocation || '—'}
                        {!p.currentLocation && item.currentLocation ? (
                          <span className="text-gray-600"> (kit)</span>
                        ) : null}
                      </p>
                      {p.notes && <p className="text-xs text-gray-600 truncate">{p.notes}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setEditPiece(p)} className="btn-ghost text-xs py-0.5 px-1.5">Edit</button>
                        <button onClick={() => setDeleteTarget(p)} className="btn-ghost text-xs py-0.5 px-1.5 text-red-500">✕</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddPieceModal
          kit={item}
          catalogItems={catalog}
          locations={locations}
          onClose={() => setAddOpen(false)}
          onSaved={() => { load(); onRefresh?.(); }}
        />
      )}
      {editPiece && (
        <EditPieceModal
          kit={item}
          piece={editPiece}
          locations={locations}
          onClose={() => setEditPiece(null)}
          onSaved={() => { load(); onRefresh?.(); }}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Remove from kit"
          message={`Remove this ${deleteTarget.itemName} (${deleteTarget.condition}) from the kit?`}
          confirmLabel="Remove"
          onConfirm={async () => {
            try {
              await removeKitComponent(item.id, deleteTarget.id);
              toast('Removed', 'success');
              setDeleteTarget(null);
              load();
              onRefresh?.();
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
