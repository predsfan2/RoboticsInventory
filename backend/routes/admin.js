'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/storage');
const { requirePermission, hashPassword, stripPassword } = require('../utils/auth');
const { ROLE_DEFAULT_PERMISSIONS } = require('../utils/permissions');
const locations = require('../services/locations');
const { sendDomainError } = require('../services/errors');

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
    tokenVersion: 0,
    mustChangePassword: req.body.mustChangePassword !== false,
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
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.mustChangePassword = true;
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
  const loc = {
    id: uuidv4(),
    name: req.body.name || '',
    parentId: req.body.parentId || null,
    startDate: req.body.startDate || null,
    endDate: req.body.endDate || null,
  };
  data['rt:locs'].push(loc);
  await writeData(data);
  res.status(201).json(loc);
}));

router.put('/locations/:id', requirePermission('admin.locations'), asyncHandler(async (req, res) => {
  try {
    const loc = await locations.updateLocation(req.params.id, req.body || {}, req.user);
    res.json(loc);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

router.post('/locations/:id/merge', requirePermission('admin.locations'), asyncHandler(async (req, res) => {
  try {
    const loc = await locations.mergeLocations(req.params.id, req.body && req.body.targetId, req.user);
    res.json(loc);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

router.post('/locations/:id/move-all', requirePermission('moves.request', 'moves.approve'), asyncHandler(async (req, res) => {
  try {
    const data = readData();
    const loc = (data['rt:locs'] || []).find((l) => l.id === req.params.id);
    if (!loc) return res.status(404).json({ error: 'Location not found' });
    const result = await locations.bulkMove({
      fromLocation: loc.name,
      toLocation: req.body && req.body.toLocation,
      person: req.body && req.body.person,
      notes: req.body && req.body.notes,
    }, req.user);
    res.json(result);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

router.delete('/locations/:id', requirePermission('admin.locations'), asyncHandler(async (req, res) => {
  try {
    const body = req.body || {};
    await locations.deleteLocation(req.params.id, {
      replacementId: body.replacementId || req.query.replacementId,
      leaveAsText: body.leaveAsText === true || req.query.leaveAsText === 'true',
    }, req.user);
    res.json({ success: true });
  } catch (err) {
    return sendDomainError(res, err);
  }
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
