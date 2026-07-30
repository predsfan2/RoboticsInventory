'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { readData, writeData, DATA_DIR } = require('../utils/storage');
const { requirePermission } = require('../utils/auth');
const { hasPermission } = require('../utils/permissions');
const { auditLog, activityLog } = require('../utils/logging');
const { saveBase64Upload, IMAGE_MIMES, INVOICE_MIMES } = require('../utils/uploads');

const MAX_UNITS = 500;

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireConditionUpdate(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (hasPermission(req.user, 'inventory.edit')) return next();
  // Members (and similar) with view access can update condition; Viewers cannot
  if (hasPermission(req.user, 'inventory.view') && req.user.role !== 'Viewer') return next();
  return res.status(403).json({ error: 'Forbidden' });
}

router.get('/', requirePermission('inventory.view'), (req, res) => {
  const data = readData();
  res.json(data['rt:items'] || []);
});

router.post('/', requirePermission('inventory.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const now = new Date().toISOString();
  let totalQty = parseInt(req.body.totalQty, 10) || 1;
  if (totalQty > MAX_UNITS) totalQty = MAX_UNITS;

  const item = {
    id: uuidv4(),
    name: req.body.name || 'Unnamed Item',
    itemNumber: req.body.itemNumber || '',
    category: req.body.category || '',
    totalQty,
    condition: req.body.condition || 'Good',
    currentLocation: req.body.currentLocation || '',
    currentPerson: req.body.currentPerson || '',
    notes: req.body.notes || '',
    createdAt: now,
    conditionLog: [],
    locationLog: [],
    invoices: [],
    comments: [],
    quantityLog: [],
    imageUrl: req.body.imageUrl || '',
    customFields: req.body.customFields || {},
    minStock: parseInt(req.body.minStock, 10) || 0,
    isKit: !!req.body.isKit,
    components: Array.isArray(req.body.components) ? req.body.components : [],
  };

  if (!data['rt:items']) data['rt:items'] = [];
  data['rt:items'].push(item);

  if (item.totalQty > 1) {
    if (!data['rt:units']) data['rt:units'] = [];
    for (let i = 1; i <= item.totalQty; i++) {
      data['rt:units'].push({
        id: `${item.id}-unit-${i}`,
        parentId: item.id,
        unitSku: `${item.id}-${i}`,
        condition: item.condition,
        conditionLog: [],
        currentLocation: item.currentLocation,
        currentPerson: item.currentPerson,
      });
    }
  }

  auditLog(data, 'CREATE_ITEM', req.user, item.id, item.name, null, item);
  activityLog(data, 'CREATE_ITEM', req.user, item.id, item.name, `Created item "${item.name}"`);
  await writeData(data);
  res.status(201).json(item);
}));

router.put('/:id', requirePermission('inventory.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:items'] || []).findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });

  const before = { ...data['rt:items'][idx] };
  const allowed = [
    'name', 'itemNumber', 'category', 'condition', 'currentLocation',
    'currentPerson', 'notes', 'imageUrl', 'customFields', 'minStock',
    'isKit', 'components',
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data['rt:items'][idx][key] = req.body[key];
  }

  auditLog(data, 'UPDATE_ITEM', req.user, req.params.id, data['rt:items'][idx].name, before, data['rt:items'][idx]);
  activityLog(data, 'UPDATE_ITEM', req.user, req.params.id, data['rt:items'][idx].name, 'Item updated');
  await writeData(data);
  res.json(data['rt:items'][idx]);
}));

router.delete('/:id', requirePermission('inventory.delete'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:items'] || []).findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });

  const item = data['rt:items'][idx];
  data['rt:items'].splice(idx, 1);
  data['rt:units'] = (data['rt:units'] || []).filter((u) => u.parentId !== req.params.id);

  auditLog(data, 'DELETE_ITEM', req.user, item.id, item.name, item, null);
  activityLog(data, 'DELETE_ITEM', req.user, item.id, item.name, `Deleted item "${item.name}"`);
  await writeData(data);
  res.json({ success: true });
}));

router.post('/:id/stock', requirePermission('inventory.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const change = parseInt(req.body.change, 10);
  if (isNaN(change)) return res.status(400).json({ error: 'change must be an integer' });

  const before = { totalQty: item.totalQty };
  const nextQty = Math.max(0, item.totalQty + change);
  if (nextQty > MAX_UNITS) return res.status(400).json({ error: `Quantity cannot exceed ${MAX_UNITS}` });
  item.totalQty = nextQty;

  const entry = {
    id: uuidv4(),
    change,
    reason: req.body.reason || '',
    userName: req.user ? req.user.name : 'system',
    date: new Date().toISOString(),
  };
  item.quantityLog.push(entry);

  if (!data['rt:units']) data['rt:units'] = [];
  const existingUnits = data['rt:units'].filter((u) => u.parentId === item.id);

  if (change > 0) {
    let nextIdx = existingUnits.length + 1;
    for (let i = 0; i < change; i++, nextIdx++) {
      data['rt:units'].push({
        id: `${item.id}-unit-${nextIdx}`,
        parentId: item.id,
        unitSku: `${item.id}-${nextIdx}`,
        condition: item.condition,
        conditionLog: [],
        currentLocation: item.currentLocation,
        currentPerson: item.currentPerson,
      });
    }
  } else if (change < 0) {
    const toRemove = Math.min(Math.abs(change), existingUnits.length);
    const removeIds = existingUnits.slice(-toRemove).map((u) => u.id);
    data['rt:units'] = data['rt:units'].filter((u) => !removeIds.includes(u.id));
  }

  auditLog(data, 'ADJUST_STOCK', req.user, item.id, item.name, before, { totalQty: item.totalQty });
  activityLog(data, 'ADJUST_STOCK', req.user, item.id, item.name, `Stock adjusted by ${change}. Reason: ${entry.reason}`);
  await writeData(data);
  res.json(item);
}));

