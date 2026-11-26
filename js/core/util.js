// Small helpers shared across the app.

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function b64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}

export function unb64(str) {
  const s = atob(str);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

// JSON with binary support: Uint8Array <-> {"$b64": "..."}
export const toJSON = obj => JSON.stringify(obj, function (k, v) {
  const raw = this[k];
  if (raw instanceof Uint8Array) return { $b64: b64(raw) };
  if (raw instanceof ArrayBuffer) return { $b64: b64(new Uint8Array(raw)) };
  return v;
});
export const fromJSON = text => JSON.parse(text, (k, v) => (v && typeof v === 'object' && typeof v.$b64 === 'string' ? unb64(v.$b64) : v));

// Money is stored as integer paise.
const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function money(paise) {
  const p = Math.round(Number(paise) || 0);
  const a = Math.abs(p);
  return (p < 0 ? '−' : '') + '₹' + (a % 100 ? inr2 : inr0).format(a / 100);
}
export function parseMoney(s) {
  const n = parseFloat(String(s == null ? '' : s).replace(/[^0-9.]/g, ''));
  return isFinite(n) ? Math.round(n * 100) : 0;
}
export const moneyInput = paise => (paise ? String(paise / 100) : '');

export const cls = (...a) => a.filter(Boolean).join(' ');
export const by = (f, dir = 1) => (a, b) => { const x = f(a), y = f(b); return x < y ? -dir : x > y ? dir : 0; };
export const sum = (arr, f) => arr.reduce((t, x) => t + (f ? f(x) : x), 0);
export const norm = s => String(s || '').toLowerCase().trim();

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Prefer the iOS share sheet (Save to Files / AirDrop), fall back to a download.
export async function shareOrDownload(blob, filename, title) {
  try {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

export function lsGet(k, d) { try { const v = localStorage.getItem('onefind.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
export function lsSet(k, v) { try { localStorage.setItem('onefind.' + k, JSON.stringify(v)); } catch (e) { /* storage may be unavailable */ } }

export async function compressImage(file, maxBytes = 200 * 1024) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let w = img.naturalWidth, h = img.naturalHeight;
    const scale = Math.min(1, 1024 / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    const c = document.createElement('canvas');
    let q = 0.75, out = '';
    for (let i = 0; i < 8; i++) {
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      out = c.toDataURL('image/jpeg', q);
      if (out.length * 0.75 <= maxBytes) break;
      q -= 0.12;
      if (q < 0.4) { w = Math.round(w * 0.8); h = Math.round(h * 0.8); q = 0.65; }
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
