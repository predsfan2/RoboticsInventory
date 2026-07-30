import React from 'react';
import { formatMoney } from './formatMoney';

/**
 * Shared progress bar for goals, fundraisers, and budget utilization.
 */
export default function FinanceProgress({
  current,
  target,
  completeColor = 'bg-emerald-500',
  midColor = 'bg-indigo-500',
  lowColor = 'bg-gray-600',
  overColor = 'bg-red-500',
  showRemaining = true,
  height = 'h-2.5',
}) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const isComplete = target > 0 && current >= target;
  const isOver = target > 0 && current > target;
  const remaining = Math.max(0, target - current);

  let barColor = lowColor;
  if (isOver) barColor = overColor;
  else if (isComplete) barColor = completeColor;
  else if (pct >= 75) barColor = midColor;
  else if (pct >= 40) barColor = 'bg-indigo-500';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="font-semibold text-gray-200 tabular-nums">{formatMoney(current)}</span>
        {target > 0 && (
          <span className="text-gray-500 tabular-nums">of {formatMoney(target)}</span>
        )}
      </div>
      {target > 0 && (
        <>
          <div className={`${height} bg-gray-800 rounded-full overflow-hidden`}>
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1.5">
            <span className={`font-medium tabular-nums ${isComplete ? 'text-emerald-400' : 'text-indigo-400'}`}>
              {pct.toFixed(0)}%
            </span>
            {showRemaining && !isComplete && (
              <span className="text-gray-500 tabular-nums">{formatMoney(remaining)} to go</span>
            )}
            {isComplete && <span className="text-emerald-400">Complete</span>}
          </div>
        </>
      )}
    </div>
  );
}
