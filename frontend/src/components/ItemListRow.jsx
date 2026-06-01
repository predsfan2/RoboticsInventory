import React from 'react';
import { CONDITION_COLORS } from '../lib/constants';

export default function ItemListRow({ item, onDetails, onMoveRequest, onDirectMove, canMove }) {
  const isLowStock = item.totalQty <= item.minStock && item.minStock > 0;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${isLowStock ? 'border-l-2 border-l-amber-600' : ''}`}>
      {/* Icon or image */}
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center text-xl flex-shrink-0">📦</div>
      )}

      {/* Name + category */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-100 text-sm truncate">{item.name}</span>
          {item.itemNumber && <span className="text-xs text-gray-600 flex-shrink-0">#{item.itemNumber}</span>}
          {isLowStock && <span className="text-amber-400 text-xs flex-shrink-0">⚠ Low</span>}
        </div>
        <p className="text-xs text-gray-500 truncate">{item.category}</p>
      </div>

      {/* Condition */}
      <span className={`flex-shrink-0 ${CONDITION_COLORS[item.condition] || 'badge bg-gray-800 text-gray-400'}`}>
        {item.condition}
      </span>

      {/* Location */}
      <span className="text-xs text-gray-500 flex-shrink-0 hidden sm:block max-w-[100px] truncate">
        📍 {item.currentLocation || '—'}
      </span>

      {/* Qty */}
      <span className={`text-sm font-semibold flex-shrink-0 w-8 text-right ${isLowStock ? 'text-amber-400' : 'text-gray-300'}`}>
        {item.totalQty}
      </span>

      {/* Actions */}
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => onDetails(item)} className="btn-primary text-xs py-1 px-2">Details</button>
        {onMoveRequest && (
          <button onClick={() => onMoveRequest(item)} className="btn-secondary text-xs py-1 px-2" title="Request move">📍</button>
        )}
        {canMove && onDirectMove && (
          <button onClick={() => onDirectMove(item)} className="btn-secondary text-xs py-1 px-2" title="Move">↪</button>
        )}
      </div>
    </div>
  );
}
