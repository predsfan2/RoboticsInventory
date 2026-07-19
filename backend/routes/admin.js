const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/storage');
const { requirePermission, requireRole } = require('../utils/auth');


// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/users  (password stripped, permissions included)
router.get('/users', requirePermission('admin.users'), (req, res) => {
  const data = readData();
  const users = (data['rt:users'] || []).map(({ password: _p, ...u }) => u);
  res.json(users);
});

// POST /api/users
router.post('/users', requirePermission('admin.users'), (req, res) => {
  const data = readData();
  if (!data['rt:users']) data['rt:users'] = [];

  const existing = data['rt:users'].find(
    (u) => u.name.toLowerCase() === (req.body.name || '').toLowerCase()
  );
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const user = {
    id: uuidv4(),
    name: req.body.name || '',
    password: req.body.password || 'changeme',
    role: req.body.role || 'Member',
    permissions: Array.isArray(req.body.permissions) ? req.body.permissions : [],
  };
  data['rt:users'].push(user);
  writeData(data);
  const { password: _p, ...safe } = user;
  res.status(201).json(safe);
});

// PUT /api/users/:id
router.put('/users/:id', requirePermission('admin.users'), (req, res) => {
  const data = readData();
  const idx = (data['rt:users'] || []).findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  if (req.body.name        !== undefined) data['rt:users'][idx].name        = req.body.name;
  if (req.body.role        !== undefined) data['rt:users'][idx].role        = req.body.role;
  if (req.body.permissions !== undefined) {
    data['rt:users'][idx].permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions
      : [];
  }
  writeData(data);
  const { password: _p, ...safe } = data['rt:users'][idx];
  res.json(safe);
});

// DELETE /api/users/:id
router.delete('/users/:id', requirePermission('admin.users'), (req, res) => {
  const data = readData();
  const idx = (data['rt:users'] || []).findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  if (req.user && req.user.id === req.params.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  data['rt:users'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// POST /api/users/:id/password
router.post('/users/:id/password', requirePermission('admin.users'), (req, res) => {
  const data = readData();
  const user = (data['rt:users'] || []).find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!req.body.password) return res.status(400).json({ error: 'password required' });
  user.password = req.body.password;
  writeData(data);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOCATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/locations
router.get('/locations', (req, res) => {
  const data = readData();
  res.json(data['rt:locs'] || []);
});

// POST /api/locations
router.post('/locations', requirePermission('admin.locations'), (req, res) => {
  const data = readData();
  if (!data['rt:locs']) data['rt:locs'] = [];
  const loc = { id: uuidv4(), name: req.body.name || '' };
  data['rt:locs'].push(loc);
  writeData(data);
  res.status(201).json(loc);
});

// PUT /api/locations/:id
router.put('/locations/:id', requirePermission('admin.locations'), (req, res) => {
  const data = readData();
  const loc = (data['rt:locs'] || []).find((l) => l.id === req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });
  if (req.body.name !== undefined) loc.name = req.body.name;
  writeData(data);
  res.json(loc);
});

// DELETE /api/locations/:id
router.delete('/locations/:id', requirePermission('admin.locations'), (req, res) => {
  const data = readData();
  const idx = (data['rt:locs'] || []).findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Location not found' });
  data['rt:locs'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM FIELDS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/custom-fields
router.get('/custom-fields', (req, res) => {
  const data = readData();
  res.json(data['rt:customFields'] || []);
});

// POST /api/custom-fields
router.post('/custom-fields', requirePermission('admin.users'), (req, res) => {
  const data = readData();
  if (!data['rt:customFields']) data['rt:customFields'] = [];

  const existing = data['rt:customFields'].find((c) => c.category === req.body.category);
  if (existing) return res.status(409).json({ error: 'Custom fields for this category already exist. Use PUT to update.' });

  const cf = {
    id: uuidv4(),
    category: req.body.category || '',
    fields: req.body.fields || [],
  };
  data['rt:customFields'].push(cf);
  writeData(data);
  res.status(201).json(cf);
});

// PUT /api/custom-fields/:id
router.put('/custom-fields/:id', requirePermission('admin.users'), (req, res) => {
  const data = readData();
  const idx = (data['rt:customFields'] || []).findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Custom field definition not found' });
  if (req.body.category !== undefined) data['rt:customFields'][idx].category = req.body.category;
  if (req.body.fields   !== undefined) data['rt:customFields'][idx].fields   = req.body.fields;
  writeData(data);
  res.json(data['rt:customFields'][idx]);
});

// DELETE /api/custom-fields/:id
router.delete('/custom-fields/:id', requirePermission('admin.users'), (req, res) => {
  const data = readData();
  const idx = (data['rt:customFields'] || []).findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Custom field definition not found' });
  data['rt:customFields'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

module.exports = router;
