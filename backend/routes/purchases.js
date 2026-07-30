'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/storage');
const { requirePermission } = require('../utils/auth');
const { activityLog } = require('../utils/logging');

const MAX_UNITS = 500;

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get('/', requirePermission('purchases.view'), (req, res) => {
  const data = readData();
  let purchases = data['rt:purchases'] || [];
  if (req.query.status) purchases = purchases.filter((p) => p.status === req.query.status);
  res.json(purchases);
});

router.post('/', requirePermission('purchases.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const purchase = {
    id: uuidv4(),
    name: req.body.name || '',
    quantity: parseInt(req.body.quantity, 10) || 1,
    category: req.body.category || '',
    priority: req.body.priority || 'Medium',
    link: req.body.link || '',
    status: req.body.status || 'Needed',
    notes: req.body.notes || '',
    requester: req.body.requester || (req.user ? req.user.name : ''),
    date: req.body.date || new Date().toISOString(),
    createdBy: req.user ? req.user.id : null,
    linkedItemId: req.body.linkedItemId || null,
  };

  if (!data['rt:purchases']) data['rt:purchases'] = [];
  data['rt:purchases'].push(purchase);
  activityLog(data, 'CREATE_PURCHASE', req.user, null, purchase.name, `Purchase request created: "${purchase.name}"`);
  await writeData(data);
  res.status(201).json(purchase);
}));

router.get('/:id', requirePermission('purchases.view'), (req, res) => {
  const data = readData();
  const p = (data['rt:purchases'] || []).find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Purchase not found' });
  res.json(p);
});

router.put('/:id', requirePermission('purchases.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:purchases'] || []).findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Purchase not found' });

  const allowed = ['name', 'quantity', 'category', 'priority', 'link', 'status', 'notes', 'requester', 'date', 'linkedItemId'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data['rt:purchases'][idx][key] = req.body[key];
  }
  await writeData(data);
  res.json(data['rt:purchases'][idx]);
}));

router.delete('/:id', requirePermission('purchases.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:purchases'] || []).findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Purchase not found' });
  data['rt:purchases'].splice(idx, 1);
  await writeData(data);
  res.json({ success: true });
}));

router.patch('/:id/status', requirePermission('purchases.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const purchase = (data['rt:purchases'] || []).find((x) => x.id === req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

  const oldStatus = purchase.status;
  purchase.status = req.body.status || purchase.status;

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
      existing.quantityLog.push({
        id: uuidv4(),
        change: addQty,
        reason: `Purchase received (purchase ID: ${purchase.id})`,
        userName: req.user ? req.user.name : 'system',
        date: new Date().toISOString(),
      });
      activityLog(data, 'PURCHASE_RECEIVED', req.user, existing.id, existing.name,
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
      activityLog(data, 'PURCHASE_RECEIVED', req.user, newItem.id, newItem.name,
        `New item "${newItem.name}" created from purchase`);
      purchase.linkedItemId = newItem.id;
    }
  }

  await writeData(data);
  res.json(purchase);
}));

module.exports = router;
