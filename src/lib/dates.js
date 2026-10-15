// Dates are handled as local "YYYY-MM-DD" keys so day logs never shift across time zones.
const pad = (n) => String(n).padStart(2, '0');

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k, n) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

/** a - b in whole days. Math.round absorbs DST hours. */
export const diffDays = (a, b) => Math.round((fromKey(a) - fromKey(b)) / 86400000);

export const todayKey = () => toKey(new Date());

export const fmt = (k, opts = { day: 'numeric', month: 'short' }) =>
  fromKey(k).toLocaleDateString(undefined, opts);

export const fmtLong = (k) => fmt(k, { weekday: 'long', day: 'numeric', month: 'long' });

export const inRange = (k, start, end) => k >= start && k <= end;
