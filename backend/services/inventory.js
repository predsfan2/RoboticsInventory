'use strict';

const { v4: uuidv4 } = require('uuid');
const { withData } = require('../utils/storage');
const { auditLog, activityLog } = require('../utils/logging');
const { DomainError } = require('./errors');

const MAX_UNITS = 500;
const CONDITIONS = ['New', 'Good', 'Fair', 'Poor'];

async function adjustStock(itemId, { change, reason }, user) {
  const delta = parseInt(change, 10);
  if (Number.isNaN(delta)) {
    throw new DomainError('change must be an integer');
  }

  return withData(async (data) => {
    const item = (data['rt:items'] || []).find((i) => i.id === itemId);
    if (!item) throw new DomainError('Item not found', { status: 404, code: 'not_found' });

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

    if (!data['rt:units']) data['rt:units'] = [];
    const existingUnits = data['rt:units'].filter((u) => u.parentId === item.id);

    if (delta > 0) {
      let nextIdx = existingUnits.length + 1;
      for (let i = 0; i < delta; i++, nextIdx++) {
        data['rt:units'].push({
          id: `${item.id}-unit-${nextIdx}`,
          parentId: item.id,
          unitSku: `${item.id}-${nextIdx}`,
          condition: item.condition,
          conditionLog: [],
          currentLocation: item.currentLocation,
          currentPerson: item.currentPerson,
        });
      }
    } else if (delta < 0) {
      const toRemove = Math.min(Math.abs(delta), existingUnits.length);
      const removeIds = existingUnits.slice(-toRemove).map((u) => u.id);
      data['rt:units'] = data['rt:units'].filter((u) => !removeIds.includes(u.id));
    }

    auditLog(data, 'ADJUST_STOCK', user, item.id, item.name, before, { totalQty: item.totalQty });
    activityLog(data, 'ADJUST_STOCK', user, item.id, item.name, `Stock adjusted by ${delta}. Reason: ${entry.reason}`);
    return item;
  });
}

async function updateCondition(itemId, { condition, note }, user) {
  if (condition && !CONDITIONS.includes(condition)) {
    throw new DomainError('Invalid condition');
  }
  return withData(async (data) => {
    const item = (data['rt:items'] || []).find((i) => i.id === itemId);
    if (!item) throw new DomainError('Item not found', { status: 404, code: 'not_found' });

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

module.exports = { adjustStock, updateCondition, MAX_UNITS, CONDITIONS };
