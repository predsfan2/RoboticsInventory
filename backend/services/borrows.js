'use strict';

const { v4: uuidv4 } = require('uuid');
const { withData } = require('../utils/storage');
const { activityLog } = require('../utils/logging');
const { DomainError } = require('./errors');

function unitsForItem(data, itemId) {
  if (!data['rt:units']) data['rt:units'] = [];
  return data['rt:units'].filter((u) => u.parentId === itemId);
}

function assignUnits(data, item, unitIds, borrowerName) {
  const units = unitsForItem(data, item.id);
  let target = [];
  if (Array.isArray(unitIds) && unitIds.length) {
    target = units.filter((u) => unitIds.includes(u.id));
    if (target.length !== unitIds.length) {
      throw new DomainError('Some units were not found for this item');
    }
  }
  for (const u of target) {
    u.previousPerson = u.currentPerson || '';
    u.currentPerson = borrowerName;
  }
  return target.map((u) => u.id);
}

function restoreUnits(data, item, unitIds) {
  const units = unitsForItem(data, item.id);
  const target = Array.isArray(unitIds) && unitIds.length
    ? units.filter((u) => unitIds.includes(u.id))
    : [];
  for (const u of target) {
    u.currentPerson = u.previousPerson || '';
    delete u.previousPerson;
  }
  const remainingOut = units.filter((u) => u.currentPerson);
  if (remainingOut.length === 0) {
    item.currentPerson = '';
  } else if (remainingOut.length === units.length) {
    item.currentPerson = remainingOut[0].currentPerson;
  } else {
    item.currentPerson = '';
  }
}

function setParentPerson(item, units, qty, borrowerName) {
  const allOut = units.length > 0
    ? units.every((u) => u.currentPerson)
    : (item.totalQty || 1) <= qty;
  if ((item.totalQty || 1) <= 1 || allOut) {
    item.currentPerson = borrowerName;
  }
}

async function createBorrow(body, user) {
  return withData(async (data) => {
    const item = (data['rt:items'] || []).find((i) => i.id === body.itemId);
    if (!item) throw new DomainError('Item not found', { status: 404, code: 'not_found' });

    const qty = Math.max(1, parseInt(body.qty, 10) || 1);
    if ((item.totalQty || 0) < qty) {
      throw new DomainError('Item has no available quantity to borrow');
    }

    const activeQty = (data['rt:borrows'] || [])
      .filter((b) => b.itemId === item.id && b.status === 'active')
      .reduce((s, b) => s + (b.qty || 1), 0);
    if (activeQty + qty > item.totalQty) {
      throw new DomainError('Not enough units available to borrow');
    }

    const units = unitsForItem(data, item.id);
    let unitIds = Array.isArray(body.unitIds) ? body.unitIds.filter(Boolean) : [];
    if (unitIds.length && unitIds.length !== qty) {
      throw new DomainError('unitIds length must match qty');
    }
    if (!unitIds.length && units.length) {
      const free = units.filter((u) => !u.currentPerson).slice(0, qty);
      if (free.length < qty && units.length >= qty) {
        // fall back to any remaining units
      }
      unitIds = (free.length >= qty ? free : units.filter((u) => !u.currentPerson)).slice(0, qty).map((u) => u.id);
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
      qty,
      unitIds: [],
    };

    borrow.unitIds = assignUnits(data, item, unitIds, borrow.borrowerName);
    setParentPerson(item, unitsForItem(data, item.id), qty, borrow.borrowerName);

    if (!Array.isArray(item.locationLog)) item.locationLog = [];
    item.locationLog.push({
      id: uuidv4(),
      location: item.currentLocation,
      person: borrow.borrowerName,
      movedBy: user ? user.name : 'system',
      notes: `Borrowed ×${qty}: ${borrow.notes || ''}`.trim(),
      date: new Date().toISOString(),
    });

    if (!data['rt:borrows']) data['rt:borrows'] = [];
    data['rt:borrows'].push(borrow);
    activityLog(data, 'BORROW_CREATED', user, item.id, item.name,
      `"${item.name}" ×${qty} borrowed by ${borrow.borrowerName}`);
    return borrow;
  });
}

function restoreBorrow(data, borrow, user, note) {
  const item = (data['rt:items'] || []).find((i) => i.id === borrow.itemId);
  if (!item) return;
  restoreUnits(data, item, borrow.unitIds);
  if (!borrow.unitIds || !borrow.unitIds.length) {
    const otherActive = (data['rt:borrows'] || []).some(
      (b) => b.id !== borrow.id && b.itemId === item.id && b.status === 'active'
    );
    if (!otherActive) item.currentPerson = borrow.previousPerson || '';
  }
  if (!Array.isArray(item.locationLog)) item.locationLog = [];
  item.locationLog.push({
    id: uuidv4(),
    location: item.currentLocation,
    person: item.currentPerson,
    movedBy: user ? user.name : 'system',
    notes: note || 'Returned from borrow',
    date: new Date().toISOString(),
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
    restoreBorrow(data, borrow, user, 'Returned from borrow');
    const item = (data['rt:items'] || []).find((i) => i.id === borrow.itemId);
    activityLog(data, 'BORROW_RETURNED', user, borrow.itemId, item ? item.name : '',
      `"${item ? item.name : borrow.itemId}" returned by ${borrow.borrowerName}`);
    return borrow;
  });
}

async function deleteBorrow(borrowId, user) {
  return withData(async (data) => {
    const idx = (data['rt:borrows'] || []).findIndex((x) => x.id === borrowId);
    if (idx === -1) throw new DomainError('Borrow not found', { status: 404, code: 'not_found' });
    const [borrow] = data['rt:borrows'].splice(idx, 1);
    if (borrow.status === 'active') {
      restoreBorrow(data, borrow, user, 'Borrow deleted — person restored');
    }
    return { success: true };
  });
}

module.exports = { createBorrow, returnBorrow, deleteBorrow };
