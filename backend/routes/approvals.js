const express = require('express');
const router = express.Router();
const { readData } = require('../utils/storage');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// GET /api/approvals/pending – returns pending move requests + pending reimbursements
router.get('/pending', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();

  const moveRequests = (data['rt:moveRequests'] || [])
    .filter((m) => m.status === 'pending')
    .map((m) => ({ ...m, approvalType: 'moveRequest' }));

  const reimbursements = (data['rt:reimbursements'] || [])
    .filter((r) => r.status === 'pending')
    .map((r) => ({ ...r, approvalType: 'reimbursement' }));

  res.json({
    moveRequests,
    reimbursements,
    total: moveRequests.length + reimbursements.length,
  });
});

module.exports = router;
