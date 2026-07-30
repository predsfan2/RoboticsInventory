/** Format a number as currency with thousands separators. */
export function formatMoney(n, { signed = false } = {}) {
  const num = Number(n) || 0;
  const abs = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!signed) return `$${abs}`;
  if (num > 0) return `+$${abs}`;
  if (num < 0) return `-$${abs}`;
  return `$${abs}`;
}
