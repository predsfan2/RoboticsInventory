const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/storage');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

function activityLog(data, action, user, itemId, itemName, details) {
  if (!data['rt:activityLog']) data['rt:activityLog'] = [];
  data['rt:activityLog'].push({
    id: uuidv4(),
    action,
    userName: user ? user.name : 'system',
    userId: user ? user.id : null,
    itemId,
    itemName,
    details,
    date: new Date().toISOString(),
  });
}

// ── GET /api/borrows ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const data = readData();
  let borrows = data['rt:borrows'] || [];
  if (req.query.status) borrows = borrows.filter((b) => b.status === req.query.status);
  res.json(borrows);
});

// ── POST /api/borrows ─────────────────────────────────────────────────────────
router.post('/', requireRole('Admin', 'Manager', 'Member'), (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.body.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

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
  };

  if (!data['rt:borrows']) data['rt:borrows'] = [];
  data['rt:borrows'].push(borrow);
  activityLog(data, 'BORROW_CREATED', req.user, item.id, item.name, `"${item.name}" borrowed by ${borrow.borrowerName}`);
  writeData(data);
  res.status(201).json(borrow);
});

// ── GET /api/borrows/:id ──────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const data = readData();
  const b = (data['rt:borrows'] || []).find((x) => x.id === req.params.id);
  if (!b) return res.status(404).json({ error: 'Borrow not found' });
  res.json(b);
});

// ── PUT /api/borrows/:id ──────────────────────────────────────────────────────
router.put('/:id', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const idx = (data['rt:borrows'] || []).findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Borrow not found' });

  const allowed = ['borrowerName', 'contact', 'expectedReturnDate', 'notes'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data['rt:borrows'][idx][key] = req.body[key];
  }
  writeData(data);
  res.json(data['rt:borrows'][idx]);
});

// ── DELETE /api/borrows/:id ───────────────────────────────────────────────────
router.delete('/:id', requireRole('Admin'), (req, res) => {
  const data = readData();
  const idx = (data['rt:borrows'] || []).findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Borrow not found' });
  data['rt:borrows'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// ── POST /api/borrows/:id/return ──────────────────────────────────────────────
router.post('/:id/return', requireRole('Admin', 'Manager', 'Member'), (req, res) => {
  const data = readData();
  const borrow = (data['rt:borrows'] || []).find((x) => x.id === req.params.id);
  if (!borrow) return res.status(404).json({ error: 'Borrow not found' });
  if (borrow.status === 'returned') return res.status(400).json({ error: 'Already returned' });

  borrow.status = 'returned';
  borrow.returnedAt = new Date().toISOString();
  if (req.body.notes) borrow.notes = req.body.notes;

  const item = (data['rt:items'] || []).find((i) => i.id === borrow.itemId);
  activityLog(data, 'BORROW_RETURNED', req.user, borrow.itemId, item ? item.name : '', `"${item ? item.name : borrow.itemId}" returned by ${borrow.borrowerName}`);
  writeData(data);
  res.json(borrow);
});

module.exports = router;
