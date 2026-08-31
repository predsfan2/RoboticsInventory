'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('../utils/storage');
const { requirePermission } = require('../utils/auth');
const { saveBase64Upload, RECEIPT_MIMES } = require('../utils/uploads');
const { hasPermission } = require('../utils/permissions');
const { createTransaction, getBalance } = require('../services/finance');
const { approveReimbursement, denyReimbursement } = require('../services/approvals');
const { sendDomainError } = require('../services/errors');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.post('/receipts/upload', requirePermission('finance.transactions.edit', 'finance.reimbursements.request'), asyncHandler(async (req, res) => {
  try {
    const saved = saveBase64Upload({
      base64: req.body.base64,
      mimeType: req.body.mimeType,
      prefix: 'receipt',
      allowedMimes: RECEIPT_MIMES,
      maxBytes: 10 * 1024 * 1024,
    });
    res.json({ url: saved.url, name: req.body.name || saved.filename });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
}));

router.get('/transactions', requirePermission('finance.transactions.view'), (req, res) => {
  const data = readData();
  let txns = data['rt:accountingTransactions'] || [];
  if (req.query.type) txns = txns.filter((t) => t.type === req.query.type);
  if (req.query.category) txns = txns.filter((t) => t.category === req.query.category);
  res.json(txns);
});

router.get('/transactions/balance', requirePermission('finance.transactions.view'), (_req, res) => {
  res.json(getBalance());
});

router.post('/transactions', requirePermission('finance.transactions.edit'), asyncHandler(async (req, res) => {
  try {
    const txn = await createTransaction(req.body || {}, req.user);
    res.status(201).json(txn);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

const IMPORT_TYPE_ALIASES = {
  purchase: 'Purchase',
  expense: 'Purchase',
  donation: 'Donation',
  income: 'Donation',
  fundraiserincome: 'FundraiserIncome',
  fundraiser: 'FundraiserIncome',
  reimbursement: 'Reimbursement',
};

function normalizeImportType(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const key = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, '');
  return IMPORT_TYPE_ALIASES[key] || null;
}

function parseImportDate(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  // M/D/YYYY or MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const month = parseInt(mdy[1], 10);
    const day = parseInt(mdy[2], 10);
    const year = parseInt(mdy[3], 10);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return d.toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function findFundraiserByName(fundraisers, name) {
  const needle = String(name || '').trim().toLowerCase();
  if (!needle) return null;
  return (fundraisers || []).find((f) => String(f.name || '').trim().toLowerCase() === needle) || null;
}

router.post('/transactions/import', requirePermission('finance.transactions.edit'), asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body.transactions) ? req.body.transactions : null;
  if (!rows) {
    return res.status(400).json({ error: 'transactions array is required' });
  }
  if (rows.length === 0) {
    return res.status(400).json({ error: 'No transactions to import' });
  }

  const data = readData();
  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  if (!data['rt:fundraisers']) data['rt:fundraisers'] = [];

  const errors = [];
  const prepared = [];

  rows.forEach((row, index) => {
    const type = normalizeImportType(row.type);
    if (!type) {
      errors.push({ index, error: `Unknown type: ${row.type || '(empty)'}` });
      return;
    }
    const description = String(row.description || '').trim();
    if (!description) {
      errors.push({ index, error: 'Description is required' });
      return;
    }
    const amount = parseFloat(row.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push({ index, error: `Invalid amount: ${row.amount}` });
      return;
    }
    const date = parseImportDate(row.date);
    if (!date) {
      errors.push({ index, error: `Invalid date: ${row.date || '(empty)'}` });
      return;
    }

    const fundraiserName = String(row.fundraiser || '').trim();
    let fundraiser = null;
    if (type === 'FundraiserIncome' && fundraiserName) {
      fundraiser = findFundraiserByName(data['rt:fundraisers'], fundraiserName);
      if (!fundraiser) {
        errors.push({ index, error: `Unknown fundraiser: ${fundraiserName}` });
        return;
      }
    }

    prepared.push({
      index,
      type,
      date,
      description,
      amount,
      category: String(row.category || '').trim() || (type === 'FundraiserIncome' && fundraiser ? 'Fundraiser' : ''),
      receiptUrl: String(row.receiptUrl || '').trim(),
      receiptName: String(row.receiptName || '').trim(),
      fundraiser,
      donor: String(row.donor || '').trim() || 'Anonymous',
    });
  });

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Import validation failed', errors });
  }

  const created = [];
  let linkedFundraiserDonations = 0;

  for (const item of prepared) {
    const txn = {
      id: uuidv4(),
      type: item.type,
      date: item.date,
      description: item.description,
      amount: item.amount,
      category: item.category,
      receiptUrl: item.receiptUrl,
      receiptName: item.receiptName,
      linkedPurchaseId: null,
      linkedGoalId: null,
    };

    if (item.fundraiser) {
      if (!item.fundraiser.donations) item.fundraiser.donations = [];
      item.fundraiser.donations.push({
        id: uuidv4(),
        donor: item.donor,
        amount: item.amount,
        date: item.date,
        notes: item.description,
      });
      item.fundraiser.actualAmount = (item.fundraiser.actualAmount || 0) + item.amount;
      txn.linkedFundraiserId = item.fundraiser.id;
      linkedFundraiserDonations += 1;
    }

    data['rt:accountingTransactions'].push(txn);
    created.push(txn);
  }

  await writeData(data);
  res.status(201).json({
    imported: created.length,
    linkedFundraiserDonations,
    transactions: created,
  });
}));

router.put('/transactions/:id', requirePermission('finance.transactions.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:accountingTransactions'] || []).findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });
  const allowed = ['type', 'date', 'description', 'amount', 'category', 'receiptUrl', 'receiptName', 'linkedPurchaseId', 'linkedGoalId'];
  for (const k of allowed) {
    if (req.body[k] !== undefined) data['rt:accountingTransactions'][idx][k] = req.body[k];
  }
  await writeData(data);
  res.json(data['rt:accountingTransactions'][idx]);
}));

