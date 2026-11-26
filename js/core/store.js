// In-memory app state, decrypted after unlock. Every write is encrypted before it touches disk.
import { COLS, getAll, put, delMany, getMeta, setMeta } from './db.js';
import { encJSON, decJSON } from './crypto.js';
import { uid, b64, unb64 } from './util.js';

export const DEFAULT_PREFS = {
  expenseCats: ['Food & dining', 'Groceries', 'Transport', 'Fuel', 'Shopping', 'Bills & utilities', 'Rent', 'EMI & loans',
    'Health', 'Entertainment', 'Subscriptions', 'Education', 'Gifts', 'Travel', 'Personal care', 'Family', 'Other'],
  incomeCats: ['Salary', 'Freelance', 'Refund', 'Interest', 'Gift', 'Other income'],
  modes: ['UPI', 'Card', 'Cash', 'Net banking', 'Autopay'],
  budget: 0,
  alertHour: 9,
  dailyNudge: true,
  xp: 0
};
export const DEFAULT_UI = { lockMinutes: 5, theme: 'auto', lastBackupAt: 0, lastIcsAt: 0, icsDirty: 0, installDismissed: false };

const S = {
  dk: null, vk: null, vault: null, ready: false,
  items: {}, ui: { ...DEFAULT_UI }, listeners: new Set()
};
COLS.forEach(c => { S.items[c] = []; });
export const state = S;

export function subscribe(fn) { S.listeners.add(fn); return () => S.listeners.delete(fn); }
export function emit() { S.listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }

// ---- Plain (non-secret) settings: theme, lock timeout, reminders bookkeeping ----
export async function loadUI() { S.ui = { ...DEFAULT_UI, ...((await getMeta('ui')) || {}) }; return S.ui; }
export async function setUI(patch) { S.ui = { ...S.ui, ...patch }; await setMeta('ui', S.ui); emit(); }

// ---- Load & save ----
const box = r => ({ iv: r.iv, ct: r.cipher });

export async function loadAll(dk) {
  S.dk = dk;
  const cutoff = Date.now() - 30 * 864e5;
  for (const c of COLS) {
    const recs = await getAll(c);
    const live = [];
    await Promise.all(recs.map(async r => {
      if (r.deleted) return;
      try { live.push({ ...(await decJSON(dk, box(r))), id: r.id, updatedAt: r.updatedAt }); }
      catch (e) { console.warn('Could not decrypt a record in', c); }
    }));
    S.items[c] = live;
    const old = recs.filter(r => r.deleted && r.updatedAt < cutoff).map(r => r.id);
    if (old.length) await delMany(c, old);
  }
  S.ready = true;
  emit();
}

const REMINDER_COLS = ['people', 'tasks', 'bills'];
async function bumpIcs(col) { if (REMINDER_COLS.includes(col)) await setUI({ icsDirty: (S.ui.icsDirty || 0) + 1 }); }

export async function save(col, obj, opts = {}) {
  if (!S.dk) throw new Error('Locked');
  const { id: oldId, updatedAt, ...body } = obj;
  const id = oldId || uid();
  const now = Date.now();
  const enc = await encJSON(S.dk, body);
  await put(col, { id, updatedAt: now, iv: enc.iv, cipher: enc.ct });
  const item = { ...body, id, updatedAt: now };
  const arr = S.items[col].slice();
  const i = arr.findIndex(x => x.id === id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  S.items[col] = arr;
  if (!opts.quiet) await bumpIcs(col);
  emit();
  return item;
}

export async function remove(col, id) {
  await put(col, { id, updatedAt: Date.now(), deleted: true });
  S.items[col] = S.items[col].filter(x => x.id !== id);
  if (col === 'vault' && S.vault) S.vault = S.vault.filter(x => x.id !== id);
  await bumpIcs(col);
  emit();
}

export function wipe() {
  S.dk = null; S.vk = null; S.vault = null; S.ready = false;
  COLS.forEach(c => { S.items[c] = []; });
  clearTimeout(vaultTimer);
  emit();
}

// ---- Preferences (encrypted, single record) ----
export function prefs() {
  const p = S.items.prefs.find(x => x.id === 'prefs');
  return { ...DEFAULT_PREFS, ...(p || {}) };
}
export async function savePrefs(patch) {
  const { id, updatedAt, ...cur } = prefs();
  return save('prefs', { ...cur, ...patch, id: 'prefs' }, { quiet: true });
}

// ---- Pip's XP: small rewards for getting things done ----
export const levelOf = xp => Math.floor((xp || 0) / 100) + 1;
export async function addXP(n) {
  const before = prefs().xp || 0;
  const xp = Math.max(0, before + n);
  await savePrefs({ xp });
  return { xp, level: levelOf(xp), leveledUp: levelOf(xp) > levelOf(before) };
}

// ---- Vault: items are encrypted with the vault key, then again with the data key ----
let vaultTimer = null;
export const VAULT_TIMEOUT = 2 * 60 * 1000;
export function touchVault() {
  clearTimeout(vaultTimer);
  if (S.vk) vaultTimer = setTimeout(lockVault, VAULT_TIMEOUT);
}
export function lockVault() { S.vk = null; S.vault = null; clearTimeout(vaultTimer); emit(); }

export async function openVault(vk) {
  const out = [];
  for (const it of S.items.vault) {
    try {
      const body = await decJSON(vk, { iv: unb64(it.siv), ct: unb64(it.sct) });
      out.push({ ...body, id: it.id, updatedAt: it.updatedAt });
    } catch (e) { console.warn('Vault item could not be opened'); }
  }
  S.vk = vk; S.vault = out;
  touchVault();
  emit();
}

export async function saveVaultItem(item) {
  if (!S.vk) throw new Error('Vault is locked');
  const { id, updatedAt, ...body } = item;
  const inner = await encJSON(S.vk, body);
  const saved = await save('vault', { id, siv: b64(inner.iv), sct: b64(inner.ct) }, { quiet: true });
  const v = S.vault.slice();
  const full = { ...body, id: saved.id, updatedAt: saved.updatedAt };
  const i = v.findIndex(x => x.id === saved.id);
  if (i >= 0) v[i] = full; else v.push(full);
  S.vault = v;
  touchVault();
  emit();
  return full;
}
