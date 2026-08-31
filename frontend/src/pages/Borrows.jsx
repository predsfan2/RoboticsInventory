import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getBorrows, createBorrow, updateBorrow, returnBorrow, deleteBorrow, getItems, getItemUnits } from '../lib/api';
import { useAuth, useToast } from '../App';
import { hasPermission } from '../lib/permissions';
import ConfirmDialog from '../components/ConfirmDialog';

function BorrowFormModal({ initial, items, onSave, onClose }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? {
    itemId: initial.itemId || '',
    borrowerName: initial.borrowerName || '',
    contact: initial.contact || '',
    expectedReturnDate: initial.expectedReturnDate ? String(initial.expectedReturnDate).slice(0, 10) : '',
    notes: initial.notes || '',
    qty: initial.qty || 1,
    unitIds: initial.unitIds || [],
  } : { itemId: '', borrowerName: '', contact: '', expectedReturnDate: '', notes: '', qty: 1, unitIds: [] });
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState([]);
  const toast = useToast();

  const matchedItems = query.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.itemId) { toast('Select an item', 'error'); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedItem = items.find((i) => i.id === form.itemId);

  useEffect(() => {
    if (!form.itemId) { setUnits([]); return; }
    getItemUnits(form.itemId).then(setUnits).catch(() => setUnits([]));
  }, [form.itemId]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Borrow' : 'Add Borrow'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <label className="block text-xs text-gray-400 mb-1">Item *</label>
            {selectedItem ? (
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-200 flex-1">{selectedItem.name}</span>
                {!isEdit && (
                  <button type="button" onClick={() => { setForm((f) => ({ ...f, itemId: '' })); setQuery(''); }} className="text-gray-500 hover:text-gray-300 text-sm">✕</button>
                )}
              </div>
            ) : (
              <>
                <input
                  className="input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search item name…"
                />
                {matchedItems.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
                    {matchedItems.map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => { setForm((f) => ({ ...f, itemId: i.id })); setQuery(i.name); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-sm text-left"
                      >
                        <span className="text-gray-200">{i.name}</span>
                        <span className="text-xs text-gray-500 ml-auto">×{i.totalQty}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Quantity</label>
            <input type="number" min="1" className="input" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: parseInt(e.target.value, 10) || 1 }))} />
          </div>
          {units.length > 0 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Units (optional)</label>
              <div className="max-h-28 overflow-y-auto space-y-1 bg-gray-800/40 rounded-lg p-2">
                {units.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="checkbox"
                      checked={(form.unitIds || []).includes(u.id)}
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        unitIds: e.target.checked
                          ? [...(f.unitIds || []), u.id]
                          : (f.unitIds || []).filter((id) => id !== u.id),
                      }))}
                    />
                    {u.unitSku} {u.currentPerson ? `(${u.currentPerson})` : ''}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Borrower Name *</label>
            <input className="input" required value={form.borrowerName} onChange={(e) => setForm((f) => ({ ...f, borrowerName: e.target.value }))} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Contact Info</label>
            <input className="input" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} placeholder="Phone or email" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Expected Return Date</label>
            <input type="date" className="input" value={form.expectedReturnDate} onChange={(e) => setForm((f) => ({ ...f, expectedReturnDate: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : isEdit ? 'Save' : 'Create Borrow'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Borrows() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('highlight');
  const [borrows, setBorrows] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [returning, setReturning] = useState({});
  const canManage = hasPermission(user, 'borrows.manage');
  const canView = hasPermission(user, 'borrows.view');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getBorrows(), getItems()])
      .then(([b, i]) => { setBorrows(b); setItems(i); })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReturn = async (b) => {
    setReturning((s) => ({ ...s, [b.id]: true }));
    try {
      await returnBorrow(b.id);
      toast('Marked as returned', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setReturning((s) => ({ ...s, [b.id]: false }));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteBorrow(deleteTarget.id);
      toast('Deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-2">
        <span className="text-4xl">🔒</span>
        <p>You do not have permission to view borrows.</p>
      </div>
    );
  }

  const now = new Date();
  const active = borrows.filter((b) => b.status === 'active');
  const returned = borrows.filter((b) => b.status === 'returned');
  const displayed = tab === 'active' ? active : returned;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-100">Borrows</h1>
        {canManage && <button onClick={() => setAddOpen(true)} className="btn-primary">+ Add Borrow</button>}
      </div>

      <div className="flex border-b border-gray-800 mb-4">
        <button onClick={() => setTab('active')} className={`tab-btn ${tab === 'active' ? 'tab-active' : 'tab-inactive'}`}>
          Active ({active.length})
        </button>
        <button onClick={() => setTab('returned')} className={`tab-btn ${tab === 'returned' ? 'tab-active' : 'tab-inactive'}`}>
          Returned ({returned.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">📋</span>
          <p>No {tab} borrows</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((b) => {
            const item = items.find((i) => i.id === b.itemId);
            const isOverdue = b.status === 'active' && b.expectedReturnDate && new Date(b.expectedReturnDate) < now;
            return (
              <div key={b.id} id={`borrow-${b.id}`} className={`card p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${isOverdue ? 'border-red-800/60' : ''} ${highlight === b.id ? 'ring-1 ring-indigo-500' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-gray-200">{item?.name || b.itemId}</span>
                    {isOverdue && <span className="badge bg-red-900/60 text-red-400 border border-red-800/50">Overdue</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                    <span>👤 {b.borrowerName}</span>
                    {b.qty > 1 && <span>×{b.qty}</span>}
                    {b.contact && <span>📞 {b.contact}</span>}
                    {b.expectedReturnDate && (
                      <span className={isOverdue ? 'text-red-400' : ''}>
                        Due: {new Date(b.expectedReturnDate).toLocaleDateString()}
                      </span>
                    )}
                    {b.returnedAt && <span className="text-emerald-500">Returned {new Date(b.returnedAt).toLocaleDateString()}</span>}
                    <span>Added {new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>
                  {b.notes && <p className="text-xs text-gray-600 mt-1 truncate">{b.notes}</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {b.status === 'active' && canManage && (
                    <button onClick={() => handleReturn(b)} disabled={returning[b.id]} className="btn-primary text-xs py-1 px-3">
                      {returning[b.id] ? '…' : 'Return'}
                    </button>
                  )}
                  {canManage && b.status === 'active' && (
                    <button onClick={() => setEditTarget(b)} className="btn-secondary text-xs py-1 px-2">Edit</button>
                  )}
                  {canManage && (
                    <button onClick={() => setDeleteTarget(b)} className="btn-ghost text-xs text-red-500">✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && (
        <BorrowFormModal
          items={items}
          onSave={async (form) => { await createBorrow(form); toast('Borrow created', 'success'); load(); }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editTarget && (
        <BorrowFormModal
          initial={editTarget}
          items={items}
          onSave={async (form) => { await updateBorrow(editTarget.id, form); toast('Borrow updated', 'success'); load(); }}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Borrow"
          message={`Delete this borrow record for "${items.find((i) => i.id === deleteTarget.itemId)?.name || deleteTarget.itemId}"?`}
          confirmLabel="Delete"
          dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
