'use strict';

const { v4: uuidv4 } = require('uuid');
const { withData } = require('../utils/storage');
const { activityLog } = require('../utils/logging');
const { DomainError } = require('./errors');
const { applyStockChangeInData, applyMoveInData } = require('./inventory');
const { hasPermission } = require('../utils/permissions');

const MAX_UNITS = 500;
const PURCHASE_STATUSES = ['Needed', 'Ordered', 'Received', 'PendingApproval', 'Denied'];

function gateHighPriority(body, user, existing) {
  const priority = body.priority !== undefined ? body.priority : (existing && existing.priority) || 'Medium';
  let status = body.status !== undefined ? body.status : (existing && existing.status) || 'Needed';
  if (
    priority === 'High' &&
    !hasPermission(user, 'approvals.manage') &&
    status !== 'Received' &&
    status !== 'Ordered' &&
    status !== 'Denied'
  ) {
    status = 'PendingApproval';
  }
  return { priority, status };
}

async function createPurchase(body, user) {
  return withData(async (data) => {
    const gated = gateHighPriority(body || {}, user, null);
    const purchase = {
      id: uuidv4(),
      name: body.name || '',
      quantity: parseInt(body.quantity, 10) || 1,
      category: body.category || '',
      priority: gated.priority,
      link: body.link || '',
      status: gated.status,
      notes: body.notes || '',
      requester: body.requester || (user ? user.name : ''),
      date: body.date || new Date().toISOString(),
      createdBy: user ? user.id : null,
      linkedItemId: body.linkedItemId || null,
      estimatedCost: parseFloat(body.estimatedCost) || 0,
      vendor: body.vendor || '',
      receiveLocation: body.receiveLocation || '',
    };
    if (!data['rt:purchases']) data['rt:purchases'] = [];
    data['rt:purchases'].push(purchase);
    activityLog(data, 'CREATE_PURCHASE', user, null, purchase.name, `Purchase request created: "${purchase.name}"`);
    return purchase;
  });
}

function receiveIntoInventory(data, purchase, user, extras) {
  const receiveLocation = (extras && extras.receiveLocation) || purchase.receiveLocation || '';
  if (!data['rt:items']) data['rt:items'] = [];
  let existing = null;
  if (purchase.linkedItemId) {
    existing = data['rt:items'].find((i) => i.id === purchase.linkedItemId) || null;
  }
  if (!existing) {
    existing = data['rt:items'].find(
      (i) => i.name.toLowerCase() === purchase.name.toLowerCase()
    ) || null;
  }

  if (existing) {
    const addQty = Math.min(purchase.quantity, MAX_UNITS - (existing.totalQty || 0));
    applyStockChangeInData(
      data,
      existing.id,
      { change: addQty, reason: `Purchase received (purchase ID: ${purchase.id})` },
      user
    );
    if (receiveLocation) {
      applyMoveInData(data, existing.id, { location: receiveLocation, notes: 'Received from purchase' }, user);
    }
    purchase.linkedItemId = existing.id;
    activityLog(data, 'PURCHASE_RECEIVED', user, existing.id, existing.name,
      `Stock increased by ${addQty} from purchase "${purchase.name}"`);
    return existing;
  }

  const qty = Math.min(purchase.quantity, MAX_UNITS);
  const newItem = {
    id: uuidv4(),
    name: purchase.name,
    itemNumber: '',
    category: purchase.category || '',
    totalQty: 0,
    condition: 'New',
    currentLocation: receiveLocation || '',
    currentPerson: '',
    notes: `Created from purchase order ${purchase.id}`,
    createdAt: new Date().toISOString(),
    conditionLog: [],
    locationLog: [],
    invoices: [],
    comments: [],
    quantityLog: [],
    imageUrl: '',
    customFields: {},
    minStock: 0,
    isKit: false,
    components: [],
  };
  data['rt:items'].push(newItem);
  if (qty > 0) {
    applyStockChangeInData(
      data,
      newItem.id,
      { change: qty, reason: `Purchase received (purchase ID: ${purchase.id})` },
      user
    );
  }
  purchase.linkedItemId = newItem.id;
  activityLog(data, 'PURCHASE_RECEIVED', user, newItem.id, newItem.name,
    `New item "${newItem.name}" created from purchase`);
  return newItem;
}

