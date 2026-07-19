'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/storage');
const { requirePermission, requireRole } = require('../utils/auth');

// ══════════════════════════════════════════════════════════════════════════════
// RECEIPT FILE UPLOAD
// POST /api/receipts/upload  — base64 body → saved to uploads/, returns {url}
// ══════════════════════════════════════════════════════════════════════════════
router.post('/receipts/upload', requirePermission('finance.edit', 'finance.reimburse'), (req, res) => {
  const { base64, name, mimeType } = req.body;
  if (!base64) return res.status(400).json({ error: 'base64 required' });

  const sizeBytes = Buffer.byteLength(base64, 'base64');
  if (sizeBytes > 10 * 1024 * 1024) return res.status(400).json({ error: 'File exceeds 10 MB' });

  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (mimeType && !allowed.includes(mimeType)) {
    return res.status(400).json({ error: 'Only images and PDFs are allowed' });
  }

  const path = require('path');
  const fs   = require('fs');
  const { DATA_DIR } = require('../utils/storage');
  const UPLOADS_DIR  = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const ext      = (name || '').split('.').pop() || (mimeType === 'application/pdf' ? 'pdf' : 'jpg');
  const filename = 'receipt-' + uuidv4() + '.' + ext;
  const filepath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(base64, 'base64'));
  res.json({ url: '/uploads/' + filename, name: name || filename });
});

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/transactions', (req, res) => {
  const data = readData();
  let txns = data['rt:accountingTransactions'] || [];
  if (req.query.type)     txns = txns.filter((t) => t.type     === req.query.type);
  if (req.query.category) txns = txns.filter((t) => t.category === req.query.category);
  res.json(txns);
});

router.get('/transactions/balance', (req, res) => {
  const data = readData();
  const txns = data['rt:accountingTransactions'] || [];
  const INCOME = new Set(['Donation', 'FundraiserIncome']);
  const income   = txns.filter((t) => INCOME.has(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const expenses = txns.filter((t) => !INCOME.has(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  res.json({ income, expenses, balance: income - expenses });
});

router.post('/transactions', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const txn = {
    id: uuidv4(),
    type: req.body.type || 'Purchase',
    date: req.body.date || new Date().toISOString(),
    description: req.body.description || '',
    amount: parseFloat(req.body.amount) || 0,
    category: req.body.category || '',
    receiptUrl: req.body.receiptUrl || '',
    receiptName: req.body.receiptName || '',
    linkedPurchaseId: req.body.linkedPurchaseId || null,
  };
  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  data['rt:accountingTransactions'].push(txn);
  writeData(data);
  res.status(201).json(txn);
});

router.put('/transactions/:id', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const idx = (data['rt:accountingTransactions'] || []).findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });
  const allowed = ['type','date','description','amount','category','receiptUrl','receiptName','linkedPurchaseId'];
  for (const k of allowed) { if (req.body[k] !== undefined) data['rt:accountingTransactions'][idx][k] = req.body[k]; }
  writeData(data);
  res.json(data['rt:accountingTransactions'][idx]);
});

router.delete('/transactions/:id', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const idx = (data['rt:accountingTransactions'] || []).findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });
  data['rt:accountingTransactions'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// BUDGETS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/budgets', (req, res) => {
  const data    = readData();
  const budgets = data['rt:budgets'] || [];
  const txns    = data['rt:accountingTransactions'] || [];
  const EXPENSE = new Set(['Purchase', 'Reimbursement']);
  const result  = budgets.map((b) => {
    const actual = txns
      .filter((t) => {
        const d = new Date(t.date);
        return EXPENSE.has(t.type) && t.category === b.category &&
          d.getFullYear() === b.year &&
          (b.month == null || d.getMonth() + 1 === b.month);
      })
      .reduce((s, t) => s + (t.amount || 0), 0);
    return { ...b, actual };
  });
  res.json(result);
});

