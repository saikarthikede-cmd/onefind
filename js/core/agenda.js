// Derived views shared by Today, Desk mode and Search.
import { nextAnnual, diffDays, today, weekday, addDays, monthKey, timeLabel, nextRepeat } from './dates.js';
import { money, sum } from './util.js';

const KIND_ORDER = { birthday: 0, anniversary: 1, bill: 2, task: 3 };

export function agenda(S, from = today(), horizon = 7) {
  const out = [];
  for (const p of S.items.people) {
    for (const [mmdd, yr, kind] of [[p.birthday, p.birthYear, 'birthday'], [p.anniversary, p.anniversaryYear, 'anniversary']]) {
      if (!mmdd) continue;
      const n = nextAnnual(mmdd, from);
      if (n.days > horizon) continue;
      const years = yr ? Number(n.date.slice(0, 4)) - Number(yr) : null;
      out.push({
        key: p.id + kind, kind, icon: kind === 'birthday' ? 'people' : 'gift', days: n.days, date: n.date,
        title: `${p.name}'s ${kind}`,
        sub: years > 0 ? (kind === 'birthday' ? `Turns ${years}` : `${years} years`) : (p.relation || ''),
        route: 'people', id: p.id, ref: p
      });
    }
  }
  for (const b of S.items.bills) {
    if (!b.dueDate) continue;
    const days = diffDays(from, b.dueDate);
    if (days > horizon) continue;
    out.push({ key: b.id, kind: 'bill', icon: 'bills', days, date: b.dueDate, title: b.name, sub: money(b.amount) + (b.autopay ? ' · autopay' : ''), route: 'bills', id: b.id, ref: b });
  }
  for (const t of S.items.tasks) {
    if (t.doneAt || !t.dueDate) continue;
    const days = diffDays(from, t.dueDate);
    if (days > horizon) continue;
    out.push({ key: t.id, kind: 'task', icon: 'tasks', days, date: t.dueDate, title: t.title, sub: t.dueTime ? timeLabel(t.dueTime) : '', route: 'tasks', id: t.id, ref: t });
  }
  out.sort((a, b) => a.days - b.days || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.ref.dueTime || '').localeCompare(b.ref.dueTime || ''));
  return { overdue: out.filter(x => x.days < 0), today: out.filter(x => x.days === 0), soon: out.filter(x => x.days > 0) };
}

export const scheduledOn = (h, d) => !h.days || !h.days.length || h.days.includes(weekday(d));
export const habitDone = (h, d) => ((h.log && h.log[d]) || 0) >= (Number(h.target) || 1);

export function habitsToday(S, d = today()) {
  return S.items.habits.filter(h => scheduledOn(h, d)).map(h => ({ ...h, count: (h.log && h.log[d]) || 0 }))
    .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}

export function streak(h, from = today()) {
  let d = from, n = 0;
  if (scheduledOn(h, d) && !habitDone(h, d)) d = addDays(d, -1);
  for (let i = 0; i < 400; i++) {
    if (!scheduledOn(h, d)) { d = addDays(d, -1); continue; }
    if (!habitDone(h, d)) break;
    n++; d = addDays(d, -1);
  }
  return n;
}

export function monthTotals(S, key) {
  const tx = S.items.transactions.filter(x => x.date && monthKey(x.date) === key);
  const spent = sum(tx.filter(x => x.type !== 'income'), x => x.amount);
  const income = sum(tx.filter(x => x.type === 'income'), x => x.amount);
  return { tx, spent, income };
}

export function monthlyFixed(bills) {
  return sum(bills, b => b.cycle === 'quarterly' ? b.amount / 3 : b.cycle === 'yearly' ? b.amount / 12 : b.cycle === 'once' ? 0 : b.amount);
}

// Next due date for a task after completion, rolled forward past today.
export function nextTaskDate(t, from = today()) {
  let d = nextRepeat(t.dueDate, t.repeat, t.anchorDay);
  let guard = 0;
  while (d && d < from && guard++ < 1000) d = nextRepeat(d, t.repeat, t.anchorDay);
  return d;
}
