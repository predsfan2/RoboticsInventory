'use strict';

const { v4: uuidv4 } = require('uuid');
const { withData } = require('../utils/storage');
const { DomainError } = require('./errors');
const { applyMoveInData } = require('./inventory');
const { activityLog, auditLog } = require('../utils/logging');
const { hasPermission } = require('../utils/permissions');

function rewriteLocationName(data, oldName, newName) {
  if (!oldName || oldName === newName) return;
  (data['rt:items'] || []).forEach((item) => {
    if (item.currentLocation === oldName) item.currentLocation = newName;
  });
  (data['rt:units'] || []).forEach((u) => {
    if (u.currentLocation === oldName) u.currentLocation = newName;
  });
  (data['rt:moveRequests'] || []).forEach((m) => {
    if (m.status === 'pending' && m.requestedLocation === oldName) {
      m.requestedLocation = newName;
    }
  });
}

function locById(data, id) {
  return (data['rt:locs'] || []).find((l) => l.id === id) || null;
}

function wouldCycle(data, locId, parentId) {
  let cur = parentId;
  const seen = new Set();
  while (cur) {
    if (cur === locId) return true;
    if (seen.has(cur)) return true;
    seen.add(cur);
    const p = locById(data, cur);
    cur = p ? p.parentId : null;
  }
  return false;
}

async function updateLocation(id, body, user) {
  return withData(async (data) => {
    const loc = locById(data, id);
    if (!loc) throw new DomainError('Location not found', { status: 404, code: 'not_found' });

    const oldName = loc.name;
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw new DomainError('name is required');
      loc.name = name;
    }
    if (body.parentId !== undefined) {
      const parentId = body.parentId || null;
      if (parentId === loc.id) throw new DomainError('Location cannot be its own parent');
      if (parentId && !locById(data, parentId)) {
        throw new DomainError('Parent location not found', { status: 404, code: 'not_found' });
      }
      if (parentId && wouldCycle(data, loc.id, parentId)) {
        throw new DomainError('That parent would create a cycle');
      }
      loc.parentId = parentId;
    }
    if (body.startDate !== undefined) loc.startDate = body.startDate || null;
    if (body.endDate !== undefined) loc.endDate = body.endDate || null;

    if (oldName !== loc.name) rewriteLocationName(data, oldName, loc.name);
    return loc;
  });
}

async function mergeLocations(sourceId, targetId, user) {
  if (sourceId === targetId) throw new DomainError('Cannot merge a location into itself');
  return withData(async (data) => {
    const source = locById(data, sourceId);
    const target = locById(data, targetId);
    if (!source || !target) throw new DomainError('Location not found', { status: 404, code: 'not_found' });

    rewriteLocationName(data, source.name, target.name);
    (data['rt:locs'] || []).forEach((l) => {
      if (l.parentId === source.id) l.parentId = target.id;
    });
    data['rt:locs'] = (data['rt:locs'] || []).filter((l) => l.id !== source.id);
    activityLog(data, 'MERGE_LOCATION', user, null, target.name,
      `Merged location "${source.name}" into "${target.name}"`);
    return target;
  });
}

async function deleteLocation(id, { replacementId, leaveAsText } = {}, user) {
  return withData(async (data) => {
    const idx = (data['rt:locs'] || []).findIndex((l) => l.id === id);
    if (idx === -1) throw new DomainError('Location not found', { status: 404, code: 'not_found' });
    const loc = data['rt:locs'][idx];

    if (replacementId) {
      const replacement = locById(data, replacementId);
      if (!replacement) throw new DomainError('Replacement location not found', { status: 404, code: 'not_found' });
      rewriteLocationName(data, loc.name, replacement.name);
      (data['rt:locs'] || []).forEach((l) => {
        if (l.parentId === loc.id) l.parentId = replacement.id;
      });
    } else if (!leaveAsText) {
      const used = (data['rt:items'] || []).some((i) => i.currentLocation === loc.name);
      if (used) {
        throw new DomainError('Items still use this location. Pass replacementId or leaveAsText=true');
      }
    }

    (data['rt:locs'] || []).forEach((l) => {
      if (l.parentId === loc.id) l.parentId = loc.parentId || null;
    });
    data['rt:locs'].splice(idx, 1);
    activityLog(data, 'DELETE_LOCATION', user, null, loc.name, `Deleted location "${loc.name}"`);
    return { success: true };
  });
}

async function bulkMove({ fromLocation, toLocation, person, notes }, user) {
  if (!fromLocation || !toLocation) throw new DomainError('fromLocation and toLocation are required');
  return withData(async (data) => {
    const items = (data['rt:items'] || []).filter((i) => i.currentLocation === fromLocation);
    const canDirect = hasPermission(user, 'moves.approve');
    const results = [];
    if (canDirect) {
      for (const item of items) {
        applyMoveInData(data, item.id, { location: toLocation, person, notes: notes || 'Bulk load-out' }, user);
        results.push({ id: item.id, mode: 'moved' });
      }
    } else if (hasPermission(user, 'moves.request')) {
      if (!data['rt:moveRequests']) data['rt:moveRequests'] = [];
      for (const item of items) {
        const mr = {
          id: uuidv4(),
          itemId: item.id,
          requestedLocation: toLocation,
          requestedPerson: person || '',
          notes: notes || 'Bulk load-out',
          requestedBy: user ? user.name : 'unknown',
          status: 'pending',
          approvedBy: null,
          approvedAt: null,
          denialReason: null,
        };
        data['rt:moveRequests'].push(mr);
        activityLog(data, 'MOVE_REQUEST', user, item.id, item.name, `Bulk move request to "${toLocation}"`);
        results.push({ id: item.id, mode: 'requested', requestId: mr.id });
      }
    } else {
      throw new DomainError('Forbidden', { status: 403, code: 'forbidden' });
    }
    return { count: results.length, results };
  });
}

module.exports = {
  rewriteLocationName,
  updateLocation,
  mergeLocations,
  deleteLocation,
  bulkMove,
};
