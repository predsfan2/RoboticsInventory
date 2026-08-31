'use strict';

const express = require('express');
const router = express.Router();
const { readData } = require('../utils/storage');
const { requirePermission } = require('../utils/auth');
const { approveMove, denyMove } = require('../services/approvals');
const { sendDomainError } = require('../services/errors');

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
  try {
    const mr = await approveMove(req.params.id, req.user);
    res.json(mr);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

router.post('/:id/deny', requirePermission('moves.approve', 'approvals.manage'), asyncHandler(async (req, res) => {
  try {
    const mr = await denyMove(req.params.id, req.body && req.body.reason, req.user);
    res.json(mr);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

module.exports = router;
