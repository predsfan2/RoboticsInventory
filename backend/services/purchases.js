'use strict';

const { v4: uuidv4 } = require('uuid');
const { withData } = require('../utils/storage');
const { activityLog } = require('../utils/logging');
const { DomainError } = require('./errors');

const MAX_UNITS = 500;

async function createPurchase(body, user) {
  return withData(async (data) => {
    const purchase = {
      id: uuidv4(),
      name: body.name || '',
      quantity: parseInt(body.quantity, 10) || 1,
      category: body.category || '',
      priority: body.priority || 'Medium',
      link: body.link || '',
      status: body.status || 'Needed',
      notes: body.notes || '',
      requester: body.requester || (user ? user.name : ''),
      date: body.date || new Date().toISOString(),
      createdBy: user ? user.id : null,
      linkedItemId: body.linkedItemId || null,
    };
    if (!data['rt:purchases']) data['rt:purchases'] = [];
    data['rt:purchases'].push(purchase);
    activityLog(data, 'CREATE_PURCHASE', user, null, purchase.name, `Purchase request created: "${purchase.name}"`);
    return purchase;
  });
}

async function setPurchaseStatus(purchaseId, status, user) {
  if (!status) throw new DomainError('status is required');
  return withData(async (data) => {
    const purchase = (data['rt:purchases'] || []).find((x) => x.id === purchaseId);
    if (!purchase) throw new DomainError('Purchase not found', { status: 404, code: 'not_found' });

    const oldStatus = purchase.status;
    purchase.status = status;

    if (purchase.status === 'Received' && oldStatus !== 'Received') {
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
        existing.totalQty = (existing.totalQty || 0) + addQty;
        if (!Array.isArray(existing.quantityLog)) existing.quantityLog = [];
        existing.quantityLog.push({
          id: uuidv4(),
          change: addQty,
          reason: `Purchase received (purchase ID: ${purchase.id})`,
          userName: user ? user.name : 'system',
          date: new Date().toISOString(),
        });
        activityLog(data, 'PURCHASE_RECEIVED', user, existing.id, existing.name,
          `Stock increased by ${addQty} from purchase "${purchase.name}"`);
        purchase.linkedItemId = existing.id;
      } else {
        const qty = Math.min(purchase.quantity, MAX_UNITS);
        const newItem = {
          id: uuidv4(),
          name: purchase.name,
          itemNumber: '',
          category: purchase.category || '',
          totalQty: qty,
          condition: 'New',
          currentLocation: '',
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

        if (newItem.totalQty > 1) {
          if (!data['rt:units']) data['rt:units'] = [];
          for (let i = 1; i <= newItem.totalQty; i++) {
            data['rt:units'].push({
              id: `${newItem.id}-unit-${i}`,
              parentId: newItem.id,
              unitSku: `${newItem.id}-${i}`,
              condition: 'New',
              conditionLog: [],
              currentLocation: '',
              currentPerson: '',
            });
          }
        }
        activityLog(data, 'PURCHASE_RECEIVED', user, newItem.id, newItem.name,
          `New item "${newItem.name}" created from purchase`);
        purchase.linkedItemId = newItem.id;
      }
    }

    return purchase;
  });
}

module.exports = { createPurchase, setPurchaseStatus };
