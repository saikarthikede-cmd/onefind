// Key management: passcode, recovery key, vault passphrase.
// The data key (DK) and vault key (VK) are random 256-bit keys. They are only ever stored
// wrapped (encrypted) — by the passcode/passphrase and by the recovery public key.
import { getMeta, setMeta } from './db.js';
import { uid } from './util.js';
import {
  rand, pbkdf2Key, calibrate, seal, unseal, importAes,
  newRecoveryKey, makeRecovery, lockToRecovery, openRecovery, unlockFromRecovery
} from './crypto.js';

const NO_ATTEMPTS = { n: 0, until: 0 };

export async function unwrapRaw(k, secret) {
  const kek = await pbkdf2Key(secret, k.salt, k.iter);
  return unseal(kek, k.pass);
}

async function rewrap(metaKey, k, raw, secret) {
  const salt = rand(16);
  const kek = await pbkdf2Key(secret, salt, k.iter);
  k.salt = salt;
  k.pass = await seal(kek, raw);
  await setMeta(metaKey, k);
}

export async function setupNew(passcode) {
  const iter = await calibrate();
  const salt = rand(16);
  const raw = rand(32);
  const kek = await pbkdf2Key(passcode, salt, iter);
  const pass = await seal(kek, raw);
  const recoveryKey = newRecoveryKey();
  const rec = await makeRecovery(recoveryKey);
  const recDK = await lockToRecovery(rec.pub, raw);
  await setMeta('keys', { v: 1, keyId: uid(), salt, iter, pass, rec, recDK, createdAt: Date.now() });
  await setMeta('attempts', NO_ATTEMPTS);
  const dk = await importAes(raw);
  raw.fill(0);
  return { dk, recoveryKey };
}

export async function lockoutLeft() {
  const a = await getMeta('attempts');
  return a && a.until > Date.now() ? a.until - Date.now() : 0;
}

export async function unlock(passcode) {
  const wait = await lockoutLeft();
  if (wait) throw new Error(`Too many tries. Wait ${Math.ceil(wait / 60000)} min.`);
  const k = await getMeta('keys');
  try {
    const raw = await unwrapRaw(k, passcode);
    const dk = await importAes(raw);
    raw.fill(0);
    await setMeta('attempts', NO_ATTEMPTS);
    return dk;
  } catch (e) {
    const a = (await getMeta('attempts')) || { ...NO_ATTEMPTS };
    a.n += 1;
    a.until = a.n >= 10 ? Date.now() + 60000 * Math.pow(2, Math.min(a.n - 10, 6)) : 0;
    await setMeta('attempts', a);
    if (a.until) throw new Error(`Wrong passcode. Locked for ${Math.ceil((a.until - Date.now()) / 60000)} min.`);
    throw new Error(a.n >= 5 ? `Wrong passcode (${a.n} tries).` : 'Wrong passcode.');
  }
}

export async function recover(recoveryKey, newPasscode) {
  const k = await getMeta('keys');
  let priv;
  try { priv = await openRecovery(k.rec, recoveryKey); } catch (e) { throw new Error('That recovery key is not right.'); }
  const raw = await unlockFromRecovery(priv, k.recDK);
  await rewrap('keys', k, raw, newPasscode);
  const dk = await importAes(raw);
  raw.fill(0);
  await setMeta('attempts', NO_ATTEMPTS);
  return dk;
}

export async function changePasscode(oldP, newP) {
  const k = await getMeta('keys');
  let raw;
  try { raw = await unwrapRaw(k, oldP); } catch (e) { throw new Error('Current passcode is wrong.'); }
  await rewrap('keys', k, raw, newP);
  raw.fill(0);
}

export async function regenerateRecovery(passcode, vaultPass) {
  const k = await getMeta('keys');
  let raw;
  try { raw = await unwrapRaw(k, passcode); } catch (e) { throw new Error('Passcode is wrong.'); }
  const v = await getMeta('vault');
  let vraw = null;
  if (v) {
    if (!vaultPass) throw new Error('Enter your vault passphrase too.');
    try { vraw = await unwrapRaw(v, vaultPass); } catch (e) { throw new Error('Vault passphrase is wrong.'); }
  }
  const recoveryKey = newRecoveryKey();
  const rec = await makeRecovery(recoveryKey);
  k.rec = rec;
  k.recDK = await lockToRecovery(rec.pub, raw);
  await setMeta('keys', k);
  if (v) { v.recVK = await lockToRecovery(rec.pub, vraw); await setMeta('vault', v); vraw.fill(0); }
  raw.fill(0);
  return recoveryKey;
}

// ---- Vault (second key, second passphrase) ----
export const vaultExists = async () => !!(await getMeta('vault'));

export async function vaultSetup(passphrase) {
  const k = await getMeta('keys');
  const salt = rand(16);
  const raw = rand(32);
  const kek = await pbkdf2Key(passphrase, salt, k.iter);
  const pass = await seal(kek, raw);
  const recVK = await lockToRecovery(k.rec.pub, raw);
  await setMeta('vault', { vaultId: uid(), salt, iter: k.iter, pass, recVK });
  const vk = await importAes(raw);
  raw.fill(0);
  return vk;
}

export async function vaultUnlock(passphrase) {
  const v = await getMeta('vault');
  try {
    const raw = await unwrapRaw(v, passphrase);
    const vk = await importAes(raw);
    raw.fill(0);
    return vk;
  } catch (e) {
    throw new Error('Wrong vault passphrase.');
  }
}

export async function vaultRecover(recoveryKey, newPassphrase) {
  const k = await getMeta('keys');
  const v = await getMeta('vault');
  let priv;
  try { priv = await openRecovery(k.rec, recoveryKey); } catch (e) { throw new Error('That recovery key is not right.'); }
  const raw = await unlockFromRecovery(priv, v.recVK);
  await rewrap('vault', v, raw, newPassphrase);
  const vk = await importAes(raw);
  raw.fill(0);
  return vk;
}
