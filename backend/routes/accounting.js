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

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/transactions
router.get('/transactions', (req, res) => {
  const data = readData();
  let txns = data['rt:accountingTransactions'] || [];
  if (req.query.type) txns = txns.filter((t) => t.type === req.query.type);
  if (req.query.category) txns = txns.filter((t) => t.category === req.query.category);
  res.json(txns);
});

// GET /api/transactions/balance
router.get('/transactions/balance', (req, res) => {
  const data = readData();
  const txns = data['rt:accountingTransactions'] || [];
  const income = txns
    .filter((t) => ['Donation', 'FundraiserIncome'].includes(t.type))
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const expenses = txns
    .filter((t) => ['Purchase', 'Reimbursement'].includes(t.type))
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  res.json({ income, expenses, balance: income - expenses });
});

// POST /api/transactions
router.post('/transactions', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const txn = {
    id: uuidv4(),
    type: req.body.type || 'Purchase',
    date: req.body.date || new Date().toISOString(),
    description: req.body.description || '',
    amount: parseFloat(req.body.amount) || 0,
    category: req.body.category || '',
    receiptUrl: req.body.receiptUrl || '',
    linkedPurchaseId: req.body.linkedPurchaseId || null,
  };
  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  data['rt:accountingTransactions'].push(txn);
  writeData(data);
  res.status(201).json(txn);
});

// PUT /api/transactions/:id
router.put('/transactions/:id', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const idx = (data['rt:accountingTransactions'] || []).findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });
  const allowed = ['type', 'date', 'description', 'amount', 'category', 'receiptUrl', 'linkedPurchaseId'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data['rt:accountingTransactions'][idx][key] = req.body[key];
  }
  writeData(data);
  res.json(data['rt:accountingTransactions'][idx]);
});

