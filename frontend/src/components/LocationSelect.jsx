import React from 'react';
import { locationLabel, sortLocationsTree, isLocationActive } from '../lib/locations';

export default function LocationSelect({
  locations,
  value,
  onChange,
  className,
  allowEmpty = true,
  includeInactive = false,
  emptyLabel = 'Select…',
}) {
  const today = new Date().toISOString().slice(0, 10);
  const tree = sortLocationsTree(locations || []).filter(
    (l) => includeInactive || isLocationActive(l, today)
  );
  return (
    <select
      className={className || 'input'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {tree.map((l) => (
        <option key={l.id} value={l.name}>
          {`${'— '.repeat(l.depth || 0)}${locationLabel(l, locations)}`}
        </option>
      ))}
    </select>
  );
}