router.delete('/transactions/:id', requirePermission('finance.transactions.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:accountingTransactions'] || []).findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });
  data['rt:accountingTransactions'].splice(idx, 1);
  await writeData(data);
  res.json({ success: true });
}));

router.get('/budgets', requirePermission('finance.budget.view'), (req, res) => {
  const data = readData();
  const budgets = data['rt:budgets'] || [];
  const txns = data['rt:accountingTransactions'] || [];
  const EXPENSE = new Set(['Purchase', 'Reimbursement']);
  const result = budgets.map((b) => {
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

router.post('/budgets', requirePermission('finance.budget.edit'), asyncHandler(async (req, res) => {
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
  await writeData(data);
  res.status(201).json(budget);
}));

router.put('/budgets/:id', requirePermission('finance.budget.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:budgets'] || []).findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Budget not found' });
  for (const k of ['category', 'year', 'month', 'allocated']) {
    if (req.body[k] !== undefined) data['rt:budgets'][idx][k] = req.body[k];
  }
  await writeData(data);
  res.json(data['rt:budgets'][idx]);
}));

router.delete('/budgets/:id', requirePermission('finance.budget.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:budgets'] || []).findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Budget not found' });
  data['rt:budgets'].splice(idx, 1);
  await writeData(data);
  res.json({ success: true });
}));

router.get('/goals', requirePermission('finance.goals.view'), (req, res) => {
  const data = readData();
  res.json(data['rt:savingsGoals'] || []);
});

router.post('/goals', requirePermission('finance.goals.edit'), asyncHandler(async (req, res) => {
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
  await writeData(data);
  res.status(201).json(goal);
}));

router.put('/goals/:id', requirePermission('finance.goals.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:savingsGoals'] || []).findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Goal not found' });
  for (const k of ['name', 'targetAmount', 'currentAmount', 'deadline']) {
    if (req.body[k] !== undefined) data['rt:savingsGoals'][idx][k] = req.body[k];
  }
  await writeData(data);
  res.json(data['rt:savingsGoals'][idx]);
}));

router.delete('/goals/:id', requirePermission('finance.goals.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:savingsGoals'] || []).findIndex((g) => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Goal not found' });
  data['rt:savingsGoals'].splice(idx, 1);
  await writeData(data);
  res.json({ success: true });
}));

