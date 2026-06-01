const express = require('express');
const router = express.Router();
const { readData, writeData } = require('../utils/storage');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// ── GET /api/audit ────────────────────────────────────────────────────────────
// Query params: page, limit, action, userId, itemId, search
router.get('/', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  let logs = [...(data['rt:auditLog'] || [])].reverse(); // newest first

  // Filters
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

  // Pagination
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
  const total = logs.length;
  const offset = (page - 1) * limit;
  const paged = logs.slice(offset, offset + limit);

  res.json({ total, page, limit, logs: paged });
});

// ── POST /api/audit/undo ──────────────────────────────────────────────────────
// Reverts the most recent auditable action (requires Admin).
// Stores before/after snapshots; only supports item-level undo.
router.post('/undo', requireRole('Admin'), (req, res) => {
  const data = readData();
  const logs = data['rt:auditLog'] || [];

  // Find the most recent log entry that has a before snapshot and targets an item
  const undoableActions = ['UPDATE_ITEM', 'UPDATE_CONDITION', 'MOVE_ITEM', 'ADJUST_STOCK'];
  const targetId = req.body.auditId; // optional – undo a specific entry

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

  // Re-apply before state to the item
  const itemIdx = (data['rt:items'] || []).findIndex((i) => i.id === entry.itemId);
  if (itemIdx === -1) return res.status(404).json({ error: 'Item not found for undo' });

  const afterState = { ...data['rt:items'][itemIdx] };
  // Merge only the keys present in the before snapshot
  for (const key of Object.keys(before)) {
    data['rt:items'][itemIdx][key] = before[key];
  }

  // Log the undo action
  data['rt:auditLog'].push({
    id: require('uuid').v4(),
    action: 'UNDO',
    userId: req.user ? req.user.id : null,
    userName: req.user ? req.user.name : 'system',
    itemId: entry.itemId,
    itemName: entry.itemName,
    before: JSON.stringify(afterState),
    after: JSON.stringify(data['rt:items'][itemIdx]),
    undoneEntryId: entry.id,
    timestamp: new Date().toISOString(),
  });

  writeData(data);
  res.json({ success: true, restoredItem: data['rt:items'][itemIdx] });
});

module.exports = router;
