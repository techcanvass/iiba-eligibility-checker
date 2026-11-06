/**
 * Indian-style digit grouping (1,23,456) without Intl, so every runtime that runs the core
 * — browsers, V8 inside Python (mini-racer), Google Apps Script — produces identical text.
 * Matches `Number.prototype.toLocaleString("en-IN")` for whole numbers.
 */
export function formatNumber(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  const digits = String(Math.abs(rounded));
  if (digits.length <= 3) return sign + digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return `${sign}${groups.join(",")},${last3}`;
}
