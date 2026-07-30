/** Shared CSV helpers for finance import/export. */

export const TRANSACTION_CSV_HEADERS = [
  'date',
  'type',
  'description',
  'category',
  'amount',
  'receiptUrl',
  'fundraiser',
  'donor',
];

const TYPE_ALIASES = {
  purchase: 'Purchase',
  expense: 'Purchase',
  donation: 'Donation',
  income: 'Donation',
  fundraiserincome: 'FundraiserIncome',
  fundraiser: 'FundraiserIncome',
  reimbursement: 'Reimbursement',
};

export function escapeCSV(value) {
  const s = String(value ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function toCSV(rows, headers) {
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(',')),
  ];
  return lines.join('\n');
}

export function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Quote-aware CSV line parser. */
export function parseCSVLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export function parseCSV(text) {
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line, i) => {
    const cells = parseCSVLine(line);
    const obj = { __row: i + 2 }; // 1-based file line number
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] != null ? cells[idx].trim() : '';
    });
    return obj;
  });
  return { headers, rows };
}

export function normalizeImportType(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const key = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, '');
  return TYPE_ALIASES[key] || null;
}

export function parseImportDate(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : s;
  }
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const month = parseInt(mdy[1], 10);
    const day = parseInt(mdy[2], 10);
    const year = parseInt(mdy[3], 10);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Validate parsed CSV rows against fundraiser names.
 * @returns {{ valid: object[], errors: { row: number, error: string }[] }}
 */
export function validateTransactionImportRows(rows, fundraisers = []) {
  const fundraiserNames = new Map(
    (fundraisers || []).map((f) => [String(f.name || '').trim().toLowerCase(), f])
  );
  const valid = [];
  const errors = [];

  rows.forEach((row) => {
    const line = row.__row || '?';
    const type = normalizeImportType(row.type);
    if (!type) {
      errors.push({ row: line, error: `Unknown type: ${row.type || '(empty)'}` });
      return;
    }
    const description = String(row.description || '').trim();
    if (!description) {
      errors.push({ row: line, error: 'Description is required' });
      return;
    }
    const amount = parseFloat(row.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push({ row: line, error: `Invalid amount: ${row.amount}` });
      return;
    }
    const date = parseImportDate(row.date);
    if (!date) {
      errors.push({ row: line, error: `Invalid date: ${row.date || '(empty)'}` });
      return;
    }

    const fundraiserName = String(row.fundraiser || '').trim();
    let resolvedFundraiser = null;
    if (type === 'FundraiserIncome' && fundraiserName) {
      resolvedFundraiser = fundraiserNames.get(fundraiserName.toLowerCase()) || null;
      if (!resolvedFundraiser) {
        errors.push({ row: line, error: `Unknown fundraiser: ${fundraiserName}` });
        return;
      }
    }

    valid.push({
      type,
      date,
      description,
      amount,
      category: String(row.category || '').trim(),
      receiptUrl: String(row.receiptUrl || '').trim(),
      fundraiser: fundraiserName,
      donor: String(row.donor || '').trim(),
      resolvedFundraiserName: resolvedFundraiser ? resolvedFundraiser.name : '',
      willLinkFundraiser: Boolean(resolvedFundraiser),
    });
  });

  return { valid, errors };
}

export function buildTransactionImportTemplate() {
  const sample = [
    {
      date: '2026-01-15',
      type: 'Purchase',
      description: 'Parts order – gears',
      category: 'Hardware',
      amount: '42.50',
      receiptUrl: '',
      fundraiser: '',
      donor: '',
    },
    {
      date: '2026-01-20',
      type: 'Donation',
      description: 'Sponsor gift',
      category: 'Sponsors',
      amount: '100.00',
      receiptUrl: '',
      fundraiser: '',
      donor: '',
    },
    {
      date: '2026-02-01',
      type: 'FundraiserIncome',
      description: 'Bake sale day 1',
      category: 'Fundraiser',
      amount: '75.00',
      receiptUrl: '',
      fundraiser: 'Spring Bake Sale',
      donor: 'Anonymous',
    },
    {
      date: '2026-02-10',
      type: 'Reimbursement',
      description: 'Travel reimbursement – Jane',
      category: 'Travel',
      amount: '28.00',
      receiptUrl: '',
      fundraiser: '',
      donor: '',
    },
  ];
  return toCSV(sample, TRANSACTION_CSV_HEADERS);
}
