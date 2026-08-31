'use strict';

const { adjustStock, updateCondition } = require('../services/inventory');
const { createPurchase, setPurchaseStatus } = require('../services/purchases');
const { createBorrow, returnBorrow } = require('../services/borrows');
const { createTransaction } = require('../services/finance');
const { decide } = require('../services/approvals');

async function runAction(actionId, params, user) {
  const p = params || {};
  switch (actionId) {
    case 'inventory.adjust_stock':
      await adjustStock(p.id, { change: p.change, reason: p.reason }, user);
      return {
        ok: true,
        message: 'Stock updated',
        refresh: ['inventory.list', 'inventory.item', 'home.summary'],
        nav: null,
      };
    case 'inventory.update_condition':
      await updateCondition(p.id, { condition: p.condition, note: p.note }, user);
      return {
        ok: true,
        message: `Condition set to ${p.condition || 'updated'}`,
        refresh: ['inventory.list', 'inventory.item', 'home.summary'],
        nav: null,
      };
    case 'purchases.create':
      await createPurchase(p, user);
      return {
        ok: true,
        message: 'Purchase request added',
        refresh: ['purchases.list', 'home.summary'],
        nav: { screen_id: 'purchases' },
      };
    case 'purchases.set_status':
      await setPurchaseStatus(p.id, p.status, user);
      return {
        ok: true,
        message: `Status set to ${p.status}`,
        refresh: ['purchases.list', 'home.summary', 'inventory.list'],
        nav: null,
      };
    case 'borrows.create':
      await createBorrow(p, user);
      return {
        ok: true,
        message: 'Item checked out',
        refresh: ['borrows.list', 'inventory.list', 'home.summary'],
        nav: { screen_id: 'borrows' },
      };
    case 'borrows.return':
      await returnBorrow(p.id, { notes: p.notes }, user);
      return {
        ok: true,
        message: 'Item returned',
        refresh: ['borrows.list', 'inventory.list', 'home.summary'],
        nav: null,
      };
    case 'approvals.decide':
      await decide({ id: p.id, type: p.type, decision: p.decision, reason: p.reason }, user);
      return {
        ok: true,
        message: p.decision === 'deny' ? 'Request denied' : 'Request approved',
        refresh: ['approvals.pending', 'home.approvals', 'home.summary', 'borrows.list', 'finance.summary', 'finance.transactions'],
        nav: { screen_id: 'home' },
      };
    case 'finance.add_transaction':
      await createTransaction(p, user);
      return {
        ok: true,
        message: 'Transaction added',
        refresh: ['finance.summary', 'finance.transactions', 'home.summary'],
        nav: { screen_id: 'finance' },
      };
    default: {
      const err = new Error('Unknown action');
      err.status = 404;
      err.code = 'not_found';
      throw err;
    }
  }
}

module.exports = { runAction };
