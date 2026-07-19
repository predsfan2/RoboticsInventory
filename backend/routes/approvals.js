const express = require('express');
const router = express.Router();
const { readData } = require('../utils/storage');
const { requirePermission, requireRole } = require('../utils/auth');


// GET /api/approvals/pending – returns pending move requests + pending reimbursements
router.get('/pending', requirePermission('approvals.manage'), (req, res) => {
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
