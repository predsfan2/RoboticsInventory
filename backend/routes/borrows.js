'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/storage');
const { requirePermission } = require('../utils/auth');
const { activityLog } = require('../utils/logging');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get('/', requirePermission('borrows.view'), (req, res) => {
  const data = readData();
  let borrows = data['rt:borrows'] || [];
  if (req.query.status) borrows = borrows.filter((b) => b.status === req.query.status);
  res.json(borrows);
});

router.post('/', requirePermission('borrows.manage'), asyncHandler(async (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.body.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  if ((item.totalQty || 0) < 1) {
    return res.status(400).json({ error: 'Item has no available quantity to borrow' });
  }

  const activeBorrows = (data['rt:borrows'] || []).filter(
    (b) => b.itemId === item.id && b.status === 'active'
  ).length;
  if (activeBorrows >= item.totalQty) {
    return res.status(400).json({ error: 'All units of this item are already borrowed' });
  }

  const borrow = {
    id: uuidv4(),
    itemId: req.body.itemId,
    borrowerName: req.body.borrowerName || (req.user ? req.user.name : ''),
    contact: req.body.contact || '',
    expectedReturnDate: req.body.expectedReturnDate || null,
    status: 'active',
    notes: req.body.notes || '',
    createdAt: new Date().toISOString(),
    returnedAt: null,
    previousPerson: item.currentPerson || '',
  };

  item.currentPerson = borrow.borrowerName;
  item.locationLog.push({
    id: uuidv4(),
    location: item.currentLocation,
    person: borrow.borrowerName,
    movedBy: req.user ? req.user.name : 'system',
    notes: `Borrowed: ${borrow.notes || ''}`.trim(),
    date: new Date().toISOString(),
  });

  if (!data['rt:borrows']) data['rt:borrows'] = [];
  data['rt:borrows'].push(borrow);
  activityLog(data, 'BORROW_CREATED', req.user, item.id, item.name,
    `"${item.name}" borrowed by ${borrow.borrowerName}`);
  await writeData(data);
  res.status(201).json(borrow);
}));

router.get('/:id', requirePermission('borrows.view'), (req, res) => {
  const data = readData();
  const b = (data['rt:borrows'] || []).find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Borrow not found' });
  res.json(b);
});

router.put('/:id', requirePermission('borrows.manage'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:borrows'] || []).findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Borrow not found' });

  const allowed = ['borrowerName', 'contact', 'expectedReturnDate', 'notes'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data['rt:borrows'][idx][key] = req.body[key];
  }
  await writeData(data);
  res.json(data['rt:borrows'][idx]);
}));

router.delete('/:id', requirePermission('borrows.manage'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:borrows'] || []).findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Borrow not found' });
  data['rt:borrows'].splice(idx, 1);
  await writeData(data);
  res.json({ success: true });
}));

router.post('/:id/return', requirePermission('borrows.manage'), asyncHandler(async (req, res) => {
  const data = readData();
  const borrow = (data['rt:borrows'] || []).find((x) => x.id === req.params.id);
  if (!borrow) return res.status(404).json({ error: 'Borrow not found' });
  if (borrow.status === 'returned') return res.status(400).json({ error: 'Already returned' });

  borrow.status = 'returned';
  borrow.returnedAt = new Date().toISOString();
  if (req.body.notes) borrow.notes = req.body.notes;

  const item = (data['rt:items'] || []).find((i) => i.id === borrow.itemId);
  if (item) {
    item.currentPerson = borrow.previousPerson || '';
    item.locationLog.push({
      id: uuidv4(),
      location: item.currentLocation,
      person: item.currentPerson,
      movedBy: req.user ? req.user.name : 'system',
      notes: 'Returned from borrow',
      date: new Date().toISOString(),
    });
  }
  activityLog(data, 'BORROW_RETURNED', req.user, borrow.itemId, item ? item.name : '',
    `"${item ? item.name : borrow.itemId}" returned by ${borrow.borrowerName}`);
  await writeData(data);
  res.json(borrow);
}));

module.exports = router;
