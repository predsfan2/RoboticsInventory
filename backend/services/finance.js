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

function reverseTransactionLinks(data, txn) {
  if (!txn) return;
  const amount = parseFloat(txn.amount) || 0;
  if (txn.linkedGoalId) {
    const goal = (data['rt:savingsGoals'] || []).find((g) => g.id === txn.linkedGoalId);
    if (goal) goal.currentAmount = Math.max(0, (goal.currentAmount || 0) - amount);
  }
  if (txn.linkedFundraiserId) {
    const fundraiser = (data['rt:fundraisers'] || []).find((f) => f.id === txn.linkedFundraiserId);
    if (fundraiser) {
      fundraiser.actualAmount = Math.max(0, (fundraiser.actualAmount || 0) - amount);
      if (Array.isArray(fundraiser.donations)) {
        fundraiser.donations = fundraiser.donations.filter((d) => d.transactionId !== txn.id && d.id !== txn.linkedDonationId);
      }
    }
  }
  if (txn.linkedReimbursementId) {
    const reimb = (data['rt:reimbursements'] || []).find((r) => r.id === txn.linkedReimbursementId);
    if (reimb && reimb.status === 'approved') {
      reimb.status = 'voided';
      reimb.transactionId = null;
    }
  }
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
      linkedFundraiserId: body.linkedFundraiserId || null,
      linkedReimbursementId: body.linkedReimbursementId || null,
    };
    if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
    data['rt:accountingTransactions'].push(txn);
    return txn;
  });
}

async function deleteTransaction(id) {
  return withData(async (data) => {
    const idx = (data['rt:accountingTransactions'] || []).findIndex((t) => t.id === id);
    if (idx === -1) throw new DomainError('Transaction not found', { status: 404, code: 'not_found' });
    const [txn] = data['rt:accountingTransactions'].splice(idx, 1);
    reverseTransactionLinks(data, txn);
    return { success: true };
  });
}

async function deleteGoal(id) {
  return withData(async (data) => {
    const idx = (data['rt:savingsGoals'] || []).findIndex((g) => g.id === id);
    if (idx === -1) throw new DomainError('Goal not found', { status: 404, code: 'not_found' });
    data['rt:savingsGoals'].splice(idx, 1);
    (data['rt:accountingTransactions'] || []).forEach((t) => {
      if (t.linkedGoalId === id) t.linkedGoalId = null;
    });
    return { success: true };
  });
}

async function deleteFundraiser(id) {
  return withData(async (data) => {
    const idx = (data['rt:fundraisers'] || []).findIndex((f) => f.id === id);
    if (idx === -1) throw new DomainError('Fundraiser not found', { status: 404, code: 'not_found' });
    const [fundraiser] = data['rt:fundraisers'].splice(idx, 1);
    data['rt:accountingTransactions'] = (data['rt:accountingTransactions'] || []).filter((t) => {
      if (t.linkedFundraiserId !== id) return true;
      if (t.linkedGoalId) {
        const goal = (data['rt:savingsGoals'] || []).find((g) => g.id === t.linkedGoalId);
        if (goal) goal.currentAmount = Math.max(0, (goal.currentAmount || 0) - (t.amount || 0));
      }
      return false;
    });
    return { success: true, name: fundraiser.name };
  });
}

async function deleteReimbursement(id) {
  return withData(async (data) => {
    const idx = (data['rt:reimbursements'] || []).findIndex((r) => r.id === id);
    if (idx === -1) throw new DomainError('Reimbursement not found', { status: 404, code: 'not_found' });
    const [reimb] = data['rt:reimbursements'].splice(idx, 1);
    if (reimb.status === 'approved') {
      const txnIdx = (data['rt:accountingTransactions'] || []).findIndex(
        (t) => t.id === reimb.transactionId || t.linkedReimbursementId === reimb.id
      );
      if (txnIdx !== -1) {
        const [txn] = data['rt:accountingTransactions'].splice(txnIdx, 1);
        if (txn.linkedGoalId) {
          const goal = (data['rt:savingsGoals'] || []).find((g) => g.id === txn.linkedGoalId);
          if (goal) goal.currentAmount = Math.max(0, (goal.currentAmount || 0) - (txn.amount || 0));
        }
      }
    }
    return { success: true };
  });
}

