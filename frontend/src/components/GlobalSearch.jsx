import React, { useState, useEffect, useRef } from 'react';
import { getItems, getPurchases, getBorrows, getLocations, getTransactions, getFundraisers } from '../lib/api';
import { CONDITION_COLORS } from '../lib/constants';
import { locationLabel } from '../lib/locations';

export default function GlobalSearch({ onClose, navigate }) {
  const [query, setQuery] = useState('');
  const [allItems, setAllItems] = useState([]);
  const [allPurchases, setAllPurchases] = useState([]);
  const [allBorrows, setAllBorrows] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [allTxns, setAllTxns] = useState([]);
  const [allFundraisers, setAllFundraisers] = useState([]);
  const [results, setResults] = useState({ items: [], purchases: [], borrows: [], locations: [], finance: [] });
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    Promise.all([
      getItems().catch(() => []),
      getPurchases().catch(() => []),
      getBorrows().catch(() => []),
      getLocations().catch(() => []),
      getTransactions().catch(() => []),
      getFundraisers().catch(() => []),
    ])
      .then(([its, pur, bor, locs, txns, fr]) => {
        setAllItems(its || []);
        setAllPurchases(pur || []);
        setAllBorrows(bor || []);
        setAllLocations(locs || []);
        setAllTxns(txns || []);
        setAllFundraisers(fr || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults({ items: [], purchases: [], borrows: [], locations: [], finance: [] });
      return;
    }

    const items = allItems.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      (i.category || '').toLowerCase().includes(q) ||
      (i.currentLocation || '').toLowerCase().includes(q) ||
      (i.notes || '').toLowerCase().includes(q) ||
      (i.itemNumber || '').toLowerCase().includes(q)
    ).slice(0, 5);

    const purchases = allPurchases.filter((p) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q) ||
      (p.vendor || '').toLowerCase().includes(q)
    ).slice(0, 3);

    const borrows = allBorrows.filter((b) => {
      const item = allItems.find((i) => i.id === b.itemId);
      return (
        (item?.name || '').toLowerCase().includes(q) ||
        (b.borrowerName || '').toLowerCase().includes(q)
      );
    }).slice(0, 3);

    const locations = allLocations.filter((l) =>
      (l.name || '').toLowerCase().includes(q) ||
      locationLabel(l, allLocations).toLowerCase().includes(q)
    ).slice(0, 3);

    const finance = [
      ...allTxns.filter((t) => (t.description || '').toLowerCase().includes(q)).slice(0, 3)
        .map((t) => ({ ...t, _kind: 'txn' })),
      ...allFundraisers.filter((f) => (f.name || '').toLowerCase().includes(q)).slice(0, 2)
        .map((f) => ({ ...f, _kind: 'fundraiser' })),
    ];

    setResults({ items, purchases, borrows, locations, finance });
    setSelected(0);
  }, [query, allItems, allPurchases, allBorrows, allLocations, allTxns, allFundraisers]);

  const flat = [
    ...results.items.map((r) => ({ ...r, _type: 'item' })),
    ...results.purchases.map((r) => ({ ...r, _type: 'purchase' })),
    ...results.borrows.map((r) => ({ ...r, _type: 'borrow' })),
    ...results.locations.map((r) => ({ ...r, _type: 'location' })),
    ...results.finance.map((r) => ({ ...r, _type: 'finance' })),
  ];

  const navigateTo = (result) => {
    if (result._type === 'item') navigate(`/inventory?item=${encodeURIComponent(result.id)}`);
    else if (result._type === 'purchase') navigate(`/purchases?highlight=${encodeURIComponent(result.id)}`);
    else if (result._type === 'borrow') navigate(`/borrows?highlight=${encodeURIComponent(result.id)}`);
    else if (result._type === 'location') navigate('/locations');
    else if (result._type === 'finance') {
      navigate(result._kind === 'fundraiser' ? '/finance/fundraisers' : '/finance/transactions');
    }
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
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <span className="text-gray-500 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search items, purchases, locations, finance…"
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-600 outline-none text-sm"
          />
          {loading && <span className="text-xs text-gray-600">Loading…</span>}
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 text-xs">Esc</button>
        </div>

        {hasResults ? (
          <div className="max-h-80 overflow-y-auto">
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

            {results.purchases.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wider bg-gray-900/60 border-b border-gray-800 border-t">
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
                    </div>
                  );
                })}
              </div>
            )}

            {results.borrows.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wider bg-gray-900/60 border-b border-gray-800 border-t">
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
                    </div>
                  );
                })}
              </div>
            )}

            {results.locations.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wider bg-gray-900/60 border-b border-gray-800 border-t">
                  Locations
                </div>
                {results.locations.map((l) => {
                  const idx = flat.findIndex((f) => f._type === 'location' && f.id === l.id);
                  return (
                    <div
                      key={l.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${idx === selected ? 'bg-indigo-600/20' : 'hover:bg-gray-800'}`}
                      onClick={() => navigateTo({ ...l, _type: 'location' })}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <span className="text-xl">📍</span>
                      <p className="text-sm text-gray-200">{locationLabel(l, allLocations)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {results.finance.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-xs text-gray-600 font-medium uppercase tracking-wider bg-gray-900/60 border-b border-gray-800 border-t">
                  Finance
                </div>
                {results.finance.map((f) => {
                  const idx = flat.findIndex((row) => row._type === 'finance' && row.id === f.id);
                  return (
                    <div
                      key={f.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${idx === selected ? 'bg-indigo-600/20' : 'hover:bg-gray-800'}`}
                      onClick={() => navigateTo({ ...f, _type: 'finance' })}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <span className="text-xl">{f._kind === 'fundraiser' ? '🎉' : '💰'}</span>
                      <p className="text-sm text-gray-200 truncate">{f._kind === 'fundraiser' ? f.name : f.description}</p>
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
            Type to search inventory, purchases, locations, and finance…
          </div>
        )}

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