router.post('/goals/:id/add-funds', requirePermission('finance.goals.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const goal = (data['rt:savingsGoals'] || []).find((g) => g.id === req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const amount = parseFloat(req.body.amount) || 0;
  goal.currentAmount = (goal.currentAmount || 0) + amount;
  if (amount !== 0) {
    if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
    data['rt:accountingTransactions'].push({
      id: uuidv4(),
      type: 'Donation',
      date: new Date().toISOString(),
      description: req.body.description || ('Funds added to savings goal: ' + goal.name),
      amount,
      category: 'Savings',
      receiptUrl: '',
      linkedGoalId: goal.id,
    });
  }
  await writeData(data);
  res.json(goal);
}));

/** Link an existing income transaction to a goal without creating a new txn. */
router.post('/goals/:id/link-transaction', requirePermission('finance.goals.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const goal = (data['rt:savingsGoals'] || []).find((g) => g.id === req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const txnId = req.body.transactionId;
  const txn = (data['rt:accountingTransactions'] || []).find((t) => t.id === txnId);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  if (txn.linkedGoalId) {
    return res.status(400).json({ error: 'Transaction is already linked to a goal' });
  }

  const amount = parseFloat(txn.amount) || 0;
  txn.linkedGoalId = goal.id;
  if (req.body.description) txn.description = req.body.description;
  goal.currentAmount = (goal.currentAmount || 0) + amount;

  await writeData(data);
  res.json({ goal, transaction: txn });
}));

router.get('/reimbursements', requirePermission('finance.reimbursements.view', 'finance.reimbursements.request', 'finance.reimbursements.approve'), (req, res) => {
  const data = readData();
  let reimbs = data['rt:reimbursements'] || [];
  if (req.query.status) reimbs = reimbs.filter((r) => r.status === req.query.status);
  // Without approve, users only see their own
  if (req.user && !hasPermission(req.user, 'finance.reimbursements.approve') && !hasPermission(req.user, 'approvals.manage')) {
    reimbs = reimbs.filter((r) => r.userId === req.user.id);
  }
  res.json(reimbs);
});

router.post('/reimbursements', requirePermission('finance.reimbursements.request'), asyncHandler(async (req, res) => {
  const data = readData();
  const reimb = {
    id: uuidv4(),
    userId: req.user ? req.user.id : null,
    userName: req.user ? req.user.name : '',
    amount: parseFloat(req.body.amount) || 0,
    reason: req.body.reason || '',
    receiptUrl: req.body.receiptUrl || '',
    receiptName: req.body.receiptName || '',
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
    denialReason: null,
    createdAt: new Date().toISOString(),
  };
  if (!data['rt:reimbursements']) data['rt:reimbursements'] = [];
  data['rt:reimbursements'].push(reimb);
  await writeData(data);
  res.status(201).json(reimb);
}));

router.post('/reimbursements/:id/approve', requirePermission('finance.reimbursements.approve', 'approvals.manage'), asyncHandler(async (req, res) => {
  try {
    const reimb = await approveReimbursement(req.params.id, req.user);
    res.json(reimb);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

router.post('/reimbursements/:id/deny', requirePermission('finance.reimbursements.approve', 'approvals.manage'), asyncHandler(async (req, res) => {
  try {
    const reimb = await denyReimbursement(req.params.id, req.body && req.body.reason, req.user);
    res.json(reimb);
  } catch (err) {
    return sendDomainError(res, err);
  }
}));

router.delete('/reimbursements/:id', requirePermission('finance.reimbursements.approve'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:reimbursements'] || []).findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Reimbursement not found' });
  data['rt:reimbursements'].splice(idx, 1);
  await writeData(data);
  res.json({ success: true });
}));

router.get('/fundraisers', requirePermission('finance.fundraisers.view'), (req, res) => {
  const data = readData();
  res.json(data['rt:fundraisers'] || []);
});

router.post('/fundraisers', requirePermission('finance.fundraisers.edit'), asyncHandler(async (req, res) => {
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
  await writeData(data);
  res.status(201).json(fundraiser);
}));

router.put('/fundraisers/:id', requirePermission('finance.fundraisers.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:fundraisers'] || []).findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Fundraiser not found' });
  for (const k of ['name', 'date', 'targetAmount', 'actualAmount']) {
    if (req.body[k] !== undefined) data['rt:fundraisers'][idx][k] = req.body[k];
  }
  await writeData(data);
  res.json(data['rt:fundraisers'][idx]);
}));

