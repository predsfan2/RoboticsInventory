'use strict';

const { v4: uuidv4 } = require('uuid');
const { withData } = require('../utils/storage');
const { auditLog, activityLog } = require('../utils/logging');
const { DomainError } = require('./errors');

const MAX_UNITS = 500;
const CONDITIONS = ['New', 'Good', 'Fair', 'Poor'];

function findItem(data, itemId) {
  const item = (data['rt:items'] || []).find((i) => i.id === itemId);
  if (!item) throw new DomainError('Item not found', { status: 404, code: 'not_found' });
  return item;
}

function itemUnits(data, itemId) {
  if (!data['rt:units']) data['rt:units'] = [];
  return data['rt:units'].filter((u) => u.parentId === itemId);
}

function applyStockChangeInData(data, itemId, { change, reason, unitIds }, user) {
  const delta = parseInt(change, 10);
  if (Number.isNaN(delta)) {
    throw new DomainError('change must be an integer');
  }

  const item = findItem(data, itemId);
  const before = { totalQty: item.totalQty };
  const nextQty = Math.max(0, item.totalQty + delta);
  if (nextQty > MAX_UNITS) {
    throw new DomainError(`Quantity cannot exceed ${MAX_UNITS}`);
  }
  item.totalQty = nextQty;

  const entry = {
    id: uuidv4(),
    change: delta,
    reason: reason || '',
    userName: user ? user.name : 'system',
    date: new Date().toISOString(),
  };
  if (!Array.isArray(item.quantityLog)) item.quantityLog = [];
  item.quantityLog.push(entry);

  const existingUnits = itemUnits(data, item.id);

  if (delta > 0) {
    let nextIdx = existingUnits.length + 1;
    for (let i = 0; i < delta; i++, nextIdx++) {
      data['rt:units'].push({
        id: `${item.id}-unit-${nextIdx}-${uuidv4().slice(0, 8)}`,
        parentId: item.id,
        unitSku: `${item.itemNumber || item.id}-${nextIdx}`,
        condition: item.condition,
        conditionLog: [],
        currentLocation: item.currentLocation,
        currentPerson: item.currentPerson,
      });
    }
  } else if (delta < 0) {
    const toRemove = Math.min(Math.abs(delta), existingUnits.length);
    let removeIds;
    if (Array.isArray(unitIds) && unitIds.length) {
      if (unitIds.length !== Math.abs(delta)) {
        throw new DomainError('unitIds length must match the quantity being removed');
      }
      const found = existingUnits.filter((u) => unitIds.includes(u.id));
      if (found.length !== unitIds.length) {
        throw new DomainError('Some units were not found for this item');
      }
      removeIds = unitIds;
    } else {
      const sorted = [...existingUnits].sort((a, b) => {
        const aBusy = a.currentPerson ? 1 : 0;
        const bBusy = b.currentPerson ? 1 : 0;
        if (aBusy !== bBusy) return aBusy - bBusy;
        return String(a.id).localeCompare(String(b.id));
      });
      removeIds = sorted.slice(0, toRemove).map((u) => u.id);
    }
    data['rt:units'] = data['rt:units'].filter((u) => !removeIds.includes(u.id));
  }

  auditLog(data, 'ADJUST_STOCK', user, item.id, item.name, before, { totalQty: item.totalQty });
  activityLog(data, 'ADJUST_STOCK', user, item.id, item.name, `Stock adjusted by ${delta}. Reason: ${entry.reason}`);
  return item;
}

function applyMoveInData(data, itemId, { location, person, notes, unitIds }, user) {
  const item = findItem(data, itemId);
  const before = { currentLocation: item.currentLocation, currentPerson: item.currentPerson };
  const units = itemUnits(data, item.id);
  const targetUnits = Array.isArray(unitIds) && unitIds.length
    ? units.filter((u) => unitIds.includes(u.id))
    : units;
  const movingAll = !unitIds || !unitIds.length || targetUnits.length === units.length || units.length === 0;

  if (movingAll) {
    if (location !== undefined) item.currentLocation = location;
    if (person !== undefined) item.currentPerson = person;
  }

  if (!Array.isArray(item.locationLog)) item.locationLog = [];
  item.locationLog.push({
    id: uuidv4(),
    location: location !== undefined ? location : item.currentLocation,
    person: person !== undefined ? person : item.currentPerson,
    notes: notes || '',
    date: new Date().toISOString(),
    userName: user ? user.name : 'system',
  });

  for (const u of targetUnits) {
    if (location !== undefined) u.currentLocation = location;
    if (person !== undefined) u.currentPerson = person;
  }

  auditLog(data, 'MOVE_ITEM', user, item.id, item.name, before, {
    currentLocation: item.currentLocation,
    currentPerson: item.currentPerson,
  });
  activityLog(
    data,
    'MOVE_ITEM',
    user,
    item.id,
    item.name,
    `Moved to "${item.currentLocation}"${item.currentPerson ? ` with ${item.currentPerson}` : ''}`
  );
  return item;
}

