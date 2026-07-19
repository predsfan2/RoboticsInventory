const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { readData, writeData, DATA_DIR } = require('../utils/storage');
const { requirePermission, requireRole } = require('../utils/auth');

// ── Helpers ──────────────────────────────────────────────────────────────────


function auditLog(data, action, user, itemId, itemName, before, after) {
  if (!data['rt:auditLog']) data['rt:auditLog'] = [];
  data['rt:auditLog'].push({
    id: uuidv4(),
    action,
    userId: user ? user.id : null,
    userName: user ? user.name : 'system',
    itemId,
    itemName,
    before: before ? JSON.stringify(before) : null,
    after: after ? JSON.stringify(after) : null,
    timestamp: new Date().toISOString(),
  });
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

// ── GET /api/items ────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const data = readData();
  res.json(data['rt:items'] || []);
});

// ── POST /api/items ───────────────────────────────────────────────────────────
router.post('/', requirePermission('inventory.edit'), (req, res) => {
  const data = readData();
  const now = new Date().toISOString();
  const item = {
    id: uuidv4(),
    name: req.body.name || 'Unnamed Item',
    itemNumber: req.body.itemNumber || '',
    category: req.body.category || '',
    totalQty: parseInt(req.body.totalQty, 10) || 1,
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
    components: req.body.components || [],
  };

  if (!data['rt:items']) data['rt:items'] = [];
  data['rt:items'].push(item);

  // Generate units if qty > 1
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
  writeData(data);
  res.status(201).json(item);
});

// ── PUT /api/items/:id ────────────────────────────────────────────────────────
router.put('/:id', requirePermission('inventory.edit'), (req, res) => {
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
  writeData(data);
  res.json(data['rt:items'][idx]);
});

// ── DELETE /api/items/:id ─────────────────────────────────────────────────────
router.delete('/:id', requirePermission('inventory.delete'), (req, res) => {
  const data = readData();
  const idx = (data['rt:items'] || []).findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });

  const item = data['rt:items'][idx];
  data['rt:items'].splice(idx, 1);
  // Remove units
  data['rt:units'] = (data['rt:units'] || []).filter((u) => u.parentId !== req.params.id);

  auditLog(data, 'DELETE_ITEM', req.user, item.id, item.name, item, null);
  activityLog(data, 'DELETE_ITEM', req.user, item.id, item.name, `Deleted item "${item.name}"`);
  writeData(data);
  res.json({ success: true });
});

// ── POST /api/items/:id/stock ─────────────────────────────────────────────────
router.post('/:id/stock', requirePermission('inventory.edit'), (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const change = parseInt(req.body.change, 10);
  if (isNaN(change)) return res.status(400).json({ error: 'change must be an integer' });

  const before = { totalQty: item.totalQty };
  item.totalQty = Math.max(0, item.totalQty + change);

  const entry = {
    id: uuidv4(),
    change,
    reason: req.body.reason || '',
    userName: req.user ? req.user.name : 'system',
    date: new Date().toISOString(),
  };
  item.quantityLog.push(entry);

  // Add/remove units accordingly
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
    // Remove the last |change| units
    const toRemove = Math.min(Math.abs(change), existingUnits.length);
    const removeIds = existingUnits.slice(-toRemove).map((u) => u.id);
    data['rt:units'] = data['rt:units'].filter((u) => !removeIds.includes(u.id));
  }

  auditLog(data, 'ADJUST_STOCK', req.user, item.id, item.name, before, { totalQty: item.totalQty });
  activityLog(data, 'ADJUST_STOCK', req.user, item.id, item.name, `Stock adjusted by ${change}. Reason: ${entry.reason}`);
  writeData(data);
  res.json(item);
});

// ── POST /api/items/:id/condition ─────────────────────────────────────────────
router.post('/:id/condition', requirePermission('inventory.edit', 'moves.request'), (req, res) => {
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
  writeData(data);
  res.json(item);
});

// ── POST /api/items/:id/move-request ──────────────────────────────────────────
router.post('/:id/move-request', requirePermission('moves.request'), (req, res) => {
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
  writeData(data);
  res.status(201).json(mr);
});

// ── POST /api/items/:id/move (admin direct move) ──────────────────────────────
router.post('/:id/move', requirePermission('inventory.edit', 'moves.approve'), (req, res) => {
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

  auditLog(data, 'MOVE_ITEM', req.user, item.id, item.name, before, { currentLocation: item.currentLocation, currentPerson: item.currentPerson });
  activityLog(data, 'MOVE_ITEM', req.user, item.id, item.name, `Moved to "${item.currentLocation}"`);
  writeData(data);
  res.json(item);
});

