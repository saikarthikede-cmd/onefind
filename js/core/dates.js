// Date helpers. Dates are stored as local 'YYYY-MM-DD' strings; birthdays as 'MM-DD'.
const pad = n => String(n).padStart(2, '0');
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toStr(new Date());
export function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return toStr(d); }
const utc = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const diffDays = (a, b) => Math.round((utc(b) - utc(a)) / 864e5); // b - a
export const isLeap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate(); // m is 1-12
export const weekday = s => parse(s).getDay();

export function annualIn(year, mmdd) {
  let [mm, dd] = mmdd.split('-').map(Number);
  if (mm === 2 && dd === 29 && !isLeap(year)) dd = 28; // 29 Feb shows on 28 Feb in non-leap years
  return `${year}-${pad(mm)}-${pad(dd)}`;
}
export function nextAnnual(mmdd, from = today()) {
  const y = Number(from.slice(0, 4));
  let d = annualIn(y, mmdd);
  if (d < from) d = annualIn(y + 1, mmdd);
  return { date: d, days: diffDays(from, d) };
}

export function addMonths(s, n, anchorDay) {
  const [y, m, d] = s.split('-').map(Number);
  const day = anchorDay || d;
  const total = m - 1 + n;
  const yy = y + Math.floor(total / 12);
  const mm = ((total % 12) + 12) % 12 + 1;
  return `${yy}-${pad(mm)}-${pad(Math.min(day, daysInMonth(yy, mm)))}`;
}

export function nextRepeat(s, repeat, anchorDay) {
  switch (repeat) {
    case 'daily': return addDays(s, 1);
    case 'weekdays': { let d = addDays(s, 1); while (weekday(d) === 0 || weekday(d) === 6) d = addDays(d, 1); return d; }
    case 'weekly': return addDays(s, 7);
    case 'monthly': return addMonths(s, 1, anchorDay);
    case 'quarterly': return addMonths(s, 3, anchorDay);
    case 'yearly': return addMonths(s, 12, anchorDay);
    default: return null;
  }
}

export function fmt(s, withYear) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ' ' + y : ''}`;
}
export const fmtMMDD = mmdd => { const [m, d] = mmdd.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
export const fmtLong = s => `${WEEKDAYS_LONG[weekday(s)]}, ${fmt(s, true)}`;
export function rel(days) {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1) return days < 7 ? `in ${days} days` : `in ${days} days`;
  return `${-days} days overdue`;
}
export const monthKey = s => s.slice(0, 7);
export const monthLabel = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS_LONG[m - 1]} ${y}`; };
export const shiftMonth = (key, n) => addMonths(key + '-01', n).slice(0, 7);
export const timeLabel = hhmm => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`;
};