router.post('/budgets', requirePermission('finance.edit'), (req, res) => {
  const data   = readData();
  const budget = {
    id: uuidv4(),
    category: req.body.category || '',
    year: parseInt(req.body.year, 10) || new Date().getFullYear(),
    month: req.body.month != null ? parseInt(req.body.month, 10) : null,
    allocated: parseFloat(req.body.allocated) || 0,
  };
  if (!data['rt:budgets']) data['rt:budgets'] = [];
  data['rt:budgets'].push(budget);
  writeData(data);
  res.status(201).json(budget);
});

router.put('/budgets/:id', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const idx  = (data['rt:budgets'] || []).findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Budget not found' });
  for (const k of ['category','year','month','allocated']) {
    if (req.body[k] !== undefined) data['rt:budgets'][idx][k] = req.body[k];
  }
  writeData(data);
  res.json(data['rt:budgets'][idx]);
});

router.delete('/budgets/:id', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const idx  = (data['rt:budgets'] || []).findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Budget not found' });
  data['rt:budgets'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// SAVINGS GOALS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/goals', (req, res) => {
  const data = readData();
  res.json(data['rt:savingsGoals'] || []);
});

router.post('/goals', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const goal = {
    id: uuidv4(),
    name: req.body.name || '',
    targetAmount: parseFloat(req.body.targetAmount) || 0,
    currentAmount: parseFloat(req.body.currentAmount) || 0,
    deadline: req.body.deadline || null,
    createdAt: new Date().toISOString(),
  };
  if (!data['rt:savingsGoals']) data['rt:savingsGoals'] = [];
  data['rt:savingsGoals'].push(goal);
  writeData(data);
  res.status(201).json(goal);
});

router.put('/goals/:id', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const idx  = (data['rt:savingsGoals'] || []).findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Goal not found' });
  for (const k of ['name','targetAmount','currentAmount','deadline']) {
    if (req.body[k] !== undefined) data['rt:savingsGoals'][idx][k] = req.body[k];
  }
  writeData(data);
  res.json(data['rt:savingsGoals'][idx]);
});

