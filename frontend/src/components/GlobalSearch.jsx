import React, { useState, useEffect, useRef } from 'react';
import { getItems, getPurchases, getBorrows } from '../lib/api';
import { CONDITION_COLORS } from '../lib/constants';

export default function GlobalSearch({ onClose, navigate }) {
  const [query, setQuery] = useState('');
  const [allItems, setAllItems] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);
  const [allBorrows, setAllBorrows] = useState([]);
  const [results, setResults] = useState({ items: [], purchases: [], borrows: [] });
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    Promise.all([getItems(), getPurchases(), getBorrows()])
      .then(([its, pur, bor]) => { setAllItems(its); setAllPurchases(pur); setAllBorrows(bor); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) { setResults({ items: [], purchases: [], borrows: [] }); return; }

    const items = allItems.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.currentLocation || '').toLowerCase().includes(q) ||
      (i.notes || '').toLowerCase().includes(q) ||
      (i.itemNumber || '').toLowerCase().includes(q)
    ).slice(0, 5);

    const purchases = allPurchases.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q)
    ).slice(0, 3);

    const borrows = allBorrows.filter((b) => {
      const item = allItems.find((i) => i.id === b.itemId);
      return (
        (item?.name || '').toLowerCase().includes(q) ||
        b.borrowerName.toLowerCase().includes(q)
      );
    }).slice(0, 3);

    setResults({ items, purchases, borrows });
    setSelected(0);
  }, [query, allItems, allPurchases, allBorrows]);

  // Flat list for keyboard nav
  const flat = [
    ...results.items.map((r) => ({ ...r, _type: 'item' })),
    ...results.purchases.map((r) => ({ ...r, _type: 'purchase' })),
    ...results.borrows.map((r) => ({ ...r, _type: 'borrow' })),
  ];

  const navigateTo = (result) => {
    if (result._type === 'item') navigate('/inventory');
    else if (result._type === 'purchase') navigate('/purchases');
    else if (result._type === 'borrow') navigate('/borrows');
    onClose();
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && flat[selected]) navigateTo(flat[selected]);
    if (e.key === 'Escape') onClose();
  };

  const hasResults = flat.length > 0;

  return (
    <div className="modal-overlay items-start pt-16" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg card overflow-hidden shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <span className="text-gray-500 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search items, purchases, borrows…"
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-600 outline-none text-sm"
          />
          {loading && <span className="text-xs text-gray-600">Loading…</span>}
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xs">Esc</button>
        </div>

        {/* Results */}
        {hasResults ? (
          <div className="max-h-80 overflow-y-auto">
            {/* Items group */}
            {results.items.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wider bg-gray-900/60 border-b border-gray-800">
                  Inventory Items
                </div>
                {results.items.map((item) => {
                  const idx = flat.findIndex((f) => f._type === 'item' && f.id === item.id);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${idx === selected ? 'bg-indigo-600/20' : 'hover:bg-gray-800'}`}
                      onClick={() => navigateTo({ ...item, _type: 'item' })}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <span className="text-xl">📦</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500 truncate">{item.category} · {item.currentLocation || 'No location'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={CONDITION_COLORS[item.condition] || 'badge bg-gray-800 text-gray-400'}>{item.condition}</span>
                        <span className="text-xs text-gray-600">×{item.totalQty}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Purchases group */}
            {results.purchases.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wider bg-gray-900/60 border-b border-gray-800 border-t border-t-gray-800">
                  Purchases
                </div>
                {results.purchases.map((p) => {
                  const idx = flat.findIndex((f) => f._type === 'purchase' && f.id === p.id);
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${idx === selected ? 'bg-indigo-600/20' : 'hover:bg-gray-800'}`}
                      onClick={() => navigateTo({ ...p, _type: 'purchase' })}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <span className="text-xl">🛒</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.status} · {p.category}</p>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">×{p.quantity}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Borrows group */}
            {results.borrows.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wider bg-gray-900/60 border-b border-gray-800 border-t border-t-gray-800">
                  Borrows
                </div>
                {results.borrows.map((b) => {
                  const item = allItems.find((i) => i.id === b.itemId);
                  const idx = flat.findIndex((f) => f._type === 'borrow' && f.id === b.id);
                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${idx === selected ? 'bg-indigo-600/20' : 'hover:bg-gray-800'}`}
                      onClick={() => navigateTo({ ...b, _type: 'borrow' })}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <span className="text-xl">📋</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{item?.name || b.itemId}</p>
                        <p className="text-xs text-gray-500">Borrowed by {b.borrowerName}</p>
                      </div>
                      <span className={`text-xs flex-shrink-0 ${b.status === 'active' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {b.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : query.trim() ? (
          <div className="px-4 py-8 text-center text-sm text-gray-600">No results for "{query}"</div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-gray-600">
            Type to search inventory, purchases, and borrows…
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-800 px-4 py-2 flex gap-4 text-xs text-gray-600">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          {flat.length > 0 && <span className="ml-auto">{flat.length} results</span>}
        </div>
      </div>
    </div>
  );
}
