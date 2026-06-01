import React, { useState, useEffect, useRef } from 'react';
import {
  getItemUnits, adjustStock, addComment, uploadItemImage, uploadInvoice,
  deleteInvoice, updateUnit,
} from '../lib/api';
import { useAuth, useToast } from '../App';
import { CONDITION_COLORS, CONDITIONS } from '../lib/constants';
import ConditionUpdateModal from './ConditionUpdateModal';
import UnitManagerModal from './UnitManagerModal';

function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={`tab-btn ${active ? 'tab-active' : 'tab-inactive'}`}>
      {label}
    </button>
  );
}

function OverviewTab({ item, onRefresh }) {
  const toast = useToast();
  const { user } = useAuth();
  const [adjChange, setAdjChange] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const canEdit = ['Admin', 'Manager'].includes(user?.role);

  const handleAdj = async (delta) => {
    const change = parseInt(adjChange, 10);
    if (isNaN(change) || change <= 0) return;
    setAdjusting(true);
    try {
      await adjustStock(item.id, delta * change, adjReason);
      toast(`Stock ${delta > 0 ? 'added' : 'removed'}`, 'success');
      setAdjChange('');
      setAdjReason('');
      onRefresh();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setAdjusting(false);
    }
  };

  const isLowStock = item.totalQty <= item.minStock && item.minStock > 0;

  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Quantity', value: item.totalQty, warn: isLowStock },
          { label: 'Condition', value: item.condition },
          { label: 'Category', value: item.category || '—' },
          { label: 'Location', value: item.currentLocation || '—' },
          { label: 'Assigned To', value: item.currentPerson || '—' },
          { label: 'Min Stock', value: item.minStock || 0 },
        ].map(({ label, value, warn }) => (
          <div key={label} className="bg-gray-800/60 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-sm font-semibold ${warn ? 'text-amber-400' : 'text-gray-200'}`}>{value}</p>
          </div>
        ))}
      </div>

      {isLowStock && (
        <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-700/40 rounded-lg px-4 py-2.5 text-sm text-amber-300">
          ⚠ Stock is at or below minimum ({item.totalQty}/{item.minStock})
        </div>
      )}

      {item.notes && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Notes</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{item.notes}</p>
        </div>
      )}

      {/* Quantity adjustment */}
      {canEdit && (
        <div className="border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wide">Adjust Stock</p>
          <div className="flex gap-2 mb-2">
            <input
              type="number"
              min="1"
              className="input w-20"
              placeholder="Qty"
              value={adjChange}
              onChange={(e) => setAdjChange(e.target.value)}
            />
            <input
              className="input flex-1"
              placeholder="Reason (optional)"
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleAdj(1)} disabled={adjusting || !adjChange} className="btn-primary flex-1 text-xs">+ Add</button>
            <button onClick={() => handleAdj(-1)} disabled={adjusting || !adjChange} className="btn-danger flex-1 text-xs">– Remove</button>
          </div>
        </div>
      )}

      {/* Recent qty log */}
      {item.quantityLog?.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Recent Stock Changes</p>
          <div className="space-y-1">
            {[...item.quantityLog].reverse().slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-800/50">
                <span className={e.change > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {e.change > 0 ? '+' : ''}{e.change}
                </span>
                <span className="text-gray-400 flex-1">{e.reason || '—'}</span>
                <span className="text-gray-600">{new Date(e.date).toLocaleDateString()}</span>
                <span className="text-gray-600">{e.userName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CommentsTab({ item, onRefresh }) {
  const { user } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const textRef = useRef();

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handlePost();
  };

  const handlePost = async () => {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await addComment(item.id, text.trim());
      setText('');
      toast('Comment posted', 'success');
      onRefresh();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setPosting(false);
    }
  };

  const comments = [...(item.comments || [])].reverse();

  return (
    <div className="space-y-4">
      {/* New comment */}
      <div className="border border-gray-800 rounded-lg p-3 space-y-2">
        <textarea
          ref={textRef}
          className="input resize-none w-full"
          rows={3}
          placeholder="Write a comment… (Ctrl+Enter to post)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="flex justify-end">
          <button onClick={handlePost} disabled={posting || !text.trim()} className="btn-primary text-xs">
            {posting ? 'Posting…' : 'Post Comment'}
          </button>
        </div>
      </div>

      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-4">No comments yet</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="bg-gray-800/40 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold">
                  {c.userName?.[0]?.toUpperCase()}
                </div>
                <span className="text-xs font-medium text-gray-300">{c.userName}</span>
                <span className="text-xs text-gray-600 ml-auto">{new Date(c.date).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryTab({ item }) {
  // Merge all logs into timeline
  const events = [
    ...(item.locationLog || []).map((e) => ({ ...e, type: 'move', icon: '📍', color: 'text-blue-400', label: `Moved to ${e.location}${e.person ? ` · ${e.person}` : ''}` })),
    ...(item.conditionLog || []).map((e) => ({ ...e, type: 'condition', icon: '🔧', color: 'text-amber-400', label: `Condition → ${e.condition}${e.note ? `: ${e.note}` : ''}` })),
    ...(item.quantityLog || []).map((e) => ({ ...e, type: 'stock', icon: e.change > 0 ? '📈' : '📉', color: e.change > 0 ? 'text-emerald-400' : 'text-red-400', label: `Stock ${e.change > 0 ? '+' : ''}${e.change}${e.reason ? `: ${e.reason}` : ''}` })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (events.length === 0) return <p className="text-sm text-gray-600 text-center py-8">No history yet</p>;

  return (
    <div className="space-y-1">
      {events.map((e, idx) => (
        <div key={e.id || idx} className="flex gap-3 py-2 border-b border-gray-800/50 last:border-0">
          <span className="text-lg flex-shrink-0">{e.icon}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${e.color}`}>{e.label}</p>
            <p className="text-xs text-gray-600 mt-0.5">{e.userName || e.movedBy || '—'} · {new Date(e.date).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FilesTab({ item, onRefresh }) {
  const toast = useToast();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const canEdit = ['Admin', 'Manager'].includes(user?.role);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast('File exceeds 4MB', 'error'); return; }
    setUploading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await uploadInvoice(item.id, base64, file.name, file.type);
      toast('File uploaded', 'success');
      onRefresh();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await uploadItemImage(item.id, base64, file.type);
      toast('Image uploaded', 'success');
      onRefresh();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteInvoice = async (invId) => {
    try {
      await deleteInvoice(item.id, invId);
      toast('File deleted', 'success');
      onRefresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      {/* Main image */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Main Image</p>
        {item.imageUrl ? (
          <div className="relative inline-block">
            <img src={item.imageUrl} alt={item.name} className="max-h-40 rounded-lg border border-gray-700" />
            {canEdit && (
              <label className="absolute top-1 right-1 btn-secondary text-xs cursor-pointer">
                Change
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
            )}
          </div>
        ) : canEdit ? (
          <label className="btn-secondary cursor-pointer text-sm">
            {uploading ? 'Uploading…' : '+ Upload Image'}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
        ) : (
          <p className="text-sm text-gray-600">No image</p>
        )}
      </div>

      {/* Invoices */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Attachments ({item.invoices?.length || 0})</p>
          {canEdit && (
            <label className="btn-secondary text-xs cursor-pointer">
              {uploading ? 'Uploading…' : '+ Upload'}
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          )}
        </div>
        {(item.invoices || []).length === 0 ? (
          <p className="text-sm text-gray-600">No attachments</p>
        ) : (
          <div className="space-y-1">
            {item.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
                <span className="text-xl">📎</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{inv.name}</p>
                  <p className="text-xs text-gray-600">{inv.uploadedBy} · {new Date(inv.date).toLocaleDateString()}</p>
                </div>
                <a href={inv.url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs py-1 px-2">Open</a>
                {canEdit && (
                  <button onClick={() => handleDeleteInvoice(inv.id)} className="text-gray-600 hover:text-red-400 transition-colors text-sm">✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UnitsTab({ item }) {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUnit, setEditUnit] = useState(null);
  const toast = useToast();

  useEffect(() => {
    if (item.totalQty > 1) {
      getItemUnits(item.id).then(setUnits).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [item]);

  if (item.totalQty <= 1) return <p className="text-sm text-gray-600 text-center py-8">Single-quantity item — no individual units</p>;
  if (loading) return <div className="text-center py-8 text-gray-600">Loading units…</div>;

  return (
    <div className="space-y-2">
      {units.map((u) => (
        <div key={u.id} className="bg-gray-800/40 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-mono text-gray-400 flex-shrink-0">{u.unitSku}</span>
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 items-center">
              <span className={CONDITION_COLORS[u.condition] || 'badge bg-gray-800 text-gray-400'}>{u.condition}</span>
              <span className="text-xs text-gray-500">{u.currentLocation || '—'}</span>
              {u.currentPerson && <span className="text-xs text-gray-500">· {u.currentPerson}</span>}
            </div>
          </div>
          <button onClick={() => setEditUnit(u)} className="btn-secondary text-xs py-1 px-2">Edit</button>
        </div>
      ))}
      {editUnit && (
        <UnitManagerModal
          unit={editUnit}
          onClose={() => setEditUnit(null)}
          onSuccess={async () => {
            const fresh = await getItemUnits(item.id);
            setUnits(fresh);
            setEditUnit(null);
            toast('Unit updated', 'success');
          }}
        />
      )}
    </div>
  );
}

export default function ItemDetailModal({ item: initialItem, locations, onClose, onRefresh, onEdit, onDelete }) {
  const [item, setItem] = useState(initialItem);
  const [tab, setTab] = useState('overview');
  const [conditionModalOpen, setConditionModalOpen] = useState(false);
  const { user } = useAuth();
  const canEdit = ['Admin', 'Manager'].includes(user?.role);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const refresh = async () => {
    // Re-fetch from parent
    onRefresh?.();
    // Also try to refresh item inline
    try {
      const { getItems } = await import('../lib/api');
      const items = await getItems();
      const fresh = items.find((i) => i.id === item.id);
      if (fresh) setItem(fresh);
    } catch {}
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'comments', label: `Comments (${item.comments?.length || 0})` },
    { id: 'history', label: 'History' },
    { id: 'files', label: `Files (${item.invoices?.length || 0})` },
    ...(item.totalQty > 1 ? [{ id: 'units', label: 'Units' }] : []),
  ];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg font-bold text-gray-100">{item.name}</h2>
              <span className={CONDITION_COLORS[item.condition] || 'badge bg-gray-800 text-gray-400'}>
                {item.condition}
              </span>
              {item.isKit && <span className="badge bg-purple-900/60 text-purple-300 border border-purple-800/50">Kit</span>}
            </div>
            {item.itemNumber && <p className="text-xs text-gray-500">#{item.itemNumber}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && (
              <>
                <button onClick={() => setConditionModalOpen(true)} className="btn-secondary text-xs py-1 px-2">Update Condition</button>
                {onEdit && <button onClick={() => onEdit(item)} className="btn-secondary text-xs py-1 px-2">Edit</button>}
                {onDelete && <button onClick={() => onDelete(item)} className="btn-danger text-xs py-1 px-2">Delete</button>}
              </>
            )}
            <button onClick={onClose} className="btn-ghost text-lg">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-5 overflow-x-auto">
          {tabs.map((t) => (
            <Tab key={t.id} label={t.label} active={tab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">
          {tab === 'overview' && <OverviewTab item={item} onRefresh={refresh} />}
          {tab === 'comments' && <CommentsTab item={item} onRefresh={refresh} />}
          {tab === 'history' && <HistoryTab item={item} />}
          {tab === 'files' && <FilesTab item={item} onRefresh={refresh} />}
          {tab === 'units' && <UnitsTab item={item} />}
        </div>
      </div>

      {conditionModalOpen && (
        <ConditionUpdateModal
          item={item}
          onClose={() => setConditionModalOpen(false)}
          onSuccess={() => { setConditionModalOpen(false); refresh(); }}
        />
      )}
    </div>
  );
}
