'use strict';

const { v4: uuidv4 } = require('uuid');
const { withData, readData } = require('../utils/storage');
const { DomainError } = require('./errors');

const INCOME = new Set(['Donation', 'FundraiserIncome']);
const TYPES = ['Purchase', 'Donation', 'FundraiserIncome', 'Reimbursement'];

function computeBalance(txns) {
  const list = txns || [];
  const income = list.filter((t) => INCOME.has(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  const expenses = list.filter((t) => !INCOME.has(t.type)).reduce((s, t) => s + (t.amount || 0), 0);
  return { income, expenses, balance: income - expenses };
}

function getBalance() {
  const data = readData() || {};
  return computeBalance(data['rt:accountingTransactions'] || []);
}

async function createTransaction(body, _user) {
  if (body.type && !TYPES.includes(body.type)) {
    throw new DomainError('Invalid transaction type');
  }
  const amount = parseFloat(body.amount) || 0;
  return withData(async (data) => {
    const txn = {
      id: uuidv4(),
      type: body.type || 'Purchase',
      date: body.date || new Date().toISOString(),
      description: body.description || '',
      amount,
      category: body.category || '',
      receiptUrl: body.receiptUrl || '',
      receiptName: body.receiptName || '',
      linkedPurchaseId: body.linkedPurchaseId || null,
      linkedGoalId: body.linkedGoalId || null,
    };
    if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
    data['rt:accountingTransactions'].push(txn);
    return txn;
  });
}

function formatMoney(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (num < 0) return `-$${abs}`;
  return `$${abs}`;
}

module.exports = { computeBalance, getBalance, createTransaction, formatMoney, INCOME, TYPES };
