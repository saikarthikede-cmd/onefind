// Actions used from more than one screen (Today, Tasks, Bills).
import { save, remove, addXP } from '../core/store.js';
import { today, addMonths } from '../core/dates.js';
import { nextTaskDate } from '../core/agenda.js';
import { toast, attempt } from '../ui/kit.js';
import { money } from '../core/util.js';

let lockHandler = () => {};
export const setLockHandler = f => { lockHandler = f; };
export const lockNow = () => lockHandler();

export async function completeTask(t) {
  await attempt(async () => {
    const done = await save('tasks', { ...t, doneAt: Date.now() });
    let next = null;
    if (t.repeat && t.repeat !== 'none' && t.dueDate) {
      const { id, updatedAt, doneAt, ...rest } = t;
      next = await save('tasks', { ...rest, seriesId: t.seriesId || t.id, dueDate: nextTaskDate(t), doneAt: null });
    }
    const r = await addXP(10);
    toast(next ? '+10 XP · next one added' : '+10 XP · nice work!', {
      action: 'Undo',
      onAction: () => attempt(async () => { await save('tasks', { ...done, doneAt: null }); if (next) await remove('tasks', next.id); await addXP(-10); })
    });
    if (r.leveledUp) levelToast(r.level);
  });
}

export function levelToast(level) {
  setTimeout(() => toast(`✨ Level up! Pip reached Lv ${level}`, { ms: 4000 }), 400);
}

// Log a habit for day d; finishing the day's target earns 5 XP (taken back if un-logged).
export async function bumpHabit(h, d, n) {
  await attempt(async () => {
    const target = Number(h.target) || 1;
    const log = { ...(h.log || {}) };
    const before = log[d] || 0;
    log[d] = Math.max(0, before + n);
    const { count, ...rest } = h;
    await save('habits', { ...rest, log });
    if (before < target && log[d] >= target) {
      const r = await addXP(5);
      toast(`${h.name} done today · +5 XP`);
      if (r.leveledUp) levelToast(r.level);
    } else if (before >= target && log[d] < target) await addXP(-5);
  });
}

export async function reopenTask(t) { await attempt(async () => { await save('tasks', { ...t, doneAt: null }); await addXP(-10); }); }

export function advanceBill(b) {
  const months = b.cycle === 'quarterly' ? 3 : b.cycle === 'yearly' ? 12 : 1;
  return addMonths(b.dueDate, months, b.dueDay);
}

export async function payBill(b) {
  await attempt(async () => {
    const tx = await save('transactions', {
      type: 'expense', amount: b.amount, category: b.category || 'Bills & utilities',
      mode: b.autopay ? 'Autopay' : (b.mode || 'UPI'), date: today(), note: `Bill: ${b.name}`, billId: b.id
    });
    const before = { ...b };
    if (b.cycle === 'once') await remove('bills', b.id);
    else await save('bills', { ...b, dueDate: advanceBill(b), lastPaid: today() });
    const r = await addXP(5);
    toast(`${b.name} paid · +5 XP`, {
      action: 'Undo',
      onAction: () => attempt(async () => { await remove('transactions', tx.id); await save('bills', before); await addXP(-5); })
    });
    if (r.leveledUp) levelToast(r.level);
  });
}