// ── Kit helpers ───────────────────────────────────────────────────────────────
function enrichComponents(data, kit) {
  const itemsById = Object.fromEntries((data['rt:items'] || []).map((i) => [i.id, i]));
  return (kit.components || []).map((c) => {
    const cat = itemsById[c.itemId];
    return {
      ...c,
      itemName: cat ? cat.name : '(missing item)',
      itemNumber: cat ? cat.itemNumber || '' : '',
      itemCategory: cat ? cat.category || '' : '',
      displayLocation: c.currentLocation || kit.currentLocation || '',
    };
  });
}

function findKit(data, id) {
  const kit = (data['rt:items'] || []).find((i) => i.id === id);
  if (!kit) return { error: 'Item not found', status: 404 };
  if (!kit.isKit) return { error: 'Item is not a kit', status: 400 };
  if (!Array.isArray(kit.components)) kit.components = [];
  return { kit };
}

// ── GET /api/items/:id/components ─────────────────────────────────────────────
router.get('/:id/components', (req, res) => {
  const data = readData();
  const result = findKit(data, req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json(enrichComponents(data, result.kit));
});

// ── POST /api/items/:id/components ────────────────────────────────────────────
// Body: { itemId, quantity?, condition?, currentLocation?, notes? }
router.post('/:id/components', requirePermission('inventory.edit'), (req, res) => {
  const data = readData();
  const result = findKit(data, req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const kit = result.kit;

  const catalogItem = (data['rt:items'] || []).find((i) => i.id === req.body.itemId);
  if (!catalogItem) return res.status(404).json({ error: 'Catalog item not found' });
  if (catalogItem.id === kit.id) return res.status(400).json({ error: 'Cannot add a kit to itself' });
  if (catalogItem.isKit) return res.status(400).json({ error: 'Cannot add a kit inside another kit' });

  const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const condition = req.body.condition || catalogItem.condition || 'Good';
  const location = req.body.currentLocation !== undefined && req.body.currentLocation !== null
    ? req.body.currentLocation
    : (kit.currentLocation || '');
  const notes = req.body.notes || '';
  const now = new Date().toISOString();

  const created = [];
  for (let i = 0; i < quantity; i++) {
    const piece = {
      id: uuidv4(),
      itemId: catalogItem.id,
      condition,
      currentLocation: location,
      notes,
      addedAt: now,
    };
    kit.components.push(piece);
    created.push(piece);
  }

  auditLog(data, 'KIT_ADD_COMPONENTS', req.user, kit.id, kit.name, null, { count: quantity, itemId: catalogItem.id });
  activityLog(
    data, 'KIT_ADD_COMPONENTS', req.user, kit.id, kit.name,
    `Added ${quantity}× "${catalogItem.name}" to kit`
  );
  writeData(data);
  res.status(201).json(enrichComponents(data, { ...kit, components: created }));
});

// ── PUT /api/items/:kitId/components/:componentId ─────────────────────────────
router.put('/:kitId/components/:componentId', requirePermission('inventory.edit'), (req, res) => {
  const data = readData();
  const result = findKit(data, req.params.kitId);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const kit = result.kit;

  const idx = kit.components.findIndex((c) => c.id === req.params.componentId);
  if (idx === -1) return res.status(404).json({ error: 'Kit component not found' });

  const before = { ...kit.components[idx] };
  if (req.body.condition !== undefined) kit.components[idx].condition = req.body.condition;
  if (req.body.currentLocation !== undefined) kit.components[idx].currentLocation = req.body.currentLocation;
  if (req.body.notes !== undefined) kit.components[idx].notes = req.body.notes;

  auditLog(data, 'KIT_UPDATE_COMPONENT', req.user, kit.id, kit.name, before, kit.components[idx]);
  activityLog(
    data, 'KIT_UPDATE_COMPONENT', req.user, kit.id, kit.name,
    `Updated piece in kit (${kit.components[idx].condition})`
  );
  writeData(data);
  res.json(enrichComponents(data, { ...kit, components: [kit.components[idx]] })[0]);
});

// ── DELETE /api/items/:kitId/components/:componentId ──────────────────────────
router.delete('/:kitId/components/:componentId', requirePermission('inventory.edit'), (req, res) => {
  const data = readData();
  const result = findKit(data, req.params.kitId);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const kit = result.kit;

  const idx = kit.components.findIndex((c) => c.id === req.params.componentId);
  if (idx === -1) return res.status(404).json({ error: 'Kit component not found' });

  const [removed] = kit.components.splice(idx, 1);
  auditLog(data, 'KIT_REMOVE_COMPONENT', req.user, kit.id, kit.name, removed, null);
  activityLog(data, 'KIT_REMOVE_COMPONENT', req.user, kit.id, kit.name, 'Removed piece from kit');
  writeData(data);
  res.json({ success: true });
});

// ── POST /api/items/:id/components/bulk-remove ────────────────────────────────
router.post('/:id/components/bulk-remove', requirePermission('inventory.edit'), (req, res) => {
  const data = readData();
  const result = findKit(data, req.params.id);
  if (result.error) return res.status(result.status).json({ error: result.error });
  const kit = result.kit;

  const itemId = req.body.itemId;
  if (!itemId) return res.status(400).json({ error: 'itemId required' });
  const count = req.body.count != null ? Math.max(0, parseInt(req.body.count, 10) || 0) : null;

  let removed = 0;
  const next = [];
  for (const c of kit.components) {
    if (c.itemId === itemId && (count === null || removed < count)) {
      removed++;
      continue;
    }
    next.push(c);
  }
  kit.components = next;

  activityLog(data, 'KIT_REMOVE_COMPONENT', req.user, kit.id, kit.name, `Removed ${removed} piece(s) of type ${itemId}`);
  writeData(data);
  res.json({ success: true, removed });
});

// ── GET /api/items/:id/units ──────────────────────────────────────────────────
router.get('/:id/units', (req, res) => {
  const data = readData();
  const units = (data['rt:units'] || []).filter((u) => u.parentId === req.params.id);
  res.json(units);
});

// ── PUT /api/units/:unitId ────────────────────────────────────────────────────
router.put('/units/:unitId', requirePermission('inventory.edit'), (req, res) => {
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

  writeData(data);
  res.json(unit);
});

// ── POST /api/items/:id/image ─────────────────────────────────────────────────
router.post('/:id/image', requirePermission('inventory.edit'), (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { base64, mimeType } = req.body;
  if (!base64) return res.status(400).json({ error: 'base64 required' });

  const UPLOADS_DIR = require('path').join(DATA_DIR, 'uploads');
  if (!require('fs').existsSync(UPLOADS_DIR)) require('fs').mkdirSync(UPLOADS_DIR, { recursive: true });

  const ext = (mimeType || 'image/jpeg').split('/')[1] || 'jpg';
  const filename = `${item.id}-image.${ext}`;
  const filepath = require('path').join(UPLOADS_DIR, filename);
  require('fs').writeFileSync(filepath, Buffer.from(base64, 'base64'));

  item.imageUrl = `/uploads/${filename}`;
  writeData(data);
  res.json({ imageUrl: item.imageUrl });
});

// ── GET /api/items/:id/image ──────────────────────────────────────────────────
router.get('/:id/image', (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.id);
  if (!item || !item.imageUrl) return res.status(404).json({ error: 'No image' });

  const filepath = require('path').join(DATA_DIR, item.imageUrl.replace('/uploads/', 'uploads/'));
  if (!require('fs').existsSync(filepath)) return res.status(404).json({ error: 'Image file not found' });
  res.sendFile(filepath);
});

// ── POST /api/invoices/:itemId ────────────────────────────────────────────────
router.post('/invoices/:itemId', requirePermission('inventory.edit'), (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { base64, name, mimeType } = req.body;
  if (!base64) return res.status(400).json({ error: 'base64 required' });

  const sizeBytes = Buffer.byteLength(base64, 'base64');
  if (sizeBytes > 4 * 1024 * 1024) return res.status(400).json({ error: 'File exceeds 4MB limit' });

  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'];
  if (mimeType && !allowed.includes(mimeType)) return res.status(400).json({ error: 'File type not allowed' });

  const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const invId = uuidv4();
  const ext = name ? name.split('.').pop() : 'bin';
  const filename = `${item.id}-invoice-${invId}.${ext}`;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(base64, 'base64'));

  const invoice = {
    id: invId,
    name: name || filename,
    type: mimeType || 'application/octet-stream',
    size: sizeBytes,
    uploadedBy: req.user ? req.user.name : 'system',
    date: new Date().toISOString(),
    url: `/uploads/${filename}`,
  };
  item.invoices.push(invoice);
  writeData(data);
  res.status(201).json(invoice);
});

// ── DELETE /api/invoices/:itemId/:invoiceId ───────────────────────────────────
router.delete('/invoices/:itemId/:invoiceId', requirePermission('inventory.edit'), (req, res) => {
  const data = readData();
  const item = (data['rt:items'] || []).find((i) => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const invIdx = item.invoices.findIndex((inv) => inv.id === req.params.invoiceId);
  if (invIdx === -1) return res.status(404).json({ error: 'Invoice not found' });

  const [inv] = item.invoices.splice(invIdx, 1);
  // Delete file
  if (inv.url) {
    const filepath = path.join(DATA_DIR, inv.url.replace('/uploads/', 'uploads/'));
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
  writeData(data);
  res.json({ success: true });
});

// ── POST /api/items/:id/comments ──────────────────────────────────────────────
router.post('/:id/comments', requirePermission('inventory.view'), (req, res) => {
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
  writeData(data);
  res.status(201).json(comment);
});

module.exports = router;
