// Encrypted backup file (.onefind). Records stay encrypted exactly as stored; the file also carries
// the wrapped keys, so it opens with the passcode (or recovery key) that was active when it was made.
import { COLS, getAll, getMeta, setMeta, putMany, clearAll } from './db.js';
import { decJSON } from './crypto.js';
import { unwrapRaw } from './keys.js';
import { toJSON, fromJSON } from './util.js';
import { state, loadAll } from './store.js';

export async function makeBackup() {
  const data = {};
  for (const c of COLS) data[c] = await getAll(c);
  const obj = {
    app: 'onefind', format: 1, createdAt: new Date().toISOString(),
    keys: await getMeta('keys'), vault: (await getMeta('vault')) || null, data
  };
  return new Blob([toJSON(obj)], { type: 'application/octet-stream' });
}

export async function readBackup(file) {
  let obj;
  try { obj = fromJSON(await file.text()); } catch (e) { throw new Error('This file is not a One Find backup.'); }
  if (!obj || obj.app !== 'onefind' || !obj.keys || !obj.data) throw new Error('This file is not a One Find backup.');
  return obj;
}

export async function sameFamily(obj) {
  const k = await getMeta('keys');
  return !!(k && obj.keys.keyId === k.keyId);
}

// Merge (same key family only): newest change wins, deletions included.
export async function mergeBackup(obj) {
  if (!(await sameFamily(obj))) throw new Error('This backup came from a phone set up separately. Use "Replace" instead.');
  const localVault = await getMeta('vault');
  const vaultClash = localVault && obj.vault && localVault.vaultId !== obj.vault.vaultId;
  let added = 0, updated = 0, skipped = 0;
  for (const c of COLS) {
    if (c === 'vault' && vaultClash) { skipped += (obj.data.vault || []).length; continue; }
    const local = new Map((await getAll(c)).map(r => [r.id, r]));
    const toPut = [];
    for (const r of obj.data[c] || []) {
      const l = local.get(r.id);
      if (l && l.updatedAt >= r.updatedAt) continue;
      if (!r.deleted) {
        try { await decJSON(state.dk, { iv: r.iv, ct: r.cipher }); } catch (e) { skipped++; continue; }
      }
      toPut.push(r);
      if (l) updated++; else added++;
    }
    await putMany(c, toPut);
  }
  if (!localVault && obj.vault) await setMeta('vault', obj.vault);
  await loadAll(state.dk);
  return { added, updated, skipped, vaultClash };
}

// Check a backup's passcode without changing anything.
export async function checkBackupPasscode(obj, passcode) {
  try { const raw = await unwrapRaw(obj.keys, passcode); raw.fill(0); return true; } catch (e) { return false; }
}

// Replace everything on this phone with the backup (its passcode becomes this phone's passcode).
export async function replaceWithBackup(obj) {
  await clearAll();
  await setMeta('keys', obj.keys);
  if (obj.vault) await setMeta('vault', obj.vault);
  await setMeta('attempts', { n: 0, until: 0 });
  for (const c of COLS) await putMany(c, obj.data[c] || []);
}
