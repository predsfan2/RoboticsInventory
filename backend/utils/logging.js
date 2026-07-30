'use strict';

const { v4: uuidv4 } = require('uuid');

const MAX_AUDIT = 5000;
const MAX_ACTIVITY = 5000;

function trimLog(arr, max) {
  if (arr.length > max) arr.splice(0, arr.length - max);
}

function auditLog(data, action, user, itemId, itemName, before, after) {
  if (!data['rt:auditLog']) data['rt:auditLog'] = [];
  data['rt:auditLog'].push({
    id: uuidv4(),
    action,
    userId: user ? user.id : null,
    userName: user ? user.name : 'system',
    itemId,
    itemName,
    before: before ? JSON.stringify(before) : null,
    after: after ? JSON.stringify(after) : null,
    timestamp: new Date().toISOString(),
  });
  trimLog(data['rt:auditLog'], MAX_AUDIT);
}

function activityLog(data, action, user, itemId, itemName, details) {
  if (!data['rt:activityLog']) data['rt:activityLog'] = [];
  data['rt:activityLog'].push({
    id: uuidv4(),
    action,
    userName: user ? user.name : 'system',
    userId: user ? user.id : null,
    itemId,
    itemName,
    details,
    date: new Date().toISOString(),
  });
  trimLog(data['rt:activityLog'], MAX_ACTIVITY);
}

module.exports = { auditLog, activityLog };
