'use strict';

const { v4: uuidv4 } = require('uuid');
const { withData } = require('../utils/storage');
const { activityLog } = require('../utils/logging');
const { DomainError } = require('./errors');

async function createBorrow(body, user) {
  return withData(async (data) => {
    const item = (data['rt:items'] || []).find((i) => i.id === body.itemId);
    if (!item) throw new DomainError('Item not found', { status: 404, code: 'not_found' });

    if ((item.totalQty || 0) < 1) {
      throw new DomainError('Item has no available quantity to borrow');
    }

    const activeBorrows = (data['rt:borrows'] || []).filter(
      (b) => b.itemId === item.id && b.status === 'active'
    ).length;
    if (activeBorrows >= item.totalQty) {
      throw new DomainError('All units of this item are already borrowed');
    }

    const borrow = {
      id: uuidv4(),
      itemId: body.itemId,
      borrowerName: body.borrowerName || (user ? user.name : ''),
      contact: body.contact || '',
      expectedReturnDate: body.expectedReturnDate || null,
      status: 'active',
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
      returnedAt: null,
      previousPerson: item.currentPerson || '',
    };

    item.currentPerson = borrow.borrowerName;
    if (!Array.isArray(item.locationLog)) item.locationLog = [];
    item.locationLog.push({
      id: uuidv4(),
      location: item.currentLocation,
      person: borrow.borrowerName,
      movedBy: user ? user.name : 'system',
      notes: `Borrowed: ${borrow.notes || ''}`.trim(),
      date: new Date().toISOString(),
    });

    if (!data['rt:borrows']) data['rt:borrows'] = [];
    data['rt:borrows'].push(borrow);
    activityLog(data, 'BORROW_CREATED', user, item.id, item.name,
      `"${item.name}" borrowed by ${borrow.borrowerName}`);
    return borrow;
  });
}

async function returnBorrow(borrowId, { notes } = {}, user) {
  return withData(async (data) => {
    const borrow = (data['rt:borrows'] || []).find((x) => x.id === borrowId);
    if (!borrow) throw new DomainError('Borrow not found', { status: 404, code: 'not_found' });
    if (borrow.status === 'returned') {
      throw new DomainError('Already returned');
    }

    borrow.status = 'returned';
    borrow.returnedAt = new Date().toISOString();
    if (notes) borrow.notes = notes;

    const item = (data['rt:items'] || []).find((i) => i.id === borrow.itemId);
    if (item) {
      item.currentPerson = borrow.previousPerson || '';
      if (!Array.isArray(item.locationLog)) item.locationLog = [];
      item.locationLog.push({
        id: uuidv4(),
        location: item.currentLocation,
        person: item.currentPerson,
        movedBy: user ? user.name : 'system',
        notes: 'Returned from borrow',
        date: new Date().toISOString(),
      });
    }
    activityLog(data, 'BORROW_RETURNED', user, borrow.itemId, item ? item.name : '',
      `"${item ? item.name : borrow.itemId}" returned by ${borrow.borrowerName}`);
    return borrow;
  });
}

module.exports = { createBorrow, returnBorrow };
