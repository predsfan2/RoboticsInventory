'use strict';

const { adjustStock, updateCondition, applyMove, requestMove } = require('../services/inventory');
const { createPurchase, setPurchaseStatus } = require('../services/purchases');
const { createBorrow, returnBorrow } = require('../services/borrows');
const { createTransaction, createReimbursement } = require('../services/finance');
const { decide } = require('../services/approvals');

async function runAction(actionId, params, user) {
  const p = params || {};
  switch (actionId) {
    case 'inventory.adjust_stock':
      await adjustStock(p.id, { change: p.change, reason: p.reason, unitIds: p.unitIds }, user);
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
    case 'inventory.request_move':
      await requestMove(p.id, p, user);
      return {
        ok: true,
        message: 'Move requested',
        refresh: ['inventory.item', 'home.approvals', 'approvals.pending'],
        nav: null,
      };
    case 'inventory.move':
      await applyMove(p.id, { location: p.location, person: p.person, notes: p.notes }, user);
      return {
        ok: true,
        message: 'Item moved',
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
      await setPurchaseStatus(p.id, p.status, user, {
        createFinanceTransaction: !!p.createFinanceTransaction || (p.amount != null && Number(p.amount) > 0),
        amount: p.amount,
        receiveLocation: p.receiveLocation,
      });
      return {
        ok: true,
        message: `Status set to ${p.status}`,
        refresh: ['purchases.list', 'home.summary', 'inventory.list'],
        nav: null,
      };
    case 'purchases.receive':
      await setPurchaseStatus(p.id, 'Received', user, {
        createFinanceTransaction: p.amount != null && Number(p.amount) > 0,
        amount: p.amount,
        receiveLocation: p.receiveLocation,
      });
      return {
        ok: true,
        message: 'Purchase received',
        refresh: ['purchases.list', 'home.summary', 'inventory.list', 'finance.summary', 'finance.transactions'],
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
        refresh: ['approvals.pending', 'home.approvals', 'home.summary', 'borrows.list', 'finance.summary', 'finance.transactions', 'purchases.list'],
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
    case 'finance.create_reimbursement':
      await createReimbursement(p, user);
      return {
        ok: true,
        message: 'Reimbursement submitted',
        refresh: ['home.approvals', 'approvals.pending', 'finance.summary'],
        nav: { screen_id: 'home' },
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