router.delete('/goals/:id', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const idx  = (data['rt:savingsGoals'] || []).findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Goal not found' });
  data['rt:savingsGoals'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

router.post('/goals/:id/add-funds', requirePermission('finance.edit'), (req, res) => {
  const data   = readData();
  const goal   = (data['rt:savingsGoals'] || []).find((g) => g.id === req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const amount = parseFloat(req.body.amount) || 0;
  goal.currentAmount = (goal.currentAmount || 0) + amount;
  if (amount !== 0) {
    if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
    data['rt:accountingTransactions'].push({
      id: uuidv4(), type: 'Donation',
      date: new Date().toISOString(),
      description: 'Funds added to savings goal: ' + goal.name,
      amount, category: 'Savings', receiptUrl: '', linkedGoalId: goal.id,
    });
  }
  writeData(data);
  res.json(goal);
});

// ══════════════════════════════════════════════════════════════════════════════
// REIMBURSEMENTS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/reimbursements', (req, res) => {
  const data  = readData();
  let reimbs  = data['rt:reimbursements'] || [];
  if (req.query.status) reimbs = reimbs.filter((r) => r.status === req.query.status);
  // Users without finance.view / approvals only see their own reimbursements
  const { hasPermission } = require('../utils/auth');
  if (req.user && !hasPermission(req.user, 'finance.view') && !hasPermission(req.user, 'approvals.manage')) {
    reimbs = reimbs.filter((r) => r.userId === req.user.id);
  }
  res.json(reimbs);
});

router.post('/reimbursements', requirePermission('finance.reimburse', 'finance.edit'), (req, res) => {
  const data  = readData();
  const reimb = {
    id: uuidv4(),
    userId: req.user ? req.user.id : null,
    userName: req.user ? req.user.name : '',
    amount: parseFloat(req.body.amount) || 0,
    reason: req.body.reason || '',
    receiptUrl: req.body.receiptUrl || '',
    receiptName: req.body.receiptName || '',
    status: 'pending',
    approvedBy: null, approvedAt: null, denialReason: null,
    createdAt: new Date().toISOString(),
  };
  if (!data['rt:reimbursements']) data['rt:reimbursements'] = [];
  data['rt:reimbursements'].push(reimb);
  writeData(data);
  res.status(201).json(reimb);
});

router.post('/reimbursements/:id/approve', requirePermission('approvals.manage', 'finance.edit'), (req, res) => {
  const data  = readData();
  const reimb = (data['rt:reimbursements'] || []).find((r) => r.id === req.params.id);
  if (!reimb) return res.status(404).json({ error: 'Reimbursement not found' });
  reimb.status     = 'approved';
  reimb.approvedBy = req.user ? req.user.name : 'system';
  reimb.approvedAt = new Date().toISOString();
  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  data['rt:accountingTransactions'].push({
    id: uuidv4(), type: 'Reimbursement',
    date: new Date().toISOString(),
    description: 'Reimbursement for ' + reimb.userName + ': ' + reimb.reason,
    amount: reimb.amount, category: 'Reimbursement',
    receiptUrl: reimb.receiptUrl, linkedReimbursementId: reimb.id,
  });
  writeData(data);
  res.json(reimb);
});

router.post('/reimbursements/:id/deny', requirePermission('approvals.manage', 'finance.edit'), (req, res) => {
  const data  = readData();
  const reimb = (data['rt:reimbursements'] || []).find((r) => r.id === req.params.id);
  if (!reimb) return res.status(404).json({ error: 'Reimbursement not found' });
  reimb.status       = 'denied';
  reimb.approvedBy   = req.user ? req.user.name : 'system';
  reimb.approvedAt   = new Date().toISOString();
  reimb.denialReason = req.body.reason || '';
  writeData(data);
  res.json(reimb);
});

router.delete('/reimbursements/:id', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const idx  = (data['rt:reimbursements'] || []).findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Reimbursement not found' });
  data['rt:reimbursements'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// FUNDRAISERS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/fundraisers', (req, res) => {
  const data = readData();
  res.json(data['rt:fundraisers'] || []);
});

router.post('/fundraisers', requirePermission('finance.edit'), (req, res) => {
  const data       = readData();
  const fundraiser = {
    id: uuidv4(),
    name: req.body.name || '',
    date: req.body.date || new Date().toISOString(),
    targetAmount: parseFloat(req.body.targetAmount) || 0,
    actualAmount: parseFloat(req.body.actualAmount) || 0,
    donations: [],
  };
  if (!data['rt:fundraisers']) data['rt:fundraisers'] = [];
  data['rt:fundraisers'].push(fundraiser);
  writeData(data);
  res.status(201).json(fundraiser);
});

router.put('/fundraisers/:id', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const idx  = (data['rt:fundraisers'] || []).findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Fundraiser not found' });
  for (const k of ['name','date','targetAmount','actualAmount']) {
    if (req.body[k] !== undefined) data['rt:fundraisers'][idx][k] = req.body[k];
  }
  writeData(data);
  res.json(data['rt:fundraisers'][idx]);
});

