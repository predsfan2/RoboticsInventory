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

// ── GET /api/purchases ────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const data = readData();
  let purchases = data['rt:purchases'] || [];
  if (req.query.status) purchases = purchases.filter((p) => p.status === req.query.status);
  res.json(purchases);
});

// ── POST /api/purchases ───────────────────────────────────────────────────────
router.post('/', requireRole('Admin', 'Manager', 'Member'), (req, res) => {
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
  };

  if (!data['rt:purchases']) data['rt:purchases'] = [];
  data['rt:purchases'].push(purchase);
  activityLog(data, 'CREATE_PURCHASE', req.user, null, purchase.name, `Purchase request created: "${purchase.name}"`);
  writeData(data);
  res.status(201).json(purchase);
});

// ── GET /api/purchases/:id ────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const data = readData();
  const p = (data['rt:purchases'] || []).find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Purchase not found' });
  res.json(p);
});

// ── PUT /api/purchases/:id ────────────────────────────────────────────────────
router.put('/:id', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const idx = (data['rt:purchases'] || []).findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Purchase not found' });

  const allowed = ['name', 'quantity', 'category', 'priority', 'link', 'status', 'notes', 'requester', 'date'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data['rt:purchases'][idx][key] = req.body[key];
  }
  writeData(data);
  res.json(data['rt:purchases'][idx]);
});

// ── DELETE /api/purchases/:id ─────────────────────────────────────────────────
router.delete('/:id', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const idx = (data['rt:purchases'] || []).findIndex((x) => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Purchase not found' });
  data['rt:purchases'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// ── PATCH /api/purchases/:id/status ──────────────────────────────────────────
router.patch('/:id/status', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const purchase = (data['rt:purchases'] || []).find((x) => x.id === req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

  const oldStatus = purchase.status;
  purchase.status = req.body.status || purchase.status;

  // Auto-create item or add stock when status becomes "Received"
  if (purchase.status === 'Received' && oldStatus !== 'Received') {
    if (!data['rt:items']) data['rt:items'] = [];
    const existing = data['rt:items'].find(
      (i) => i.name.toLowerCase() === purchase.name.toLowerCase()
    );
    if (existing) {
      existing.totalQty += purchase.quantity;
      existing.quantityLog.push({
        id: uuidv4(),
        change: purchase.quantity,
        reason: `Purchase received (purchase ID: ${purchase.id})`,
        userName: req.user ? req.user.name : 'system',
        date: new Date().toISOString(),
      });
      activityLog(data, 'PURCHASE_RECEIVED', req.user, existing.id, existing.name,
        `Stock increased by ${purchase.quantity} from purchase "${purchase.name}"`);
    } else {
      const newItem = {
        id: uuidv4(),
        name: purchase.name,
        itemNumber: '',
        category: purchase.category || '',
        totalQty: purchase.quantity,
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

      // Generate units if qty > 1
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
    }
    purchase.linkedItemId = existing ? existing.id : data['rt:items'][data['rt:items'].length - 1].id;
  }

  writeData(data);
  res.json(purchase);
});

module.exports = router;
