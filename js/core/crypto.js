// Encryption primitives — all built on the browser's Web Crypto API (no third-party crypto).
const subtle = crypto.subtle;
const te = new TextEncoder();
const td = new TextDecoder();

export const rand = n => crypto.getRandomValues(new Uint8Array(n));

// Passcode -> AES-GCM key via PBKDF2-SHA256.
export async function pbkdf2Key(secret, salt, iterations) {
  const base = await subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

// Pick an iteration count that takes ~0.7 s on this device (min 150k, max 1M).
export async function calibrate() {
  const t0 = performance.now();
  await pbkdf2Key('calibrate', rand(16), 50000);
  const ms = Math.max(performance.now() - t0, 1);
  const it = Math.round((50000 * 700) / ms / 10000) * 10000;
  return Math.min(Math.max(it, 150000), 1000000);
}

export async function seal(key, bytes) {
  const iv = rand(12);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { iv, ct };
}
export async function unseal(key, box) {
  return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: box.iv }, key, box.ct));
}
export const importAes = raw => subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
export const encJSON = async (key, obj) => seal(key, te.encode(JSON.stringify(obj)));
export const decJSON = async (key, box) => JSON.parse(td.decode(await unseal(key, box)));

// Recovery: an RSA key pair whose private half is locked by the recovery key.
// Anything (data key, vault key) can be locked to the public half at any time.
const RSA_GEN = { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
const RSA_IMPORT = { name: 'RSA-OAEP', hash: 'SHA-256' };
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function newRecoveryKey() {
  let s = '';
  for (const x of rand(24)) s += ALPHA[x & 31];
  return s.match(/.{4}/g).join('-');
}
export const normRecovery = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function makeRecovery(recoveryKey) {
  const pair = await subtle.generateKey(RSA_GEN, true, ['encrypt', 'decrypt']);
  const pkcs8 = new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey));
  const pub = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const rsalt = rand(16), riter = 200000;
  const rkek = await pbkdf2Key(normRecovery(recoveryKey), rsalt, riter);
  const priv = await seal(rkek, pkcs8);
  pkcs8.fill(0);
  return { rsalt, riter, priv, pub };
}
export async function lockToRecovery(pub, bytes) {
  const pk = await subtle.importKey('spki', pub, RSA_IMPORT, false, ['encrypt']);
  return new Uint8Array(await subtle.encrypt({ name: 'RSA-OAEP' }, pk, bytes));
}
export async function openRecovery(rec, recoveryKey) {
  const rkek = await pbkdf2Key(normRecovery(recoveryKey), rec.rsalt, rec.riter);
  const pkcs8 = await unseal(rkek, rec.priv); // throws if the recovery key is wrong
  const key = await subtle.importKey('pkcs8', pkcs8, RSA_IMPORT, false, ['decrypt']);
  pkcs8.fill(0);
  return key;
}
export async function unlockFromRecovery(privKey, ct) {
  return new Uint8Array(await subtle.decrypt({ name: 'RSA-OAEP' }, privKey, ct));
}
