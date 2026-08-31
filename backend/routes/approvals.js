'use strict';

const express = require('express');
const router = express.Router();
const { listPending } = require('../services/approvals');
const { requirePermission } = require('../utils/auth');

router.get('/pending', requirePermission('approvals.manage'), (_req, res) => {
  res.json(listPending());
});

module.exports = router;
