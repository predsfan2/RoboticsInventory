'use strict';

const { readData } = require('../utils/storage');
const { hasScope } = require('./scopes');
const { computeBalance, formatMoney } = require('../services/finance');
const { listPending } = require('../services/approvals');

function itemSubtitle(item) {
  const bits = [];
  if (item.category) bits.push(item.category);
  if (item.currentLocation) bits.push(item.currentLocation);
  if (item.condition) bits.push(item.condition);
  return bits.join(' · ');
}

function handlers(scopes) {
  return {
    'home.summary'(query) {
      const data = readData() || {};
      const items = data['rt:items'] || [];
      const purchases = data['rt:purchases'] || [];
      const borrows = data['rt:borrows'] || [];
      const stats = [];

      if (hasScope(scopes, 'read:inventory')) {
        const low = items.filter((i) => (i.minStock || 0) > 0 && (i.totalQty || 0) <= i.minStock).length;
        stats.push({ label: 'Items', value: String(items.length) });
        stats.push({ label: 'Low stock', value: String(low), hint: low ? 'At or below minimum' : 'All healthy' });
      }
      if (hasScope(scopes, 'read:purchases')) {
        const open = purchases.filter((p) => p.status !== 'Received').length;
        stats.push({ label: 'Open purchases', value: String(open) });
      }
      if (hasScope(scopes, 'read:borrows')) {
        const active = borrows.filter((b) => b.status === 'active').length;
        stats.push({ label: 'Active borrows', value: String(active) });
      }
      if (hasScope(scopes, 'read:approvals')) {
        stats.push({ label: 'Pending approvals', value: String(listPending().total) });
      }
      if (hasScope(scopes, 'read:finance')) {
        const bal = computeBalance(data['rt:accountingTransactions'] || []);
        stats.push({ label: 'Balance', value: formatMoney(bal.balance) });
        stats.push({ label: 'Income', value: formatMoney(bal.income) });
        stats.push({ label: 'Expenses', value: formatMoney(bal.expenses) });
      }
      if (stats.length === 0) {
        stats.push({ label: 'Hub', value: 'Paired', hint: 'No read scopes granted' });
      }
      return { stats };
    },

    'home.approvals'() {
      const pending = listPending();
      const items = [];
      for (const m of pending.moveRequests) {
        items.push({
          id: m.id,
          title: `Move · ${m.requestedLocation || 'location'}`,
          subtitle: m.requestedBy ? `Requested by ${m.requestedBy}` : 'Move request',
          trailing: 'Pending',
        });
      }
      for (const r of pending.reimbursements) {
        items.push({
          id: r.id,
          title: `Reimburse ${formatMoney(r.amount)}`,
          subtitle: r.userName ? `${r.userName} · ${r.reason || ''}`.trim() : (r.reason || 'Reimbursement'),
          trailing: 'Pending',
        });
      }
      for (const p of pending.purchases || []) {
        items.push({
          id: p.id,
          title: `PO · ${p.name}`,
          subtitle: `High priority · ${p.requester || 'request'}`,
          trailing: 'Pending',
        });
      }
      return { items, next_cursor: null };
    },

    'inventory.list'(query) {
      const data = readData() || {};
      const q = String(query.q || '').trim().toLowerCase();
      let items = data['rt:items'] || [];
      if (q) {
        items = items.filter((i) => {
          const hay = [i.name, i.itemNumber, i.category, i.currentLocation, i.currentPerson, i.notes]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        });
      }
      return {
        items: items.slice(0, 100).map((i) => ({
          id: i.id,
          title: i.name,
          subtitle: itemSubtitle(i),
          trailing: `×${i.totalQty || 0}`,
        })),
        next_cursor: null,
      };
    },

    'inventory.item'(query) {
      const data = readData() || {};
      const item = (data['rt:items'] || []).find((i) => i.id === query.id);
      if (!item) {
        const err = new Error('Item not found');
        err.status = 404;
        err.code = 'not_found';
        throw err;
      }
      return {
        stats: [
          { label: 'Name', value: item.name || '—' },
          { label: 'Qty', value: String(item.totalQty || 0) },
          { label: 'Condition', value: item.condition || '—' },
          { label: 'Location', value: item.currentLocation || '—' },
          { label: 'With', value: item.currentPerson || '—' },
          { label: 'Category', value: item.category || '—' },
          { label: 'SKU', value: item.itemNumber || '—' },
        ],
      };
    },

    'purchases.list'() {
      const data = readData() || {};
      const items = (data['rt:purchases'] || []).slice().reverse().slice(0, 50).map((p) => ({
        id: p.id,
        title: p.name || 'Untitled',
        subtitle: `${p.priority || 'Medium'} · qty ${p.quantity || 1}`,
        trailing: p.status || 'Needed',
      }));
      return { items, next_cursor: null };
    },

    'borrows.list'() {
      const data = readData() || {};
      const itemsById = new Map((data['rt:items'] || []).map((i) => [i.id, i]));
      const items = (data['rt:borrows'] || [])
        .filter((b) => b.status === 'active')
        .map((b) => {
          const item = itemsById.get(b.itemId);
          return {
            id: b.id,
            title: item ? item.name : b.itemId,
            subtitle: b.borrowerName || 'Borrower',
            trailing: b.expectedReturnDate ? String(b.expectedReturnDate).slice(0, 10) : 'Out',
          };
        });
      return { items, next_cursor: null };
    },

    'approvals.pending'() {
      return this['home.approvals']();
    },

    'finance.summary'() {
      const data = readData() || {};
      const bal = computeBalance(data['rt:accountingTransactions'] || []);
      return {
        stats: [
          { label: 'Balance', value: formatMoney(bal.balance) },
          { label: 'Income', value: formatMoney(bal.income) },
          { label: 'Expenses', value: formatMoney(bal.expenses) },
          { label: 'Transactions', value: String((data['rt:accountingTransactions'] || []).length) },
        ],
      };
    },

    'finance.transactions'() {
      const data = readData() || {};
      const items = (data['rt:accountingTransactions'] || []).slice().reverse().slice(0, 40).map((t) => ({
        id: t.id,
        title: t.description || t.type || 'Transaction',
        subtitle: `${t.type || ''} · ${t.category || ''} · ${String(t.date || '').slice(0, 10)}`.replace(/ · +/g, ' · ').trim(),
        trailing: formatMoney(t.amount),
      }));
      return { items, next_cursor: null };
    },
  };
}

function getData(key, query, scopes) {
  const map = handlers(scopes);
  const fn = map[key];
  if (!fn) {
    const err = new Error('Unknown data key');
    err.status = 404;
    err.code = 'not_found';
    throw err;
  }
  return fn.call(map, query || {});
}

module.exports = { getData };
