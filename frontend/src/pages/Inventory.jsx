import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getItems, createItem, updateItem, deleteItem, getLocations, getCustomFields, adjustStock } from '../lib/api';
import { useAuth, useToast } from '../App';
import { hasPermission } from '../lib/permissions';
import { CATEGORIES, CONDITIONS, SORT_OPTIONS, CONDITION_ORDER } from '../lib/constants';
import ItemCard from '../components/ItemCard';
import ItemListRow from '../components/ItemListRow';
import ConfirmDialog from '../components/ConfirmDialog';
import ItemDetailModal from '../modals/ItemDetailModal';
import MoveRequestModal from '../modals/MoveRequestModal';
import LocationSelect from '../components/LocationSelect';
import { toCSV, downloadCSV, parseCSV, INVENTORY_CSV_HEADERS } from '../lib/csv';

const LS_VIEW = 'rt_inv_view';
const LS_SORT = 'rt_inv_sort';

export function ItemFormModal({ initial, locations, allItems, customFieldDefs, onSave, onClose }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        ...initial,
        components: Array.isArray(initial.components) ? [...initial.components] : [],
        customFields: { ...(initial.customFields || {}) },
      };
    }
    return {
      name: '', itemNumber: '', category: '', totalQty: 1,
      condition: 'Good', currentLocation: '', currentPerson: '',
      notes: '', minStock: 0, isKit: false, components: [], customFields: {},
    };
  });
  const [saving, setSaving] = useState(false);
  const [compQuery, setCompQuery] = useState('');
  const toast = useToast();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const categoryFields = useMemo(() => {
    if (!form.category) return [];
    const def = (customFieldDefs || []).find((d) => d.category === form.category);
    return def?.fields || [];
  }, [form.category, customFieldDefs]);

  const setCustom = (name, value) => {
    setForm((f) => ({ ...f, customFields: { ...f.customFields, [name]: value } }));
  };

  const otherItems = useMemo(
    () => (allItems || []).filter((i) => i.id !== initial?.id && !i.isKit),
    [allItems, initial?.id]
  );

  const matchedComponents = compQuery.trim()
    ? otherItems.filter((i) =>
        i.name.toLowerCase().includes(compQuery.toLowerCase()) &&
        !(form.components || []).some((c) => c.itemId === i.id)
      ).slice(0, 8)
    : [];

  const addComponent = (item) => {
    setForm((f) => ({
      ...f,
      components: [...(f.components || []), { itemId: item.id, name: item.name, qty: 1 }],
    }));
    setCompQuery('');
  };

  const setCompQty = (itemId, qty) => {
    setForm((f) => ({
      ...f,
      components: (f.components || []).map((c) =>
        c.itemId === itemId ? { ...c, qty: Math.max(1, parseInt(qty, 10) || 1) } : c
      ),
    }));
  };

  const removeComponent = (itemId) => {
    setForm((f) => ({
      ...f,
      components: (f.components || []).filter((c) => c.itemId !== itemId),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit) {
        delete payload.totalQty;
      }
      if (!payload.isKit) {
        payload.components = [];
      }
      await onSave(payload);
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
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Item' : 'Add Item'}</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Name *</label>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Item name" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Item #</label>
              <input className="input" value={form.itemNumber || ''} onChange={(e) => set('itemNumber', e.target.value)} placeholder="e.g. TOOL-001" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Category</label>
              <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {isEdit ? (
              <div className="col-span-2">
                <p className="text-xs text-amber-400/90 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
                  Qty is {form.totalQty}. Use stock adjust on the item detail page to change quantity — editing here does not update stock.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Qty</label>
                <input type="number" min="1" className="input" value={form.totalQty} onChange={(e) => set('totalQty', parseInt(e.target.value) || 1)} />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Min Stock</label>
              <input type="number" min="0" className="input" value={form.minStock || 0} onChange={(e) => set('minStock', parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Condition</label>
              <select className="input" value={form.condition} onChange={(e) => set('condition', e.target.value)}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Location</label>
              <LocationSelect locations={locations} value={form.currentLocation || ''} onChange={(v) => set('currentLocation', v)} emptyLabel="None" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Assigned Person</label>
              <input className="input" value={form.currentPerson || ''} onChange={(e) => set('currentPerson', e.target.value)} placeholder="Name or leave blank" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea className="input resize-none" rows={2} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isKit" checked={!!form.isKit} onChange={(e) => set('isKit', e.target.checked)} className="rounded" />
              <label htmlFor="isKit" className="text-sm text-gray-300">This is a kit</label>
            </div>

            {form.isKit && (
              <div className="col-span-2 border border-gray-800 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Kit Components (BOM)</p>
                <div className="relative">
                  <input
                    className="input text-sm"
                    value={compQuery}
                    onChange={(e) => setCompQuery(e.target.value)}
                    placeholder="Search items to add…"
                  />
                  {matchedComponents.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
                      {matchedComponents.map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          onClick={() => addComponent(i)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-sm text-left"
                        >
                          <span className="text-gray-200">{i.name}</span>
                          <span className="text-xs text-gray-500 ml-auto">×{i.totalQty}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(form.components || []).length === 0 ? (
                  <p className="text-xs text-gray-600">No components yet</p>
                ) : (
                  <div className="space-y-1">
                    {(form.components || []).map((c) => (
                      <div key={c.itemId} className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-2 py-1.5">
                        <span className="text-sm text-gray-200 flex-1 truncate">{c.name}</span>
                        <input
                          type="number"
                          min="1"
                          className="input w-16 text-xs py-1"
                          value={c.qty}
                          onChange={(e) => setCompQty(c.itemId, e.target.value)}
                        />
                        <button type="button" onClick={() => removeComponent(c.itemId)} className="text-gray-600 hover:text-red-400 text-sm">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {categoryFields.length > 0 && (
              <div className="col-span-2 border border-gray-800 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Custom Fields</p>
                {categoryFields.map((cf) => (
                  <div key={cf.name}>
                    <label className="block text-xs text-gray-400 mb-1">{cf.label || cf.name}</label>
                    {cf.type === 'select' ? (
                      <select
                        className="input"
                        value={form.customFields?.[cf.name] ?? ''}
                        onChange={(e) => setCustom(cf.name, e.target.value)}
                      >
                        <option value="">—</option>
                        {(cf.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={cf.type === 'number' ? 'number' : 'text'}
                        className="input"
                        value={form.customFields?.[cf.name] ?? ''}
                        onChange={(e) => setCustom(cf.name, cf.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
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

function BulkAddModal({ locations, onSave, onClose }) {
  const EMPTY = () => ({ name: '', category: '', totalQty: 1, condition: 'Good', currentLocation: '' });
  const [rows, setRows] = useState([EMPTY()]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const setRow = (i, k, v) => {
    setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  };

  const addRow = () => {
    const prev = rows[rows.length - 1];
    setRows((rs) => [...rs, { ...EMPTY(), category: prev.category, currentLocation: prev.currentLocation }]);
  };

  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    const valid = rows.filter((r) => r.name.trim());
    if (!valid.length) return;
    setSaving(true);
    try {
      for (const row of valid) await onSave(row);
      onClose();
      toast(`Added ${valid.length} item(s)`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-4xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Bulk Add Items</h2>
          <button onClick={onClose} className="btn-ghost">✕</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-2 font-medium">Name *</th>
                <th className="text-left py-2 px-2 font-medium">Category</th>
                <th className="text-left py-2 px-2 font-medium w-16">Qty</th>
                <th className="text-left py-2 px-2 font-medium">Condition</th>
                <th className="text-left py-2 px-2 font-medium">Location</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="py-1.5 pr-2">
                    <input className="input text-xs py-1" value={row.name} onChange={(e) => setRow(i, 'name', e.target.value)} placeholder="Item name" />
                  </td>
                  <td className="py-1.5 px-2">
                    <select className="input text-xs py-1" value={row.category} onChange={(e) => setRow(i, 'category', e.target.value)}>
                      <option value="">—</option>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" min="1" className="input text-xs py-1 w-16" value={row.totalQty} onChange={(e) => setRow(i, 'totalQty', parseInt(e.target.value) || 1)} />
                  </td>
                  <td className="py-1.5 px-2">
                    <select className="input text-xs py-1" value={row.condition} onChange={(e) => setRow(i, 'condition', e.target.value)}>
                      {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <LocationSelect
                      locations={locations}
                      value={row.currentLocation}
                      onChange={(v) => setRow(i, 'currentLocation', v)}
                      emptyLabel="None"
                      className="input text-xs py-1"
                    />
                  </td>
                  <td className="py-1.5 pl-2">
                    <button onClick={() => removeRow(i)} className="text-gray-600 hover:text-red-400 text-base">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addRow} className="btn-ghost text-xs mt-3">+ Add row</button>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving…' : `Add ${rows.filter((r) => r.name.trim()).length} items`}</button>
        </div>
      </div>
    </div>
  );
}

function DirectMoveModal({ item, locations, onSave, onClose }) {
  const [form, setForm] = useState({ location: item.currentLocation || '', person: item.currentPerson || '', notes: '' });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
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

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Move: {item.name}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Location</label>
            <LocationSelect locations={locations} value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} emptyLabel="None" />
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
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Moving…' : 'Move'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef(null);
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [customFieldDefs, setCustomFieldDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(() => localStorage.getItem(LS_VIEW) || 'grid');
  const [sort, setSort] = useState(() => localStorage.getItem(LS_SORT) || 'name_asc');
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [moveReqItem, setMoveReqItem] = useState(null);
  const [directMoveItem, setDirectMoveItem] = useState(null);

  const canMove = hasPermission(user, 'moves.approve');
  const canRequestMove = hasPermission(user, 'moves.request');
  const canEdit = hasPermission(user, 'inventory.edit');
  const canDelete = hasPermission(user, 'inventory.delete');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([getItems(), getLocations(), getCustomFields().catch(() => [])])
      .then(([it, locs, cfs]) => { setItems(it); setLocations(locs); setCustomFieldDefs(cfs || []); })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const itemId = searchParams.get('item');
    if (!itemId || !items.length) return;
    const found = items.find((i) => i.id === itemId);
    if (found) setDetailItem(found);
  }, [searchParams, items]);

  useEffect(() => { localStorage.setItem(LS_VIEW, view); }, [view]);
  useEffect(() => { localStorage.setItem(LS_SORT, sort); }, [sort]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q) ||
        (i.itemNumber || '').toLowerCase().includes(q)
      );
    }
    if (filterCondition) list = list.filter((i) => i.condition === filterCondition);
    if (filterCategory) list = list.filter((i) => i.category === filterCategory);
    if (filterLocation) list = list.filter((i) => i.currentLocation === filterLocation);

    list.sort((a, b) => {
      switch (sort) {
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'qty_desc': return b.totalQty - a.totalQty;
        case 'qty_asc': return a.totalQty - b.totalQty;
        case 'condition_poor': return (CONDITION_ORDER[a.condition] ?? 2) - (CONDITION_ORDER[b.condition] ?? 2);
        case 'condition_good': return (CONDITION_ORDER[b.condition] ?? 2) - (CONDITION_ORDER[a.condition] ?? 2);
        case 'category': return (a.category || '').localeCompare(b.category || '');
        case 'location': return (a.currentLocation || '').localeCompare(b.currentLocation || '');
        default: return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [items, search, filterCondition, filterCategory, filterLocation, sort]);

  const handleSave = async (form) => {
    if (editItem) {
      await updateItem(editItem.id, form);
      toast('Item updated', 'success');
    } else {
      await createItem(form);
      toast('Item created', 'success');
    }
    load();
  };

  const handleDelete = async () => {
    try {
      await deleteItem(deleteTarget.id);
      toast('Item deleted', 'success');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const exportCsv = () => {
    const rows = items.map((i) => ({
      name: i.name,
      itemNumber: i.itemNumber || '',
      category: i.category || '',
      qty: i.totalQty,
      minStock: i.minStock || 0,
      condition: i.condition || '',
      location: i.currentLocation || '',
      person: i.currentPerson || '',
      notes: i.notes || '',
    }));
    downloadCSV('inventory.csv', toCSV(rows, INVENTORY_CSV_HEADERS));
  };

  const importCsv = async (file) => {
    try {
      const text = await file.text();
      const { rows } = parseCSV(text);
      let created = 0;
      let updated = 0;
      for (const row of rows) {
        const name = (row.name || '').trim();
        if (!name) continue;
        const payload = {
          name,
          itemNumber: row.itemNumber || '',
          category: row.category || '',
          totalQty: parseInt(row.qty, 10) || 1,
          minStock: parseInt(row.minStock, 10) || 0,
          condition: row.condition || 'Good',
          currentLocation: row.location || '',
          currentPerson: row.person || '',
          notes: row.notes || '',
        };
        const match = items.find((i) =>
          (payload.itemNumber && i.itemNumber && i.itemNumber.toLowerCase() === payload.itemNumber.toLowerCase())
          || i.name.toLowerCase() === name.toLowerCase()
        );
        if (match) {
          await updateItem(match.id, payload);
          const nextQty = parseInt(row.qty, 10);
          if (!Number.isNaN(nextQty) && nextQty !== (match.totalQty || 0)) {
            await adjustStock(match.id, nextQty - (match.totalQty || 0), 'CSV import');
          }
          updated += 1;
        } else {
          await createItem(payload);
          created += 1;
        }
      }
      toast(`Imported ${created} new, updated ${updated}`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const uniqueCategories = [...new Set(items.map((i) => i.category).filter(Boolean))].sort();
  const uniqueLocations = [...new Set(items.map((i) => i.currentLocation).filter(Boolean))].sort();

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            className="input flex-1 min-w-48"
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex gap-1 ml-auto">
            <button onClick={() => setView('grid')} className={view === 'grid' ? 'btn-primary p-2' : 'btn-secondary p-2'} title="Grid">⊞</button>
            <button onClick={() => setView('list')} className={view === 'list' ? 'btn-primary p-2' : 'btn-secondary p-2'} title="List">☰</button>
          </div>
          {canEdit && (
            <>
              <button onClick={() => { setEditItem(null); setAddOpen(true); }} className="btn-primary">+ Add</button>
              <button onClick={() => setBulkOpen(true)} className="btn-secondary text-xs">Bulk Add</button>
              <button onClick={exportCsv} className="btn-secondary text-xs">Export CSV</button>
              <button onClick={() => fileRef.current?.click()} className="btn-secondary text-xs">Import CSV</button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
            </>
          )}
          <Link to="/inventory/labels" className="btn-secondary text-xs">Print labels</Link>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              onClick={() => setFilterCondition(filterCondition === c ? '' : c)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filterCondition === c ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}
            >
              {c} ({items.filter((i) => i.condition === c).length})
            </button>
          ))}
          {uniqueCategories.slice(0, 5).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filterCategory === cat ? 'bg-purple-600 border-purple-500 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}
            >
              {cat}
            </button>
          ))}
          {uniqueLocations.slice(0, 4).map((loc) => (
            <button
              key={loc}
              onClick={() => setFilterLocation(filterLocation === loc ? '' : loc)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filterLocation === loc ? 'bg-teal-600 border-teal-500 text-white' : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}
            >
              📍{loc}
            </button>
          ))}
          {(filterCondition || filterCategory || filterLocation) && (
            <button
              onClick={() => { setFilterCondition(''); setFilterCategory(''); setFilterLocation(''); }}
              className="text-xs px-2.5 py-1 rounded-full border border-red-800 text-red-500 hover:bg-red-900/30"
            >
              Clear filters ✕
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 py-2 text-xs text-gray-600 border-b border-gray-800/50">
        {filtered.length} item{filtered.length !== 1 ? 's' : ''} {items.length !== filtered.length && `(filtered from ${items.length})`}
      </div>

      {/* Item list / grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
            <span className="text-4xl">📦</span>
            <p>No items found</p>
          </div>
        ) : view === 'grid' ? (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onDetails={(i) => setDetailItem(i)}
                onMoveRequest={canRequestMove ? (i) => setMoveReqItem(i) : undefined}
                onDirectMove={canMove ? (i) => setDirectMoveItem(i) : undefined}
                canMove={canMove}
              />
            ))}
          </div>
        ) : (
          <div>
            {filtered.map((item) => (
              <ItemListRow
                key={item.id}
                item={item}
                onDetails={(i) => setDetailItem(i)}
                onMoveRequest={canRequestMove ? (i) => setMoveReqItem(i) : undefined}
                onDirectMove={canMove ? (i) => setDirectMoveItem(i) : undefined}
                canMove={canMove}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {(addOpen || editItem) && (
        <ItemFormModal
          initial={editItem}
          locations={locations}
          allItems={items}
          customFieldDefs={customFieldDefs}
          onSave={handleSave}
          onClose={() => { setAddOpen(false); setEditItem(null); }}
        />
      )}
      {bulkOpen && (
        <BulkAddModal
          locations={locations}
          onSave={createItem}
          onClose={() => { setBulkOpen(false); load(); }}
        />
      )}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          locations={locations}
          customFieldDefs={customFieldDefs}
          onClose={() => { setDetailItem(null); searchParams.delete('item'); setSearchParams(searchParams, { replace: true }); }}
          onRefresh={() => { load(); }}
          onEdit={canEdit ? (i) => { setDetailItem(null); setEditItem(i); setAddOpen(true); } : undefined}
          onDelete={canDelete ? (i) => { setDetailItem(null); setDeleteTarget(i); } : undefined}
        />
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
            const { moveItemDirect } = await import('../lib/api');
            await moveItemDirect(directMoveItem.id, form);
            toast('Item moved', 'success');
            load();
          }}
          onClose={() => setDirectMoveItem(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Item"
          message={`Permanently delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          dangerous
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