async function adjustStock(itemId, opts, user) {
  return withData(async (data) => applyStockChangeInData(data, itemId, opts, user));
}

async function applyMove(itemId, opts, user) {
  return withData(async (data) => applyMoveInData(data, itemId, opts, user));
}

async function requestMove(itemId, body, user) {
  return withData(async (data) => {
    const item = findItem(data, itemId);
    if (!data['rt:moveRequests']) data['rt:moveRequests'] = [];
    const mr = {
      id: uuidv4(),
      itemId: item.id,
      requestedLocation: body.requestedLocation || body.location || '',
      requestedPerson: body.requestedPerson || body.person || '',
      notes: body.notes || '',
      requestedBy: user ? user.name : 'unknown',
      status: 'pending',
      approvedBy: null,
      approvedAt: null,
      denialReason: null,
      unitIds: Array.isArray(body.unitIds) ? body.unitIds : [],
    };
    data['rt:moveRequests'].push(mr);
    activityLog(data, 'MOVE_REQUEST', user, item.id, item.name, `Move request created for "${item.name}"`);
    return mr;
  });
}

async function updateCondition(itemId, { condition, note }, user) {
  if (condition && !CONDITIONS.includes(condition)) {
    throw new DomainError('Invalid condition');
  }
  return withData(async (data) => {
    const item = findItem(data, itemId);
    const before = { condition: item.condition };
    item.condition = condition || item.condition;

    const entry = {
      id: uuidv4(),
      condition: item.condition,
      note: note || '',
      date: new Date().toISOString(),
      userName: user ? user.name : 'system',
    };
    if (!Array.isArray(item.conditionLog)) item.conditionLog = [];
    item.conditionLog.push(entry);

    auditLog(data, 'UPDATE_CONDITION', user, item.id, item.name, before, { condition: item.condition });
    activityLog(data, 'UPDATE_CONDITION', user, item.id, item.name, `Condition updated to "${item.condition}"`);
    return item;
  });
}

function assembleKitInData(data, kitId, qty, user) {
  const n = parseInt(qty, 10);
  if (!n || n < 1) throw new DomainError('qty must be a positive integer');
  const kit = findItem(data, kitId);
  if (!kit.isKit) throw new DomainError('Item is not a kit');
  const components = Array.isArray(kit.components) ? kit.components : [];
  if (!components.length) throw new DomainError('Kit has no components');

  for (const row of components) {
    const comp = (data['rt:items'] || []).find((i) => i.id === row.itemId);
    if (!comp) throw new DomainError(`Component ${row.itemId} not found`);
    if (comp.isKit) throw new DomainError('Nested kits are not allowed');
    const need = n * (parseInt(row.qty, 10) || 1);
    if ((comp.totalQty || 0) < need) {
      throw new DomainError(`Not enough ${comp.name}: need ${need}, have ${comp.totalQty || 0}`, {
        code: 'short_stock',
      });
    }
  }

  for (const row of components) {
    const need = n * (parseInt(row.qty, 10) || 1);
    applyStockChangeInData(data, row.itemId, { change: -need, reason: `Assembled into ${kit.name}` }, user);
  }
  applyStockChangeInData(data, kitId, { change: n, reason: 'Kit assembled' }, user);
  activityLog(data, 'KIT_ASSEMBLE', user, kit.id, kit.name, `Assembled ${n} kit(s)`);
  return kit;
}

function breakKitInData(data, kitId, qty, user) {
  const n = parseInt(qty, 10);
  if (!n || n < 1) throw new DomainError('qty must be a positive integer');
  const kit = findItem(data, kitId);
  if (!kit.isKit) throw new DomainError('Item is not a kit');
  if ((kit.totalQty || 0) < n) {
    throw new DomainError(`Not enough assembled kits: have ${kit.totalQty || 0}`);
  }
  const components = Array.isArray(kit.components) ? kit.components : [];
  applyStockChangeInData(data, kitId, { change: -n, reason: 'Kit broken' }, user);
  for (const row of components) {
    const add = n * (parseInt(row.qty, 10) || 1);
    applyStockChangeInData(data, row.itemId, { change: add, reason: `Returned from ${kit.name}` }, user);
  }
  activityLog(data, 'KIT_BREAK', user, kit.id, kit.name, `Broke ${n} kit(s)`);
  return kit;
}

async function assembleKit(kitId, qty, user) {
  return withData(async (data) => assembleKitInData(data, kitId, qty, user));
}

async function breakKit(kitId, qty, user) {
  return withData(async (data) => breakKitInData(data, kitId, qty, user));
}

module.exports = {
  adjustStock,
  applyMove,
  requestMove,
  updateCondition,
  assembleKit,
  breakKit,
  applyStockChangeInData,
  applyMoveInData,
  assembleKitInData,
  breakKitInData,
  MAX_UNITS,
  CONDITIONS,
};
