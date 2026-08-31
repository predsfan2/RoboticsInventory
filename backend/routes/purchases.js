'use strict';

const express = require('express');
const router = express.Router();
const { readData, writeData } = require('../utils/storage');
const { requirePermission } = require('../utils/auth');
const { createPurchase, setPurchaseStatus, approvePurchase, denyPurchase, gateHighPriority } = require('../services/purchases');
const { sendDomainError } = require('../services/errors');

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
  try {
    const purchase = await createPurchase(req.body || {}, req.user);
    res.status(201).json(purchase);
  } catch (err) {
    return sendDomainError(res, err);
  }
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

  const allowed = [
    'name', 'quantity', 'category', 'priority', 'link', 'status', 'notes',
    'requester', 'date', 'linkedItemId', 'estimatedCost', 'vendor', 'receiveLocation',
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data['rt:purchases'][idx][key] = req.body[key];
  }
  const gated = gateHighPriority(data['rt:purchases'][idx], req.user, data['rt:purchases'][idx]);
  data['rt:purchases'][idx].priority = gated.priority;
  data['rt:purchases'][idx].status = gated.status;
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
  try {
    const extras = {
      createFinanceTransaction: !!(req.body && req.body.createFinanceTransaction),
      receiveLocation: req.body && req.body.receiveLocation,
      amount: req.body && req.body.amount,
      estimatedCost: req.body && req.body.estimatedCost,
    };
    const purchase = await setPurchaseStatus(req.params.id, (req.body && req.body.status) || '', req.user, extras);
    res.json(purchase);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

router.post('/:id/approve', requirePermission('approvals.manage'), asyncHandler(async (req, res) => {
  try {
    const purchase = await approvePurchase(req.params.id, req.user);
    res.json(purchase);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

router.post('/:id/deny', requirePermission('approvals.manage'), asyncHandler(async (req, res) => {
  try {
    const purchase = await denyPurchase(req.params.id, req.body && req.body.reason, req.user);
    res.json(purchase);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

module.exports = router;
