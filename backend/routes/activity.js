'use strict';

const express = require('express');
const router = express.Router();
const { readData } = require('../utils/storage');
const { requirePermission } = require('../utils/auth');
const { hasPermission } = require('../utils/permissions');

router.get('/', requirePermission('audit.view', 'inventory.view'), (req, res) => {
  const data = readData();
  let logs = [...(data['rt:activityLog'] || [])].reverse();

  if (req.query.action) logs = logs.filter((l) => l.action === req.query.action);
  if (req.query.userId) logs = logs.filter((l) => l.userId === req.query.userId);
  if (req.query.itemId) logs = logs.filter((l) => l.itemId === req.query.itemId);
  if (req.query.search) {
    const s = req.query.search.toLowerCase();
    logs = logs.filter(
      (l) =>
        (l.action || '').toLowerCase().includes(s) ||
        (l.userName || '').toLowerCase().includes(s) ||
        (l.itemName || '').toLowerCase().includes(s) ||
        (l.details || '').toLowerCase().includes(s)
    );
  }

  // Without full audit.view, only show own activity
  if (req.user && !hasPermission(req.user, 'audit.view')) {
    logs = logs.filter((l) => l.userId === req.user.id);
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
  const total = logs.length;
  const paged = logs.slice((page - 1) * limit, page * limit);

  res.json({ total, page, limit, logs: paged });
});

module.exports = router;