router.post('/:id/condition', requireConditionUpdate, asyncHandler(async (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const before = { condition: item.condition };
  item.condition = req.body.condition || item.condition;

  const entry = {
    id: uuidv4(),
    condition: item.condition,
    note: req.body.note || '',
    date: new Date().toISOString(),
    userName: req.user ? req.user.name : 'system',
  };
  item.conditionLog.push(entry);

  auditLog(data, 'UPDATE_CONDITION', req.user, item.id, item.name, before, { condition: item.condition });
  activityLog(data, 'UPDATE_CONDITION', req.user, item.id, item.name, `Condition updated to "${item.condition}"`);
  await writeData(data);
  res.json(item);
}));

router.post('/:id/move-request', requirePermission('moves.request'), asyncHandler(async (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  if (!data['rt:moveRequests']) data['rt:moveRequests'] = [];
  const mr = {
    id: uuidv4(),
    itemId: item.id,
    requestedLocation: req.body.requestedLocation || '',
    requestedPerson: req.body.requestedPerson || '',
    notes: req.body.notes || '',
    requestedBy: req.user ? req.user.name : 'unknown',
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    denialReason: null,
  };
  data['rt:moveRequests'].push(mr);

  activityLog(data, 'MOVE_REQUEST', req.user, item.id, item.name, `Move request created for "${item.name}"`);
  await writeData(data);
  res.status(201).json(mr);
}));

router.post('/:id/move', requirePermission('moves.approve'), asyncHandler(async (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const before = { currentLocation: item.currentLocation, currentPerson: item.currentPerson };
  item.currentLocation = req.body.location || item.currentLocation;
  item.currentPerson = req.body.person !== undefined ? req.body.person : item.currentPerson;

  const entry = {
    id: uuidv4(),
    location: item.currentLocation,
    person: item.currentPerson,
    movedBy: req.user ? req.user.name : 'system',
    notes: req.body.notes || '',
    date: new Date().toISOString(),
  };
  item.locationLog.push(entry);

  auditLog(data, 'MOVE_ITEM', req.user, item.id, item.name, before, {
    currentLocation: item.currentLocation,
    currentPerson: item.currentPerson,
  });
  activityLog(data, 'MOVE_ITEM', req.user, item.id, item.name, `Moved to "${item.currentLocation}"`);
  await writeData(data);
  res.json(item);
}));

router.get('/:id/units', requirePermission('inventory.view'), (req, res) => {
  const data = readData();
  const units = (data['rt:units'] || []).filter((u) => u.parentId === req.params.id);
  res.json(units);
});

router.put('/units/:unitId', requirePermission('inventory.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const unit = (data['rt:units'] || []).find((u) => u.id === req.params.unitId);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  if (req.body.condition !== undefined) {
    unit.conditionLog.push({
      id: uuidv4(),
      condition: req.body.condition,
      note: req.body.conditionNote || '',
      date: new Date().toISOString(),
      userName: req.user ? req.user.name : 'system',
    });
    unit.condition = req.body.condition;
  }
  if (req.body.currentLocation !== undefined) unit.currentLocation = req.body.currentLocation;
  if (req.body.currentPerson !== undefined) unit.currentPerson = req.body.currentPerson;

  await writeData(data);
  res.json(unit);
}));

router.post('/:id/image', requirePermission('inventory.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  try {
    const saved = saveBase64Upload({
      base64: req.body.base64,
      mimeType: req.body.mimeType,
      prefix: `${item.id}-image`,
      allowedMimes: IMAGE_MIMES,
      maxBytes: 4 * 1024 * 1024,
    });
    item.imageUrl = saved.url;
    await writeData(data);
    res.json({ imageUrl: item.imageUrl });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
}));

router.get('/:id/image', requirePermission('inventory.view'), (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.id);
  if (!item || !item.imageUrl) return res.status(404).json({ error: 'No image' });

  const filename = path.basename(item.imageUrl);
  const filepath = path.join(DATA_DIR, 'uploads', filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Image file not found' });
  res.sendFile(filepath);
});

router.post('/invoices/:itemId', requirePermission('inventory.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  try {
    const saved = saveBase64Upload({
      base64: req.body.base64,
      mimeType: req.body.mimeType,
      prefix: `${item.id}-invoice`,
      allowedMimes: INVOICE_MIMES,
      maxBytes: 4 * 1024 * 1024,
    });
    const invoice = {
      id: uuidv4(),
      name: req.body.name || saved.filename,
      type: saved.mimeType,
      size: saved.size,
      uploadedBy: req.user ? req.user.name : 'system',
      date: new Date().toISOString(),
      url: saved.url,
    };
    item.invoices.push(invoice);
    await writeData(data);
    res.status(201).json(invoice);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
}));

router.delete('/invoices/:itemId/:invoiceId', requirePermission('inventory.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const invIdx = item.invoices.findIndex((inv) => inv.id === req.params.invoiceId);
  if (invIdx === -1) return res.status(404).json({ error: 'Invoice not found' });

  const [inv] = item.invoices.splice(invIdx, 1);
  if (inv.url) {
    const filepath = path.join(DATA_DIR, 'uploads', path.basename(inv.url));
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
  await writeData(data);
  res.json({ success: true });
}));

router.post('/:id/comments', requirePermission('inventory.view'), asyncHandler(async (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const comment = {
    id: uuidv4(),
    text: req.body.text || '',
    userName: req.user ? req.user.name : 'unknown',
    userId: req.user ? req.user.id : null,
    date: new Date().toISOString(),
  };
  item.comments.push(comment);
  await writeData(data);
  res.status(201).json(comment);
}));

module.exports = router;
