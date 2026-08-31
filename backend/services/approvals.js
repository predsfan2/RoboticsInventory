'use strict';

const { v4: uuidv4 } = require('uuid');
const { withData, readData } = require('../utils/storage');
const { activityLog } = require('../utils/logging');
const { DomainError } = require('./errors');

function listPending() {
  const data = readData() || {};
  const moveRequests = (data['rt:moveRequests'] || [])
    .filter((m) => m.status === 'pending')
    .map((m) => ({ ...m, approvalType: 'moveRequest' }));
  const reimbursements = (data['rt:reimbursements'] || [])
    .filter((r) => r.status === 'pending')
    .map((r) => ({ ...r, approvalType: 'reimbursement' }));
  return {
    moveRequests,
    reimbursements,
    total: moveRequests.length + reimbursements.length,
  };
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
      item.currentLocation = mr.requestedLocation || item.currentLocation;
      item.currentPerson = mr.requestedPerson !== undefined ? mr.requestedPerson : item.currentPerson;
      if (!Array.isArray(item.locationLog)) item.locationLog = [];
      item.locationLog.push({
        id: uuidv4(),
        location: item.currentLocation,
        person: item.currentPerson,
        movedBy: user ? user.name : 'system',
        notes: mr.notes || '',
        date: new Date().toISOString(),
      });
      activityLog(data, 'MOVE_APPROVED', user, item.id, item.name,
        `Move request approved. Moved to "${item.currentLocation}"`);
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
    data['rt:accountingTransactions'].push({
      id: uuidv4(),
      type: 'Reimbursement',
      date: new Date().toISOString(),
      description: 'Reimbursement for ' + reimb.userName + ': ' + reimb.reason,
      amount: reimb.amount,
      category: 'Reimbursement',
      receiptUrl: reimb.receiptUrl,
      linkedReimbursementId: reimb.id,
    });
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
  throw new DomainError('type must be move or reimbursement, decision must be approve or deny');
}

module.exports = {
  listPending,
  approveMove,
  denyMove,
  approveReimbursement,
  denyReimbursement,
  decide,
};
