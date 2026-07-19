import React from 'react';
import { CONDITION_COLORS } from '../lib/constants';

export default function ItemCard({ item, onDetails, onMoveRequest, onDirectMove, canMove }) {
  const isLowStock = item.totalQty <= item.minStock && item.minStock > 0;

  return (
    <div className={`card p-4 flex flex-col gap-3 hover:border-gray-700 transition-colors ${isLowStock ? 'border-amber-800/60' : ''}`}>
      {/* Image / icon */}
      {item.imageUrl ? (
        <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-800">
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-24 rounded-lg bg-gray-800/60 flex items-center justify-center text-4xl">
          📦
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-100 text-sm leading-tight truncate">{item.name}</h3>
          <span className={CONDITION_COLORS[item.condition] || 'badge bg-gray-800 text-gray-400'}>
            {item.condition}
          </span>
        </div>

        {item.itemNumber && (
          <p className="text-xs text-gray-600 mb-1">#{item.itemNumber}</p>
        )}

        <p className="text-xs text-gray-500 mb-2">{item.category}</p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
          <span>📍 {item.currentLocation || '—'}</span>
          <span className={`font-medium ${isLowStock ? 'text-amber-400' : 'text-gray-300'}`}>
            ×{item.totalQty} {isLowStock && '⚠'}
          </span>
          {item.isKit && (
            <span className="text-purple-400">🧰 {(item.components || []).length} in kit</span>
          )}
          {item.currentPerson && <span>👤 {item.currentPerson}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => onDetails(item)} className="btn-primary flex-1 text-xs py-1.5">
          Details
        </button>
        {onMoveRequest && (
          <button onClick={() => onMoveRequest(item)} className="btn-secondary text-xs py-1.5 px-2">
            📍
          </button>
        )}
        {canMove && onDirectMove && (
          <button onClick={() => onDirectMove(item)} className="btn-secondary text-xs py-1.5 px-2" title="Move">
            ↪
          </button>
        )}
      </div>
    </div>
  );
}
