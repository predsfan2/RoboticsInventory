import React, { useState, useEffect, useCallback } from 'react';
import { getActivity } from '../lib/api';
import { useToast } from '../App';

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
};

export default function ActivityLog() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    const params = { page, limit: LIMIT };
    if (search) params.search = search;
    if (filterAction) params.action = filterAction;
    getActivity(params)
      .then((res) => { setLogs(res.logs || []); setTotal(res.total || 0); })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [page, search, filterAction]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, filterAction]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-gray-100 mb-4">Activity Log</h1>

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
          <p>No activity found</p>
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
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={log.id || idx} className={`${idx < logs.length - 1 ? 'border-b border-gray-800/50' : ''} hover:bg-gray-800/30`}>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