router.delete('/fundraisers/:id', requirePermission('finance.fundraisers.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const idx = (data['rt:fundraisers'] || []).findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Fundraiser not found' });
  data['rt:fundraisers'].splice(idx, 1);
  await writeData(data);
  res.json({ success: true });
}));

router.post('/fundraisers/:id/donations', requirePermission('finance.fundraisers.edit'), asyncHandler(async (req, res) => {
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

  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  data['rt:accountingTransactions'].push({
    id: uuidv4(),
    type: 'FundraiserIncome',
    date: donation.date,
    description: 'Donation from ' + donation.donor + ' – ' + fundraiser.name,
    amount: donation.amount,
    category: 'Fundraiser',
    receiptUrl: '',
    linkedFundraiserId: fundraiser.id,
  });

  await writeData(data);
  res.status(201).json(donation);
}));

router.post('/fundraisers/:id/quick-total', requirePermission('finance.fundraisers.edit'), asyncHandler(async (req, res) => {
  const data = readData();
  const fundraiser = (data['rt:fundraisers'] || []).find((f) => f.id === req.params.id);
  if (!fundraiser) return res.status(404).json({ error: 'Fundraiser not found' });

  const amount = parseFloat(req.body.amount) || 0;
  const label = req.body.label || 'Daily total';
  const date = req.body.date || new Date().toISOString();
  const notes = req.body.notes || '';

  const entry = {
    id: uuidv4(),
    donor: label,
    amount,
    date,
    notes,
    isQuickTotal: true,
  };
  fundraiser.donations.push(entry);
  fundraiser.actualAmount = (fundraiser.actualAmount || 0) + amount;

  if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
  data['rt:accountingTransactions'].push({
    id: uuidv4(),
    type: 'FundraiserIncome',
    date,
    description: label + ' – ' + fundraiser.name,
    amount,
    category: 'Fundraiser',
    receiptUrl: '',
    linkedFundraiserId: fundraiser.id,
  });

  await writeData(data);
  res.status(201).json(entry);
}));

router.get('/reports/balance-sheet', requirePermission('finance.reports.view'), (req, res) => {
  const data = readData();
  const txns = data['rt:accountingTransactions'] || [];
  const byType = {};
  for (const t of txns) { byType[t.type] = (byType[t.type] || 0) + (t.amount || 0); }
  const income = (byType.Donation || 0) + (byType.FundraiserIncome || 0);
  const expenses = (byType.Purchase || 0) + (byType.Reimbursement || 0);
  res.json({
    totalIncome: income,
    totalExpenses: expenses,
    netBalance: income - expenses,
    breakdown: byType,
    transactions: txns,
  });
});

router.get('/reports/budget-vs-actual', requirePermission('finance.reports.view'), (req, res) => {
  const data = readData();
  const budgets = data['rt:budgets'] || [];
  const txns = data['rt:accountingTransactions'] || [];
  const EXPENSE = new Set(['Purchase', 'Reimbursement']);
  const report = budgets.map((b) => {
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

router.get('/reports/donations', requirePermission('finance.reports.view'), (req, res) => {
  const data = readData();
  const fundraisers = data['rt:fundraisers'] || [];
  const txns = (data['rt:accountingTransactions'] || [])
    .filter((t) => t.type === 'Donation' || t.type === 'FundraiserIncome');
  const totalDonations = txns.reduce((s, t) => s + (t.amount || 0), 0);
  res.json({
    totalDonations,
    fundraisers: fundraisers.map((f) => ({
      id: f.id,
      name: f.name,
      date: f.date,
      targetAmount: f.targetAmount,
      actualAmount: f.actualAmount,
      donationCount: (f.donations || []).length,
      donations: f.donations || [],
    })),
    transactions: txns,
  });
});

module.exports = router;