// DELETE /api/transactions/:id
router.delete('/transactions/:id', requireRole('Admin'), (req, res) => {
  const data = readData();
  const idx = (data['rt:accountingTransactions'] || []).findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });
  data['rt:accountingTransactions'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGETS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/budgets
router.get('/budgets', (req, res) => {
  const data = readData();
  const budgets = data['rt:budgets'] || [];
  const txns = data['rt:accountingTransactions'] || [];

  const result = budgets.map((b) => {
    const actual = txns
      .filter((t) => {
        const tDate = new Date(t.date);
        return (
          t.category === b.category &&
          ['Purchase', 'Reimbursement'].includes(t.type) &&
          tDate.getFullYear() === b.year &&
          (b.month == null || tDate.getMonth() + 1 === b.month)
        );
      })
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return { ...b, actual };
  });

  res.json(result);
});

// POST /api/budgets
router.post('/budgets', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
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

// PUT /api/budgets/:id
router.put('/budgets/:id', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const idx = (data['rt:budgets'] || []).findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Budget not found' });
  const allowed = ['category', 'year', 'month', 'allocated'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data['rt:budgets'][idx][key] = req.body[key];
  }
  writeData(data);
  res.json(data['rt:budgets'][idx]);
});

// DELETE /api/budgets/:id
router.delete('/budgets/:id', requireRole('Admin'), (req, res) => {
  const data = readData();
  const idx = (data['rt:budgets'] || []).findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Budget not found' });
  data['rt:budgets'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SAVINGS GOALS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/goals
router.get('/goals', (req, res) => {
  const data = readData();
  res.json(data['rt:savingsGoals'] || []);
});

// POST /api/goals
router.post('/goals', requireRole('Admin', 'Manager'), (req, res) => {
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

// PUT /api/goals/:id
router.put('/goals/:id', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const idx = (data['rt:savingsGoals'] || []).findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Goal not found' });
  const allowed = ['name', 'targetAmount', 'currentAmount', 'deadline'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data['rt:savingsGoals'][idx][key] = req.body[key];
  }
  writeData(data);
  res.json(data['rt:savingsGoals'][idx]);
});

// DELETE /api/goals/:id
router.delete('/goals/:id', requireRole('Admin'), (req, res) => {
  const data = readData();
  const idx = (data['rt:savingsGoals'] || []).findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Goal not found' });
  data['rt:savingsGoals'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// POST /api/goals/:id/add-funds
router.post('/goals/:id/add-funds', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const goal = (data['rt:savingsGoals'] || []).find((g) => g.id === req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const amount = parseFloat(req.body.amount) || 0;
  goal.currentAmount = (goal.currentAmount || 0) + amount;

  // Optionally create a linked transaction
  if (amount !== 0) {
    if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
    data['rt:accountingTransactions'].push({
      id: uuidv4(),
      type: 'Donation',
      date: new Date().toISOString(),
      description: `Funds added to savings goal: ${goal.name}`,
      amount,
      category: 'Savings',
      receiptUrl: '',
      linkedGoalId: goal.id,
    });
  }

  writeData(data);
  res.json(goal);
});

// ═══════════════════════════════════════════════════════════════════════════════
// REIMBURSEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/reimbursements
router.get('/reimbursements', (req, res) => {
  const data = readData();
  let reimbs = data['rt:reimbursements'] || [];
  if (req.query.status) reimbs = reimbs.filter((r) => r.status === req.query.status);
  // Members can only see their own
  if (req.user && req.user.role === 'Member') {
    reimbs = reimbs.filter((r) => r.userId === req.user.id);
  }
  res.json(reimbs);
});

// POST /api/reimbursements
router.post('/reimbursements', requireRole('Admin', 'Manager', 'Member'), (req, res) => {
  const data = readData();
  const reimb = {
    id: uuidv4(),
    userId: req.user ? req.user.id : null,
    userName: req.user ? req.user.name : '',
    amount: parseFloat(req.body.amount) || 0,
    reason: req.body.reason || '',
    receiptUrl: req.body.receiptUrl || '',
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    denialReason: null,
    createdAt: new Date().toISOString(),
  };
  if (!data['rt:reimbursements']) data['rt:reimbursements'] = [];
  data['rt:reimbursements'].push(reimb);
  writeData(data);
  res.status(201).json(reimb);
});

// POST /api/reimbursements/:id/approve
router.post('/reimbursements/:id/approve', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const reimb = (data['rt:reimbursements'] || []).find((r) => r.id === req.params.id);
  if (!reimb) return res.status(404).json({ error: 'Reimbursement not found' });
  reimb.status = 'approved';
  reimb.approvedBy = req.user ? req.user.name : 'system';
  reimb.approvedAt = new Date().toISOString();

  // Create a Reimbursement transaction
  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  data['rt:accountingTransactions'].push({
    id: uuidv4(),
    type: 'Reimbursement',
    date: new Date().toISOString(),
    description: `Reimbursement for ${reimb.userName}: ${reimb.reason}`,
    amount: reimb.amount,
    category: 'Reimbursement',
    receiptUrl: reimb.receiptUrl,
    linkedReimbursementId: reimb.id,
  });

  writeData(data);
  res.json(reimb);
});

// POST /api/reimbursements/:id/deny
router.post('/reimbursements/:id/deny', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const reimb = (data['rt:reimbursements'] || []).find((r) => r.id === req.params.id);
  if (!reimb) return res.status(404).json({ error: 'Reimbursement not found' });
  reimb.status = 'denied';
  reimb.approvedBy = req.user ? req.user.name : 'system';
  reimb.approvedAt = new Date().toISOString();
  reimb.denialReason = req.body.reason || '';
  writeData(data);
  res.json(reimb);
});

// ═══════════════════════════════════════════════════════════════════════════════
// FUNDRAISERS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/fundraisers
router.get('/fundraisers', (req, res) => {
  const data = readData();
  res.json(data['rt:fundraisers'] || []);
});

// POST /api/fundraisers
router.post('/fundraisers', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
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

// PUT /api/fundraisers/:id
router.put('/fundraisers/:id', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const idx = (data['rt:fundraisers'] || []).findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Fundraiser not found' });
  const allowed = ['name', 'date', 'targetAmount', 'actualAmount'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) data['rt:fundraisers'][idx][key] = req.body[key];
  }
  writeData(data);
  res.json(data['rt:fundraisers'][idx]);
});

// DELETE /api/fundraisers/:id
router.delete('/fundraisers/:id', requireRole('Admin'), (req, res) => {
  const data = readData();
  const idx = (data['rt:fundraisers'] || []).findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Fundraiser not found' });
  data['rt:fundraisers'].splice(idx, 1);
  writeData(data);
  res.json({ success: true });
});

// POST /api/fundraisers/:id/donations
router.post('/fundraisers/:id/donations', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
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

  // Log as income transaction
  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  data['rt:accountingTransactions'].push({
    id: uuidv4(),
    type: 'FundraiserIncome',
    date: donation.date,
    description: `Donation from ${donation.donor} – ${fundraiser.name}`,
    amount: donation.amount,
    category: 'Fundraiser',
    receiptUrl: '',
    linkedFundraiserId: fundraiser.id,
  });

  writeData(data);
  res.status(201).json(donation);
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/reports/balance-sheet
router.get('/reports/balance-sheet', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const txns = data['rt:accountingTransactions'] || [];

  const byType = {};
  for (const t of txns) {
    if (!byType[t.type]) byType[t.type] = 0;
    byType[t.type] += t.amount || 0;
  }

  const income = (byType['Donation'] || 0) + (byType['FundraiserIncome'] || 0);
  const expenses = (byType['Purchase'] || 0) + (byType['Reimbursement'] || 0);

  res.json({
    totalIncome: income,
    totalExpenses: expenses,
    netBalance: income - expenses,
    breakdown: byType,
    transactions: txns,
  });
});

// GET /api/reports/budget-vs-actual
router.get('/reports/budget-vs-actual', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const budgets = data['rt:budgets'] || [];
  const txns = data['rt:accountingTransactions'] || [];

  const report = budgets.map((b) => {
    const actual = txns
      .filter((t) => {
        const tDate = new Date(t.date);
        return (
          t.category === b.category &&
          ['Purchase', 'Reimbursement'].includes(t.type) &&
          tDate.getFullYear() === b.year &&
          (b.month == null || tDate.getMonth() + 1 === b.month)
        );
      })
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    return { ...b, actual, variance: b.allocated - actual };
  });

  res.json(report);
});

// GET /api/reports/donations
router.get('/reports/donations', requireRole('Admin', 'Manager'), (req, res) => {
  const data = readData();
  const fundraisers = data['rt:fundraisers'] || [];
  const txns = (data['rt:accountingTransactions'] || []).filter(
    (t) => t.type === 'Donation' || t.type === 'FundraiserIncome'
  );

  const totalDonations = txns.reduce((sum, t) => sum + (t.amount || 0), 0);

  res.json({
    totalDonations,
    fundraisers: fundraisers.map((f) => ({
      id: f.id,
      name: f.name,
      date: f.date,
      targetAmount: f.targetAmount,
      actualAmount: f.actualAmount,
      donationCount: (f.donations || []).length,
    })),
    transactions: txns,
  });
});

module.exports = router;
