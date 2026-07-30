import React, { useState, useEffect, useCallback } from 'react';
import { getActivity, getAuditLog, undoAction } from '../lib/api';
import { useAuth, useToast } from '../App';

const ACTION_LABELS = {
  CREATE_ITEM: '📦 Item Created',
  UPDATE_ITEM: '✏️ Item Updated',
  DELETE_ITEM: '🗑 Item Deleted',
  ADJUST_STOCK: '📊 Stock Adjusted',
  UPDATE_CONDITION: '🔧 Condition Updated',
  MOVE_ITEM: '📍 Item Moved',
  MOVE_REQUEST: '📩 Move Requested',
  MOVE_APPROVED: '✅ Move Approved',
  MOVE_DENIED: '❌ Move Denied',
  CREATE_PURCHASE: '🛒 Purchase Created',
  PURCHASE_RECEIVED: '📬 Purchase Received',
  BORROW_CREATED: '📋 Borrow Created',
  BORROW_RETURNED: '↩️ Item Returned',
  UNDO: '⏪ Undone',
};

const UNDOABLE = new Set(['UPDATE_ITEM', 'UPDATE_CONDITION', 'MOVE_ITEM', 'ADJUST_STOCK']);

export default function ActivityLog() {
  const { user } = useAuth();
  const toast = useToast();
  const [mainTab, setMainTab] = useState('activity');
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [undoing, setUndoing] = useState({});
  const LIMIT = 50;

  const canUndo = user?.role === 'Admin';

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: LIMIT };
    if (search) params.search = search;
    if (filterAction) params.action = filterAction;
    const fetcher = mainTab === 'audit' ? getAuditLog : getActivity;
    fetcher(params)
      .then((res) => { setLogs(res.logs || []); setTotal(res.total || 0); })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, search, filterAction, mainTab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filterAction, mainTab]);

  const handleUndo = async (id) => {
    setUndoing((u) => ({ ...u, [id]: true }));
    try {
      await undoAction(id);
      toast('Action undone', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUndoing((u) => ({ ...u, [id]: false }));
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-100 mb-4">Activity & Audit</h1>

      <div className="flex border-b border-gray-800 mb-4">
        <button
          onClick={() => setMainTab('activity')}
          className={`tab-btn ${mainTab === 'activity' ? 'tab-active' : 'tab-inactive'}`}
        >
          Activity
        </button>
        <button
          onClick={() => setMainTab('audit')}
          className={`tab-btn ${mainTab === 'audit' ? 'tab-active' : 'tab-inactive'}`}
        >
          Audit
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className="input flex-1 min-w-48"
          placeholder="Search user, item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-auto" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="">All Actions</option>
          {Object.keys(ACTION_LABELS).map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-600">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
          <span className="text-4xl">📜</span>
          <p>No {mainTab === 'audit' ? 'audit' : 'activity'} found</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left px-4 py-2 font-medium">Time</th>
                  <th className="text-left px-4 py-2 font-medium">User</th>
                  <th className="text-left px-4 py-2 font-medium">Action</th>
                  <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Item</th>
                  <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">Details</th>
                  {mainTab === 'audit' && canUndo && (
                    <th className="text-right px-4 py-2 font-medium">Undo</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const canUndoRow = mainTab === 'audit' && canUndo && UNDOABLE.has(log.action) && log.before && !log.undoneEntryId;
                  return (
                    <tr key={log.id || idx} className={`${idx < logs.length - 1 ? 'border-b border-gray-800/50' : ''} hover:bg-gray-800/30`}>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.date || log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-gray-300">{log.userName}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {ACTION_LABELS[log.action] || log.action}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 hidden md:table-cell max-w-[140px] truncate">
                        {log.itemName || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 hidden lg:table-cell max-w-[200px] truncate">
                        {log.details || '—'}
                      </td>
                      {mainTab === 'audit' && canUndo && (
                        <td className="px-4 py-2.5 text-right">
                          {canUndoRow ? (
                            <button
                              onClick={() => handleUndo(log.id)}
                              disabled={undoing[log.id]}
                              className="btn-secondary text-xs py-1 px-2"
                            >
                              {undoing[log.id] ? '…' : 'Undo'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-700">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 text-xs">{total} entries · page {page} of {totalPages || 1}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1">← Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-xs py-1">Next →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
