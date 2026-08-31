'use strict';

const { v4: uuidv4 } = require('uuid');
const { withData, readData } = require('../utils/storage');
const { activityLog } = require('../utils/logging');
const { DomainError } = require('./errors');
const { applyMoveInData } = require('./inventory');
const { approvePurchase, denyPurchase } = require('./purchases');

function listPending() {
  const data = readData() || {};
  const moveRequests = (data['rt:moveRequests'] || [])
    .filter((m) => m.status === 'pending')
    .map((m) => ({ ...m, approvalType: 'moveRequest' }));
  const reimbursements = (data['rt:reimbursements'] || [])
    .filter((r) => r.status === 'pending')
    .map((r) => ({ ...r, approvalType: 'reimbursement' }));
  const purchases = (data['rt:purchases'] || [])
    .filter((p) => p.status === 'PendingApproval')
    .map((p) => ({ ...p, approvalType: 'purchase' }));
  return {
    moveRequests,
    reimbursements,
    purchases,
    total: moveRequests.length + reimbursements.length + purchases.length,
  };
}

function listHistory() {
  const data = readData() || {};
  const moves = (data['rt:moveRequests'] || [])
    .filter((m) => m.status === 'approved' || m.status === 'denied')
    .map((m) => ({ ...m, approvalType: 'moveRequest' }));
  const reimbursements = (data['rt:reimbursements'] || [])
    .filter((r) => r.status === 'approved' || r.status === 'denied' || r.status === 'voided')
    .map((r) => ({ ...r, approvalType: 'reimbursement' }));
  const purchases = (data['rt:purchases'] || [])
    .filter((p) => p.approvedAt && (p.status === 'Needed' || p.status === 'Denied' || p.status === 'Ordered' || p.status === 'Received'))
    .map((p) => ({
      ...p,
      status: p.status === 'Denied' ? 'denied' : 'approved',
      approvalType: 'purchase',
    }));
  const all = [...moves, ...reimbursements, ...purchases]
    .sort((a, b) => String(b.approvedAt || '').localeCompare(String(a.approvedAt || '')));
  return { items: all, total: all.length };
}

async function approveMove(id, user) {
  return withData(async (data) => {
    const mr = (data['rt:moveRequests'] || []).find((m) => m.id === id);
    if (!mr) throw new DomainError('Move request not found', { status: 404, code: 'not_found' });
    if (mr.status !== 'pending') throw new DomainError('Request is not pending');

    mr.status = 'approved';
    mr.approvedBy = user ? user.name : 'system';
    mr.approvedAt = new Date().toISOString();

    const item = (data['rt:items'] || []).find((i) => i.id === mr.itemId);
    if (item) {
      applyMoveInData(data, item.id, {
        location: mr.requestedLocation,
        person: mr.requestedPerson,
        notes: mr.notes || '',
        unitIds: mr.unitIds,
      }, user);
      activityLog(data, 'MOVE_APPROVED', user, item.id, item.name,
        `Move request approved. Moved to "${mr.requestedLocation}"`);
    }
    return mr;
  });
}

async function denyMove(id, reason, user) {
  return withData(async (data) => {
    const mr = (data['rt:moveRequests'] || []).find((m) => m.id === id);
    if (!mr) throw new DomainError('Move request not found', { status: 404, code: 'not_found' });
    if (mr.status !== 'pending') throw new DomainError('Request is not pending');

    mr.status = 'denied';
    mr.approvedBy = user ? user.name : 'system';
    mr.approvedAt = new Date().toISOString();
    mr.denialReason = reason || '';

    activityLog(data, 'MOVE_DENIED', user, mr.itemId, '',
      `Move request denied. Reason: ${mr.denialReason}`);
    return mr;
  });
}

async function approveReimbursement(id, user) {
  return withData(async (data) => {
    const reimb = (data['rt:reimbursements'] || []).find((r) => r.id === id);
    if (!reimb) throw new DomainError('Reimbursement not found', { status: 404, code: 'not_found' });
    if (reimb.status !== 'pending') throw new DomainError('Request is not pending');

    reimb.status = 'approved';
    reimb.approvedBy = user ? user.name : 'system';
    reimb.approvedAt = new Date().toISOString();
    if (!data['rt:accountingTransactions']) data['rt:accountingTransactions'] = [];
    const txn = {
      id: uuidv4(),
      type: 'Reimbursement',
      date: new Date().toISOString(),
      description: 'Reimbursement for ' + reimb.userName + ': ' + reimb.reason,
      amount: reimb.amount,
      category: 'Reimbursement',
      receiptUrl: reimb.receiptUrl,
      linkedReimbursementId: reimb.id,
    };
    data['rt:accountingTransactions'].push(txn);
    reimb.transactionId = txn.id;
    return reimb;
  });
}

async function denyReimbursement(id, reason, user) {
  return withData(async (data) => {
    const reimb = (data['rt:reimbursements'] || []).find((r) => r.id === id);
    if (!reimb) throw new DomainError('Reimbursement not found', { status: 404, code: 'not_found' });
    if (reimb.status !== 'pending') throw new DomainError('Request is not pending');

    reimb.status = 'denied';
    reimb.approvedBy = user ? user.name : 'system';
    reimb.approvedAt = new Date().toISOString();
    reimb.denialReason = reason || '';
    return reimb;
  });
}

async function decide({ id, type, decision, reason }, user) {
  const kind = String(type || '').toLowerCase();
  const action = String(decision || '').toLowerCase();
  if (kind === 'move' || kind === 'moverequest' || kind === 'move_request') {
    if (action === 'approve') return approveMove(id, user);
    if (action === 'deny') return denyMove(id, reason, user);
  }
  if (kind === 'reimbursement') {
    if (action === 'approve') return approveReimbursement(id, user);
    if (action === 'deny') return denyReimbursement(id, reason, user);
  }
  if (kind === 'purchase' || kind === 'po') {
    if (action === 'approve') return approvePurchase(id, user);
    if (action === 'deny') return denyPurchase(id, reason, user);
  }
  throw new DomainError('type must be move, reimbursement, or purchase; decision must be approve or deny');
}

module.exports = {
  listPending,
  listHistory,
  approveMove,
  denyMove,
  approveReimbursement,
  denyReimbursement,
  decide,
};
