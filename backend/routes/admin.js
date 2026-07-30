'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/storage');
const { requirePermission, hashPassword, stripPassword } = require('../utils/auth');
const { ROLE_DEFAULT_PERMISSIONS } = require('../utils/permissions');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get('/users', requirePermission('admin.users'), (req, res) => {
  const data = readData();
  const users = (data['rt:users'] || []).map((u) => stripPassword(u));
  res.json(users);
});

router.post('/users', requirePermission('admin.users'), asyncHandler(async (req, res) => {
  const data = readData();
  if (!data['rt:users']) data['rt:users'] = [];

  const existing = data['rt:users'].find(
    (u) => u.name.toLowerCase() === (req.body.name || '').toLowerCase()
  );
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const password = req.body.password;
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const role = req.body.role || 'Member';
  const user = {
    id: uuidv4(),
    name: req.body.name || '',
    password: hashPassword(password),
    role,
    permissions: Array.isArray(req.body.permissions) && req.body.permissions.length
      ? req.body.permissions
      : (ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.Member).slice(),
  };
  data['rt:users'].push(user);
  await writeData(data);
  res.status(201).json(stripPassword(user));
}));

router.put('/users/:id', requirePermission('admin.users'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:users'] || []).findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  if (req.body.name !== undefined) data['rt:users'][idx].name = req.body.name;
  if (req.body.role !== undefined) data['rt:users'][idx].role = req.body.role;
  if (req.body.permissions !== undefined) {
    data['rt:users'][idx].permissions = Array.isArray(req.body.permissions)
      ? req.body.permissions
      : [];
  }
  await writeData(data);
  res.json(stripPassword(data['rt:users'][idx]));
}));

router.delete('/users/:id', requirePermission('admin.users'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:users'] || []).findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  if (req.user && req.user.id === req.params.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  data['rt:users'].splice(idx, 1);
  await writeData(data);
  res.json({ success: true });
}));

router.post('/users/:id/password', requirePermission('admin.users'), asyncHandler(async (req, res) => {
  const data = readData();
  const user = (data['rt:users'] || []).find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!req.body.password || String(req.body.password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  user.password = hashPassword(req.body.password);
  await writeData(data);
  res.json({ success: true });
}));

router.get('/locations', requirePermission('inventory.view', 'admin.locations'), (req, res) => {
  const data = readData();
  res.json(data['rt:locs'] || []);
});

router.post('/locations', requirePermission('admin.locations'), asyncHandler(async (req, res) => {
  const data = readData();
  if (!data['rt:locs']) data['rt:locs'] = [];
  const loc = { id: uuidv4(), name: req.body.name || '' };
  data['rt:locs'].push(loc);
  await writeData(data);
  res.status(201).json(loc);
}));

router.put('/locations/:id', requirePermission('admin.locations'), asyncHandler(async (req, res) => {
  const data = readData();
  const loc = (data['rt:locs'] || []).find((l) => l.id === req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });
  if (req.body.name !== undefined) loc.name = req.body.name;
  await writeData(data);
  res.json(loc);
}));

router.delete('/locations/:id', requirePermission('admin.locations'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:locs'] || []).findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Location not found' });
  data['rt:locs'].splice(idx, 1);
  await writeData(data);
  res.json({ success: true });
}));

router.get('/custom-fields', requirePermission('inventory.view', 'admin.users'), (req, res) => {
  const data = readData();
  res.json(data['rt:customFields'] || []);
});

router.post('/custom-fields', requirePermission('admin.users'), asyncHandler(async (req, res) => {
  const data = readData();
  if (!data['rt:customFields']) data['rt:customFields'] = [];

  const existing = data['rt:customFields'].find((c) => c.category === req.body.category);
  if (existing) {
    return res.status(409).json({ error: 'Custom fields for this category already exist. Use PUT to update.' });
  }

  const cf = {
    id: uuidv4(),
    category: req.body.category || '',
    fields: req.body.fields || [],
  };
  data['rt:customFields'].push(cf);
  await writeData(data);
  res.status(201).json(cf);
}));

router.put('/custom-fields/:id', requirePermission('admin.users'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:customFields'] || []).findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Custom field definition not found' });
  if (req.body.category !== undefined) data['rt:customFields'][idx].category = req.body.category;
  if (req.body.fields !== undefined) data['rt:customFields'][idx].fields = req.body.fields;
  await writeData(data);
  res.json(data['rt:customFields'][idx]);
}));

router.delete('/custom-fields/:id', requirePermission('admin.users'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:customFields'] || []).findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Custom field definition not found' });
  data['rt:customFields'].splice(idx, 1);
  await writeData(data);
  res.json({ success: true });
}));

module.exports = router;
