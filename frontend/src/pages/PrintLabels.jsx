import React, { useEffect, useMemo, useState } from 'react';
import { getItems, getItemUnits } from '../lib/api';
import { useToast } from '../App';

/** Code128B patterns (start B = 104, stop = 106). */
const PATTERNS = [
  '11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110','10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100','11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000','10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110','10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000','11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100','10010110000','10010000110','10000101100','10000100110','10110010000',
  '10110000100','10011010000','10011000010','10000110100','10000110010','11000010010','11001010000','11110111010','11000010100','10001111010',
  '10100111100','10010111100','10010011110','10111100100','10011110100','10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110','10111101000','10111100010','11110101000','11110100010','10111011110',
  '10111101110','11101011110','11110101110','11010000100','11010010000','11010011100','11000111010',
];

function encodeCode128B(text) {
  const s = String(text || '').slice(0, 22);
  let codes = [104];
  let checksum = 104;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i) - 32;
    if (code < 0 || code > 95) continue;
    codes.push(code);
    checksum += code * codes.length;
  }
  codes.push(checksum % 103);
  codes.push(106);
  return codes.map((c) => PATTERNS[c] || '').join('');
}

function Barcode({ value, height = 48 }) {
  const bits = encodeCode128B(value);
  const bars = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') bars.push(i);
  }
  const w = Math.max(bits.length, 1);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-12 bg-white" preserveAspectRatio="none">
      {bars.map((x) => (
        <rect key={x} x={x} y="0" width="1" height={height} fill="#000" />
      ))}
    </svg>
  );
}

export default function PrintLabels() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [selected, setSelected] = useState({});
  const [includeUnits, setIncludeUnits] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getItems()
      .then(async (its) => {
        setItems(its);
        const multi = its.filter((i) => (i.totalQty || 0) > 1).slice(0, 40);
        const lists = await Promise.all(multi.map((i) => getItemUnits(i.id).catch(() => [])));
        setUnits(lists.flat());
      })
      .catch((e) => toast(e.message, 'error'));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) || (i.itemNumber || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  const labels = useMemo(() => {
    const out = [];
    filtered.forEach((item) => {
      if (selected[item.id] === false) return;
      const code = item.itemNumber || item.id;
      out.push({ key: item.id, title: item.name, code, subtitle: item.itemNumber || item.id });
      if (includeUnits) {
        units.filter((u) => u.parentId === item.id).forEach((u) => {
          out.push({ key: u.id, title: item.name, code: u.unitSku || u.id, subtitle: u.unitSku });
        });
      }
    });
    return out;
  }, [filtered, selected, includeUnits, units]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="print:hidden mb-4 space-y-3">
        <h1 className="text-xl font-bold text-gray-100">Print labels</h1>
        <p className="text-sm text-gray-500">
          Shop USB barcode scanners type the item number into Global Search or Inventory search — no camera app needed.
          Paste or scan into search with <code className="text-gray-400">?q=</code> on Inventory.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input className="input flex-1 min-w-48" placeholder="Filter items…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label className="text-sm text-gray-400 flex items-center gap-2">
            <input type="checkbox" checked={includeUnits} onChange={(e) => setIncludeUnits(e.target.checked)} />
            Include unit SKUs
          </label>
          <button type="button" className="btn-primary" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-3">
        {labels.map((l) => (
          <div key={l.key} className="bg-white text-black rounded p-3 break-inside-avoid">
            <p className="text-xs font-semibold truncate">{l.title}</p>
            <Barcode value={l.code} />
            <p className="text-[10px] font-mono text-center mt-1">{l.subtitle}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