router.delete('/fundraisers/:id', requirePermission('finance.edit'), (req, res) => {
  const data = readData();
  const idx  = (data['rt:fundraisers'] || []).findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Fundraiser not found' });
  data['rt:fundraisers'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// POST /api/fundraisers/:id/donations  — add a single donor entry
router.post('/fundraisers/:id/donations', requirePermission('finance.edit'), (req, res) => {
  const data       = readData();
  const fundraiser = (data['rt:fundraisers'] || []).find((f) => f.id === req.params.id);
  if (!fundraiser) return res.status(404).json({ error: 'Fundraiser not found' });

  const donation = {
    id: uuidv4(),
    donor: req.body.donor || 'Anonymous',
    amount: parseFloat(req.body.amount) || 0,
    date: req.body.date || new Date().toISOString(),
    notes: req.body.notes || '',
  };
  fundraiser.donations.push(donation);
  fundraiser.actualAmount = (fundraiser.actualAmount || 0) + donation.amount;

  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  data['rt:accountingTransactions'].push({
    id: uuidv4(), type: 'FundraiserIncome',
    date: donation.date,
    description: 'Donation from ' + donation.donor + ' – ' + fundraiser.name,
    amount: donation.amount, category: 'Fundraiser',
    receiptUrl: '', linkedFundraiserId: fundraiser.id,
  });

  writeData(data);
  res.status(201).json(donation);
});

// POST /api/fundraisers/:id/quick-total
// Records a single lump-sum entry (e.g. end-of-day cash from a stand/booth).
router.post('/fundraisers/:id/quick-total', requirePermission('finance.edit'), (req, res) => {
  const data       = readData();
  const fundraiser = (data['rt:fundraisers'] || []).find((f) => f.id === req.params.id);
  if (!fundraiser) return res.status(404).json({ error: 'Fundraiser not found' });

  const amount  = parseFloat(req.body.amount) || 0;
  const label   = req.body.label || 'Daily total';
  const date    = req.body.date  || new Date().toISOString();
  const notes   = req.body.notes || '';

  const entry = {
    id: uuidv4(), donor: label, amount, date, notes,
    isQuickTotal: true,
  };
  fundraiser.donations.push(entry);
  fundraiser.actualAmount = (fundraiser.actualAmount || 0) + amount;

  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  data['rt:accountingTransactions'].push({
    id: uuidv4(), type: 'FundraiserIncome',
    date,
    description: label + ' – ' + fundraiser.name,
    amount, category: 'Fundraiser',
    receiptUrl: '', linkedFundraiserId: fundraiser.id,
  });

  writeData(data);
  res.status(201).json(entry);
});

// ══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/reports/balance-sheet', requirePermission('finance.view'), (req, res) => {
  const data  = readData();
  const txns  = data['rt:accountingTransactions'] || [];
  const INCOME = new Set(['Donation', 'FundraiserIncome']);
  const byType = {};
  for (const t of txns) { byType[t.type] = (byType[t.type] || 0) + (t.amount || 0); }
  const income   = (byType['Donation'] || 0) + (byType['FundraiserIncome'] || 0);
  const expenses = (byType['Purchase'] || 0) + (byType['Reimbursement']   || 0);
  res.json({ totalIncome: income, totalExpenses: expenses, netBalance: income - expenses, breakdown: byType, transactions: txns });
});

router.get('/reports/budget-vs-actual', requirePermission('finance.view'), (req, res) => {
  const data    = readData();
  const budgets = data['rt:budgets'] || [];
  const txns    = data['rt:accountingTransactions'] || [];
  const EXPENSE = new Set(['Purchase', 'Reimbursement']);
  const report  = budgets.map((b) => {
    const actual = txns
      .filter((t) => {
        const d = new Date(t.date);
        return EXPENSE.has(t.type) && t.category === b.category &&
          d.getFullYear() === b.year && (b.month == null || d.getMonth() + 1 === b.month);
      })
      .reduce((s, t) => s + (t.amount || 0), 0);
    return { ...b, actual, variance: b.allocated - actual };
  });
  res.json(report);
});

router.get('/reports/donations', requirePermission('finance.view'), (req, res) => {
  const data        = readData();
  const fundraisers = data['rt:fundraisers'] || [];
  const txns        = (data['rt:accountingTransactions'] || [])
    .filter((t) => t.type === 'Donation' || t.type === 'FundraiserIncome');
  const totalDonations = txns.reduce((s, t) => s + (t.amount || 0), 0);
  res.json({
    totalDonations,
    fundraisers: fundraisers.map((f) => ({
      id: f.id, name: f.name, date: f.date,
      targetAmount: f.targetAmount, actualAmount: f.actualAmount,
      donationCount: (f.donations || []).length,
    })),
    transactions: txns,
  });
});

module.exports = router;