async function updateDonation(fundraiserId, donationId, body) {
  return withData(async (data) => {
    const fundraiser = (data['rt:fundraisers'] || []).find((f) => f.id === fundraiserId);
    if (!fundraiser) throw new DomainError('Fundraiser not found', { status: 404, code: 'not_found' });
    const donation = (fundraiser.donations || []).find((d) => d.id === donationId);
    if (!donation) throw new DomainError('Donation not found', { status: 404, code: 'not_found' });

    const oldAmount = parseFloat(donation.amount) || 0;
    if (body.donor !== undefined) donation.donor = body.donor;
    if (body.notes !== undefined) donation.notes = body.notes;
    if (body.date !== undefined) donation.date = body.date;
    if (body.amount !== undefined) donation.amount = parseFloat(body.amount) || 0;
    const delta = (parseFloat(donation.amount) || 0) - oldAmount;
    fundraiser.actualAmount = (fundraiser.actualAmount || 0) + delta;

    const txn = (data['rt:accountingTransactions'] || []).find((t) => t.id === donation.transactionId);
    if (txn) {
      txn.amount = (parseFloat(txn.amount) || 0) + delta;
      if (body.donor !== undefined || body.date !== undefined) {
        txn.description = (donation.isQuickTotal ? (donation.donor || 'Daily total') : ('Donation from ' + (donation.donor || 'Anonymous'))) + ' – ' + fundraiser.name;
        if (body.date !== undefined) txn.date = donation.date;
      }
      if (txn.linkedGoalId && delta) {
        const goal = (data['rt:savingsGoals'] || []).find((g) => g.id === txn.linkedGoalId);
        if (goal) goal.currentAmount = (goal.currentAmount || 0) + delta;
      }
    }
    return donation;
  });
}

async function deleteDonation(fundraiserId, donationId) {
  return withData(async (data) => {
    const fundraiser = (data['rt:fundraisers'] || []).find((f) => f.id === fundraiserId);
    if (!fundraiser) throw new DomainError('Fundraiser not found', { status: 404, code: 'not_found' });
    const idx = (fundraiser.donations || []).findIndex((d) => d.id === donationId);
    if (idx === -1) throw new DomainError('Donation not found', { status: 404, code: 'not_found' });
    const [donation] = fundraiser.donations.splice(idx, 1);
    fundraiser.actualAmount = Math.max(0, (fundraiser.actualAmount || 0) - (donation.amount || 0));
    const txnIdx = (data['rt:accountingTransactions'] || []).findIndex((t) => t.id === donation.transactionId);
    if (txnIdx !== -1) {
      const [txn] = data['rt:accountingTransactions'].splice(txnIdx, 1);
      if (txn.linkedGoalId) {
        const goal = (data['rt:savingsGoals'] || []).find((g) => g.id === txn.linkedGoalId);
        if (goal) goal.currentAmount = Math.max(0, (goal.currentAmount || 0) - (txn.amount || 0));
      }
    }
    return { success: true };
  });
}

async function createReimbursement(body, user) {
  return withData(async (data) => {
    const reimb = {
      id: uuidv4(),
      userId: user ? user.id : null,
      userName: user ? user.name : '',
      amount: parseFloat(body.amount) || 0,
      reason: body.reason || '',
      receiptUrl: body.receiptUrl || '',
      receiptName: body.receiptName || '',
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
      denialReason: null,
      transactionId: null,
      createdAt: new Date().toISOString(),
    };
    if (!data['rt:reimbursements']) data['rt:reimbursements'] = [];
    data['rt:reimbursements'].push(reimb);
    return reimb;
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

module.exports = {
  computeBalance,
  getBalance,
  createTransaction,
  deleteTransaction,
  deleteGoal,
  deleteFundraiser,
  deleteReimbursement,
  updateDonation,
  deleteDonation,
  createReimbursement,
  reverseTransactionLinks,
  formatMoney,
  INCOME,
  TYPES,
};
