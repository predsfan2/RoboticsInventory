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

// ── GET /api/move-requests ────────────────────────────────────────────────────
router.get('/', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  let mrs = data['rt:moveRequests'] || [];
  if (req.query.status) mrs = mrs.filter((m) => m.status === req.query.status);
  res.json(mrs);
});

// ── POST /api/move-requests/:id/approve ──────────────────────────────────────
router.post('/:id/approve', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const mr = (data['rt:moveRequests'] || []).find((m) => m.id === req.params.id);
  if (!mr) return res.status(404).json({ error: 'Move request not found' });
  if (mr.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

  mr.status = 'approved';
  mr.approvedBy = req.user ? req.user.name : 'system';
  mr.approvedAt = new Date().toISOString();

  // Apply the move to the item
  const item = (data['rt:items'] || []).find((i) => i.id === mr.itemId);
  if (item) {
    item.currentLocation = mr.requestedLocation || item.currentLocation;
    item.currentPerson = mr.requestedPerson !== undefined ? mr.requestedPerson : item.currentPerson;
    item.locationLog.push({
      id: uuidv4(),
      location: item.currentLocation,
      person: item.currentPerson,
      movedBy: req.user ? req.user.name : 'system',
      notes: mr.notes || '',
      date: new Date().toISOString(),
    });
    activityLog(data, 'MOVE_APPROVED', req.user, item.id, item.name, `Move request approved. Moved to "${item.currentLocation}"`);
  }

  writeData(data);
  res.json(mr);
});

// ── POST /api/move-requests/:id/deny ─────────────────────────────────────────
router.post('/:id/deny', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const mr = (data['rt:moveRequests'] || []).find((m) => m.id === req.params.id);
  if (!mr) return res.status(404).json({ error: 'Move request not found' });
  if (mr.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

  mr.status = 'denied';
  mr.approvedBy = req.user ? req.user.name : 'system';
  mr.approvedAt = new Date().toISOString();
  mr.denialReason = req.body.reason || '';

  activityLog(data, 'MOVE_DENIED', req.user, mr.itemId, '', `Move request denied. Reason: ${mr.denialReason}`);
  writeData(data);
  res.json(mr);
});

module.exports = router;
