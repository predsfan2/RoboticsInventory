'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/storage');
const { requirePermission } = require('../utils/auth');
const { activityLog } = require('../utils/logging');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get('/', requirePermission('moves.approve', 'approvals.manage'), (req, res) => {
  const data = readData();
  let mrs = data['rt:moveRequests'] || [];
  if (req.query.status) mrs = mrs.filter((m) => m.status === req.query.status);
  res.json(mrs);
});

router.post('/:id/approve', requirePermission('moves.approve', 'approvals.manage'), asyncHandler(async (req, res) => {
  const data = readData();
  const mr = (data['rt:moveRequests'] || []).find((m) => m.id === req.params.id);
  if (!mr) return res.status(404).json({ error: 'Move request not found' });
  if (mr.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

  mr.status = 'approved';
  mr.approvedBy = req.user ? req.user.name : 'system';
  mr.approvedAt = new Date().toISOString();

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
    activityLog(data, 'MOVE_APPROVED', req.user, item.id, item.name,
      `Move request approved. Moved to "${item.currentLocation}"`);
  }

  await writeData(data);
  res.json(mr);
}));

router.post('/:id/deny', requirePermission('moves.approve', 'approvals.manage'), asyncHandler(async (req, res) => {
  const data = readData();
  const mr = (data['rt:moveRequests'] || []).find((m) => m.id === req.params.id);
  if (!mr) return res.status(404).json({ error: 'Move request not found' });
  if (mr.status !== 'pending') return res.status(400).json({ error: 'Request is not pending' });

  mr.status = 'denied';
  mr.approvedBy = req.user ? req.user.name : 'system';
  mr.approvedAt = new Date().toISOString();
  mr.denialReason = req.body.reason || '';

  activityLog(data, 'MOVE_DENIED', req.user, mr.itemId, '',
    `Move request denied. Reason: ${mr.denialReason}`);
  await writeData(data);
  res.json(mr);
}));

module.exports = router;
