import React, { useState, useEffect, useCallback } from 'react';
import { getItems, getLocations, updateItem, deleteItem } from '../lib/api';
import { useAuth, useToast } from '../App';
import { hasPermission, canUpdateCondition } from '../lib/permissions';
import { CONDITION_COLORS, CONDITIONS, CONDITION_ORDER } from '../lib/constants';
import ConditionUpdateModal from '../modals/ConditionUpdateModal';
import ItemDetailModal from '../modals/ItemDetailModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { ItemFormModal } from './Inventory';

export default function ConditionTracker() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [updateTarget, setUpdateTarget] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const canCond = canUpdateCondition(user);
  const canEdit = hasPermission(user, 'inventory.edit');
  const canDelete = hasPermission(user, 'inventory.delete');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getItems(), getLocations().catch(() => [])])
      .then(([its, locs]) => { setItems(its); setLocations(locs || []); })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const condCounts = CONDITIONS.reduce((acc, c) => {
    acc[c] = items.filter((i) => i.condition === c).length;
    return acc;
  }, {});

  const sorted = [...items].sort(
    (a, b) => (CONDITION_ORDER[a.condition] ?? 2) - (CONDITION_ORDER[b.condition] ?? 2)
  );
  const filtered = filter === 'All' ? sorted : sorted.filter((i) => i.condition === filter);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-100 mb-4">Condition Tracker</h1>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setFilter('All')}
          className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
            filter === 'All' ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-700 text-gray-500 hover:border-gray-500'
          }`}
        >
          All ({items.length})
        </button>
        {CONDITIONS.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
              filter === c
                ? c === 'Poor' ? 'bg-red-800 border-red-600 text-red-100'
                  : c === 'Fair' ? 'bg-amber-800 border-amber-600 text-amber-100'
                  : c === 'Good' ? 'bg-emerald-800 border-emerald-600 text-emerald-100'
                  : 'bg-blue-800 border-blue-600 text-blue-100'
                : 'border-gray-700 text-gray-500 hover:border-gray-500'
            }`}
          >
            {c} ({condCounts[c] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">🔧</span>
          <p>No items in this condition</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const lastLog = item.conditionLog?.[item.conditionLog.length - 1];
            return (
              <div key={item.id} className="card p-4 flex items-start gap-4 hover:border-gray-700 transition-colors">
                {/* Condition indicator */}
                <div className={`w-1.5 self-stretch rounded-full flex-shrink-0 ${
                  item.condition === 'Poor' ? 'bg-red-500'
                    : item.condition === 'Fair' ? 'bg-amber-500'
                    : item.condition === 'Good' ? 'bg-emerald-500'
                    : 'bg-blue-500'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <button
                      onClick={() => setDetailItem(item)}
                      className="font-semibold text-gray-100 hover:text-indigo-300 transition-colors"
                    >
                      {item.name}
                    </button>
                    <span className={CONDITION_COLORS[item.condition] || 'badge bg-gray-800 text-gray-400'}>
                      {item.condition}
                    </span>
                    {item.category && <span className="text-xs text-gray-600">{item.category}</span>}
                    {item.currentLocation && <span className="text-xs text-gray-600">📍 {item.currentLocation}</span>}
                  </div>

                  {lastLog && (
                    <p className="text-xs text-gray-500">
                      Last updated{' '}
                      <span className="text-gray-400">{new Date(lastLog.date).toLocaleDateString()}</span>
                      {' '}by <span className="text-gray-400">{lastLog.userName}</span>
                      {lastLog.note && <> · <em className="text-gray-500">{lastLog.note}</em></>}
                    </p>
                  )}
                  {!lastLog && <p className="text-xs text-gray-600">No condition history</p>}
                </div>

                {canCond && (
                <button
                  onClick={() => setUpdateTarget(item)}
                  className="btn-secondary text-xs flex-shrink-0"
                >
                  Update
                </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {updateTarget && (
        <ConditionUpdateModal
          item={updateTarget}
          onClose={() => setUpdateTarget(null)}
          onSuccess={() => { setUpdateTarget(null); load(); toast('Condition updated', 'success'); }}
        />
      )}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          locations={locations}
          onClose={() => setDetailItem(null)}
          onRefresh={load}
          onEdit={canEdit ? (i) => { setDetailItem(null); setEditItem(i); } : undefined}
          onDelete={canDelete ? (i) => { setDetailItem(null); setDeleteTarget(i); } : undefined}
        />
      )}
      {editItem && (
        <ItemFormModal
          initial={editItem}
          locations={locations}
          allItems={items}
          customFieldDefs={[]}
          onSave={async (form) => { await updateItem(editItem.id, form); toast('Item updated', 'success'); load(); }}
          onClose={() => setEditItem(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Item"
          message={`Permanently delete "${deleteTarget.name}"?`}
          confirmLabel="Delete"
          dangerous
          onConfirm={async () => { await deleteItem(deleteTarget.id); setDeleteTarget(null); toast('Deleted', 'success'); load(); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
