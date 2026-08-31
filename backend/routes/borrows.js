'use strict';

const express = require('express');
const router = express.Router();
const { readData, writeData } = require('../utils/storage');
const { requirePermission } = require('../utils/auth');
const { createBorrow, returnBorrow } = require('../services/borrows');
const { sendDomainError } = require('../services/errors');

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
  try {
    const borrow = await createBorrow(req.body || {}, req.user);
    res.status(201).json(borrow);
  } catch (err) {
    return sendDomainError(res, err);
  }
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
  try {
    const borrow = await returnBorrow(req.params.id, req.body || {}, req.user);
    res.json(borrow);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

module.exports = router;
