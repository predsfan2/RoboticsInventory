'use strict';

const express = require('express');
const router = express.Router();
const { listPending, listHistory } = require('../services/approvals');
const { requirePermission } = require('../utils/auth');

router.get('/pending', requirePermission('approvals.manage'), (_req, res) => {
  res.json(listPending());
});

router.get('/history', requirePermission('approvals.manage'), (_req, res) => {
  res.json(listHistory());
});

module.exports = router;
