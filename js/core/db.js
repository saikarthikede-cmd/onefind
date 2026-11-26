// Tiny IndexedDB wrapper. One object store per module + a 'meta' store for key material.
export const COLS = ['people', 'tasks', 'transactions', 'bills', 'notes', 'habits', 'places', 'vault', 'prefs'];
const NAME = 'onefind';
let dbp = null;

function openOnce() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      for (const c of COLS) if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' });
    };
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => db.close();
      db.onclose = () => { dbp = null; };
      res(db);
    };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('Database is busy. Close other One Find windows and try again.'));
  });
}

export function openDB() {
  if (!dbp) {
    // Older iOS Safari sometimes fails the first open; retry once.
    dbp = openOnce().catch(() => new Promise(r => setTimeout(r, 300)).then(openOnce));
    dbp.catch(() => { dbp = null; });
  }
  return dbp;
}

const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = tx => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Transaction aborted')); });
async function os(name, mode) { const db = await openDB(); return db.transaction(name, mode).objectStore(name); }

export const getMeta = async k => req((await os('meta', 'readonly')).get(k));
export const setMeta = async (k, v) => req((await os('meta', 'readwrite')).put(v, k));
export const delMeta = async k => req((await os('meta', 'readwrite')).delete(k));
export const getAll = async col => req((await os(col, 'readonly')).getAll());
export const put = async (col, rec) => req((await os(col, 'readwrite')).put(rec));

export async function putMany(col, recs) {
  if (!recs.length) return;
  const db = await openDB();
  const tx = db.transaction(col, 'readwrite');
  const s = tx.objectStore(col);
  recs.forEach(r => s.put(r));
  return done(tx);
}
export async function delMany(col, ids) {
  if (!ids.length) return;
  const db = await openDB();
  const tx = db.transaction(col, 'readwrite');
  const s = tx.objectStore(col);
  ids.forEach(id => s.delete(id));
  return done(tx);
}
export async function clearAll() {
  const db = await openDB();
  const names = ['meta', ...COLS];
  const tx = db.transaction(names, 'readwrite');
  names.forEach(n => tx.objectStore(n).clear());
  return done(tx);
}