function maybeCreateFinanceTxn(data, purchase, extras) {
  const cost = extras && extras.amount != null
    ? parseFloat(extras.amount)
    : (parseFloat(purchase.estimatedCost) || 0);
  const shouldCreate = extras && extras.createFinanceTransaction === true && cost > 0;
  if (!shouldCreate) return null;
  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  const txn = {
    id: uuidv4(),
    type: 'Purchase',
    date: new Date().toISOString(),
    description: `PO: ${purchase.name}${purchase.vendor ? ` (${purchase.vendor})` : ''}`,
    amount: cost,
    category: purchase.category || 'Purchases',
    receiptUrl: '',
    linkedPurchaseId: purchase.id,
  };
  data['rt:accountingTransactions'].push(txn);
  purchase.linkedTransactionId = txn.id;
  return txn;
}

async function setPurchaseStatus(purchaseId, status, user, extras = {}) {
  if (!status) throw new DomainError('status is required');
  if (!PURCHASE_STATUSES.includes(status)) {
    throw new DomainError('Invalid purchase status');
  }
  return withData(async (data) => {
    const purchase = (data['rt:purchases'] || []).find((x) => x.id === purchaseId);
    if (!purchase) throw new DomainError('Purchase not found', { status: 404, code: 'not_found' });

    if (status !== 'PendingApproval' && purchase.status === 'PendingApproval' && !hasPermission(user, 'approvals.manage')) {
      throw new DomainError('High-priority purchases must be approved first', { status: 403, code: 'forbidden' });
    }

    const oldStatus = purchase.status;
    purchase.status = status;
    if (extras.receiveLocation) purchase.receiveLocation = extras.receiveLocation;
    if (extras.estimatedCost != null) purchase.estimatedCost = parseFloat(extras.estimatedCost) || 0;

    if (purchase.status === 'Received' && oldStatus !== 'Received') {
      receiveIntoInventory(data, purchase, user, extras);
      maybeCreateFinanceTxn(data, purchase, extras);
    }

    return purchase;
  });
}

async function approvePurchase(id, user) {
  return withData(async (data) => {
    const purchase = (data['rt:purchases'] || []).find((x) => x.id === id);
    if (!purchase) throw new DomainError('Purchase not found', { status: 404, code: 'not_found' });
    if (purchase.status !== 'PendingApproval') throw new DomainError('Purchase is not awaiting approval');
    purchase.status = 'Needed';
    purchase.approvedBy = user ? user.name : 'system';
    purchase.approvedAt = new Date().toISOString();
    activityLog(data, 'PURCHASE_APPROVED', user, null, purchase.name, `High-priority PO approved: "${purchase.name}"`);
    return purchase;
  });
}

async function denyPurchase(id, reason, user) {
  return withData(async (data) => {
    const purchase = (data['rt:purchases'] || []).find((x) => x.id === id);
    if (!purchase) throw new DomainError('Purchase not found', { status: 404, code: 'not_found' });
    if (purchase.status !== 'PendingApproval') throw new DomainError('Purchase is not awaiting approval');
    purchase.status = 'Denied';
    purchase.approvedBy = user ? user.name : 'system';
    purchase.approvedAt = new Date().toISOString();
    purchase.denialReason = reason || '';
    activityLog(data, 'PURCHASE_DENIED', user, null, purchase.name, `PO denied: ${purchase.denialReason}`);
    return purchase;
  });
}

module.exports = {
  createPurchase,
  setPurchaseStatus,
  approvePurchase,
  denyPurchase,
  gateHighPriority,
  PURCHASE_STATUSES,
};
