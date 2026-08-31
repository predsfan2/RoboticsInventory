export function locationLabel(loc, all = []) {
  if (!loc) return '';
  let row = loc;
  if (typeof loc === 'string') {
    row = all.find((l) => l.name === loc);
    if (!row) return loc;
  }
  if (row.parentId) {
    const parent = all.find((l) => l.id === row.parentId);
    if (parent) return `${parent.name} / ${row.name}`;
  }
  return row.name;
}

export function isLocationActive(loc, today = new Date().toISOString().slice(0, 10)) {
  if (!loc) return true;
  if (loc.startDate && today < loc.startDate) return false;
  if (loc.endDate && today > loc.endDate) return false;
  return true;
}

export function sortLocationsTree(locations) {
  const list = Array.isArray(locations) ? locations.slice() : [];
  const childrenOf = (id) => list.filter((l) => l.parentId === id).sort((a, b) => a.name.localeCompare(b.name));
  const out = [];
  const walk = (nodes, depth) => {
    nodes.forEach((l) => {
      out.push({ ...l, depth });
      walk(childrenOf(l.id), depth + 1);
    });
  };
  walk(childrenOf(null).concat(childrenOf(undefined)).concat(childrenOf('')), 0);
  const placed = new Set(out.map((l) => l.id));
  list
    .filter((l) => !placed.has(l.id) && !list.some((p) => p.id === l.parentId))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((l) => {
      out.push({ ...l, depth: 0 });
      walk(childrenOf(l.id), 1);
    });
  const placed2 = new Set(out.map((l) => l.id));
  list.filter((l) => !placed2.has(l.id)).forEach((l) => out.push({ ...l, depth: 0 }));
  return out;
}
