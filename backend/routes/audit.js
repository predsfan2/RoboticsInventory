'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/storage');
const { requirePermission, requireRole } = require('../utils/auth');
const { auditLog, activityLog } = require('../utils/logging');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get('/', requirePermission('audit.view'), (req, res) => {
  const data = readData();
  let logs = [...(data['rt:auditLog'] || [])].reverse();

  if (req.query.action) logs = logs.filter((l) => l.action === req.query.action);
  if (req.query.userId) logs = logs.filter((l) => l.userId === req.query.userId);
  if (req.query.itemId) logs = logs.filter((l) => l.itemId === req.query.itemId);
  if (req.query.search) {
    const s = req.query.search.toLowerCase();
    logs = logs.filter(
      (l) =>
        (l.action || '').toLowerCase().includes(s) ||
        (l.userName || '').toLowerCase().includes(s) ||
        (l.itemName || '').toLowerCase().includes(s)
    );
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
  const total = logs.length;
  const offset = (page - 1) * limit;
  const paged = logs.slice(offset, offset + limit);

  res.json({ total, page, limit, logs: paged });
});

router.post('/undo', requireRole('Admin'), asyncHandler(async (req, res) => {
  const data = readData();
  const logs = data['rt:auditLog'] || [];

  const undoableActions = ['UPDATE_ITEM', 'UPDATE_CONDITION', 'MOVE_ITEM', 'ADJUST_STOCK'];
  const targetId = req.body.auditId;

  let entry;
  if (targetId) {
    entry = logs.find((l) => l.id === targetId);
  } else {
    entry = [...logs].reverse().find((l) => undoableActions.includes(l.action) && l.before);
  }

  if (!entry) return res.status(404).json({ error: 'Nothing to undo' });
  if (!entry.before) return res.status(400).json({ error: 'No before snapshot available for this entry' });

  let before;
  try {
    before = typeof entry.before === 'string' ? JSON.parse(entry.before) : entry.before;
  } catch (_) {
    return res.status(400).json({ error: 'Could not parse before snapshot' });
  }

  const itemIdx = (data['rt:items'] || []).findIndex((i) => i.id === entry.itemId);
  if (itemIdx === -1) return res.status(404).json({ error: 'Item not found for undo' });

  const afterState = { ...data['rt:items'][itemIdx] };
  for (const key of Object.keys(before)) {
    data['rt:items'][itemIdx][key] = before[key];
  }

  auditLog(data, 'UNDO', req.user, entry.itemId, entry.itemName, afterState, data['rt:items'][itemIdx]);
  const last = data['rt:auditLog'][data['rt:auditLog'].length - 1];
  last.undoneEntryId = entry.id;
  activityLog(data, 'UNDO', req.user, entry.itemId, entry.itemName,
    `Undid ${entry.action} on "${entry.itemName}"`);

  await writeData(data);
  res.json({ success: true, restoredItem: data['rt:items'][itemIdx] });
}));

module.exports = router;
