import React, { useState, useEffect, useCallback } from 'react';
import { getItems, getLocations, moveItemDirect } from '../lib/api';
import { useAuth, useToast } from '../App';
import { hasPermission } from '../lib/permissions';
import { CONDITION_COLORS } from '../lib/constants';
import MoveRequestModal from '../modals/MoveRequestModal';
import ItemDetailModal from '../modals/ItemDetailModal';

function DirectMoveModal({ item, locations, onSave, onClose }) {
  const [form, setForm] = useState({ location: '', person: item.currentPerson || '', notes: '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Move: {item.name}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">New Location</label>
            <select className="input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}>
              <option value="">Select…</option>
              {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Assigned Person</label>
            <input className="input" value={form.person} onChange={(e) => setForm((f) => ({ ...f, person: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try { await onSave(form); } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
              }}
              className="btn-primary"
            >
              {saving ? 'Moving…' : 'Move'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Whereabouts() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moveReqItem, setMoveReqItem] = useState(null);
  const [directMoveItem, setDirectMoveItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  const canMove = hasPermission(user, 'moves.approve');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getItems(), getLocations()])
      .then(([it, locs]) => {
        setItems(it);
        setLocations(locs);
        // Expand all groups by default
        const groups = {};
        const seen = new Set();
        it.forEach((i) => { seen.add(i.currentLocation || ''); });
        seen.forEach((loc) => { groups[loc] = true; });
        setExpandedGroups(groups);
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group by location
  const grouped = {};
  items.forEach((item) => {
    const loc = item.currentLocation || '';
    if (!grouped[loc]) grouped[loc] = [];
    grouped[loc].push(item);
  });

  // Sort groups: known locations first (in order), then unknowns
  const knownLocNames = locations.map((l) => l.name);
  const groupKeys = [
    ...knownLocNames.filter((n) => grouped[n]),
    ...Object.keys(grouped).filter((k) => k && !knownLocNames.includes(k)).sort(),
    ...(grouped[''] ? [''] : []),
  ];

  const toggle = (key) => setExpandedGroups((g) => ({ ...g, [key]: !g[key] }));

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">Whereabouts</h1>
        <span className="text-xs text-gray-500">{items.length} items · {groupKeys.length} locations</span>
      </div>

      {groupKeys.map((loc) => {
        const group = grouped[loc] || [];
        const isExpanded = expandedGroups[loc] !== false;
        const displayName = loc || 'No Location';

        return (
          <div key={loc} className="card overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => toggle(loc)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="text-xl">{loc ? '📍' : '❓'}</span>
              <div className="flex-1">
                <span className="font-semibold text-gray-200">{displayName}</span>
                {!knownLocNames.includes(loc) && loc && (
                  <span className="ml-2 text-xs text-amber-500">Unknown location</span>
                )}
              </div>
              <span className="text-xs text-gray-500 bg-gray-700 rounded-full px-2 py-0.5">{group.length}</span>
              <span className="text-gray-600 text-sm">{isExpanded ? '▾' : '▸'}</span>
            </button>

            {/* Items */}
            {isExpanded && (
              <div>
                {group.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <span className="text-xl">📦</span>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setDetailItem(item)}
                        className="text-sm font-medium text-gray-200 hover:text-indigo-300 transition-colors text-left truncate block"
                      >
                        {item.name}
                      </button>
                      <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                        <span>{item.category}</span>
                        {item.currentPerson && <span>👤 {item.currentPerson}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={CONDITION_COLORS[item.condition] || 'badge bg-gray-800 text-gray-400'}>
                        {item.condition}
                      </span>
                      <span className="text-sm font-medium text-gray-400">×{item.totalQty}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => setMoveReqItem(item)}
                        className="btn-secondary text-xs py-1 px-2"
                        title="Request move"
                      >
                        📍
                      </button>
                      {canMove && (
                        <button
                          onClick={() => setDirectMoveItem(item)}
                          className="btn-secondary text-xs py-1 px-2"
                          title="Move directly"
                        >
                          ↪
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {groupKeys.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">📍</span>
          <p>No items in inventory</p>
        </div>
      )}

      {moveReqItem && (
        <MoveRequestModal
          item={moveReqItem}
          locations={locations}
          onClose={() => setMoveReqItem(null)}
          onSuccess={() => { setMoveReqItem(null); toast('Move request submitted', 'success'); }}
        />
      )}
      {directMoveItem && (
        <DirectMoveModal
          item={directMoveItem}
          locations={locations}
          onSave={async (form) => {
            await moveItemDirect(directMoveItem.id, form);
            toast('Item moved', 'success');
            setDirectMoveItem(null);
            load();
          }}
          onClose={() => setDirectMoveItem(null)}
        />
      )}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          locations={locations}
          onClose={() => setDetailItem(null)}
          onRefresh={load}
        />
      )}
    </div>
  );
}
