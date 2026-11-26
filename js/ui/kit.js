// Shared UI pieces: icons, sheets, fields, toasts, hooks.
import { html, useState, useEffect, useRef } from '../vendor/preact-htm.js';
import { state, subscribe } from '../core/store.js';
import { cls } from '../core/util.js';

export { html, useState, useEffect, useRef };

import { ICONS } from './icons.js';
import { Pip } from './pip.js';
export { Pip };

// Pixel icons look sharp only at multiples of their 24px grid, so sizes snap to 12 / 24 / 36 / 48.
const snap = s => (s <= 14 ? 12 : s <= 30 ? 24 : s <= 42 ? 36 : 48);
export const Icon = ({ name, size = 24 }) => {
  const s = snap(size);
  return html`<svg class="ic" width=${s} height=${s} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" shape-rendering="crispEdges">
    ${(ICONS[name] || []).map(d => html`<path d=${d} />`)}</svg>`;
};

// Re-render when the store changes.
export function useStore() {
  const [, set] = useState(0);
  useEffect(() => subscribe(() => set(n => n + 1)), []);
  return state;
}

export function useForm(initial) {
  const [f, setF] = useState(initial);
  const bind = k => ({ value: f[k] == null ? '' : f[k], onInput: e => { const v = e.currentTarget.value; setF(s => ({ ...s, [k]: v })); } });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  return [f, bind, set, setF];
}

// ---- Routing (hash based) ----
export const go = (r, params) => { location.hash = '#/' + r + (params ? '?' + new URLSearchParams(params) : ''); };
export function routeParam(name) {
  const q = location.hash.split('?')[1];
  return q ? new URLSearchParams(q).get(name) : null;
}
export function clearParam() { const r = location.hash.split('?')[0]; if (location.hash.includes('?')) history.replaceState(null, '', r); }

// ---- Toasts ----
let toasts = [], toastListeners = new Set(), tid = 0;
export function toast(msg, opts = {}) {
  const id = ++tid;
  const t = { id, msg, ...opts };
  toasts = [...toasts, t].slice(-3);
  toastListeners.forEach(f => f());
  setTimeout(() => dismiss(id), opts.ms || (opts.action ? 5000 : 2600));
}
function dismiss(id) { toasts = toasts.filter(t => t.id !== id); toastListeners.forEach(f => f()); }
export function Toasts() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set(n => n + 1); toastListeners.add(f); return () => toastListeners.delete(f); }, []);
  return html`<div class="toasts" role="status" aria-live="polite">${toasts.map(t => html`
    <div class="toast" key=${t.id}><span>${t.msg}</span>
      ${t.action && html`<button onClick=${() => { dismiss(t.id); t.onAction && t.onAction(); }}>${t.action}</button>`}
    </div>`)}</div>`;
}

export const errMsg = e => (e && e.message) || 'Something went wrong.';
export async function attempt(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { console.error(e); toast(errMsg(e)); return undefined; }
}

// ---- Layout pieces ----
export function Header({ title, sub, back, right }) {
  return html`<header class="hdr"><div class="wrap">
    ${back && html`<button class="icon-btn back" aria-label="Back" onClick=${() => go(back)}><${Icon} name="back" /></button>`}
    <h1>${title}</h1>${right}
  </div>${sub && html`<div class="wrap"><p class="sub-title">${sub}</p></div>`}</header>`;
}

export const Section = ({ title, action, onAction, children }) => html`
  <section class="sec">
    ${title && html`<div class="sec-h"><h2>${title}</h2>${action && html`<button class="act" onClick=${onAction}>${action}</button>`}</div>`}
    ${children}
  </section>`;

export const Empty = ({ mood = 'happy', title, text, action, onAction }) => html`
  <div class="empty">
    <${Pip} mood=${mood} size=${64} />
    <h3>${title}</h3>${text && html`<p>${text}</p>`}
    ${action && html`<button class="btn soft" onClick=${onAction}>${action}</button>`}
  </div>`;

export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; removeEventListener('keydown', onKey); };
  }, []);
  return html`<div class="sheet-bg" onClick=${e => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="sheet" role="dialog" aria-modal="true" aria-label=${title}>
      <div class="sheet-h"><h3>${title}</h3>
        <button class="icon-btn muted" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button></div>
      <div class="sheet-b">${children}</div>
      ${footer && html`<div class="sheet-f">${footer}</div>`}
    </div></div>`;
}

// `group` = the field holds buttons (chips, segments, checklists), so it must not be wrapped in a <label>.
export const Field = ({ label, hint, group, children }) => group
  ? html`<div class="field" role="group" aria-label=${label}><span class="lbl">${label}</span>${children}${hint && html`<div class="hint">${hint}</div>`}</div>`
  : html`<div class="field"><label><span class="lbl">${label}</span>${children}</label>${hint && html`<div class="hint">${hint}</div>`}</div>`;

export const Seg = ({ options, value, onChange }) => html`
  <div class="seg" role="tablist">${options.map(([v, l]) => html`
    <button type="button" role="tab" aria-selected=${value === v} class=${cls(value === v && 'on')} onClick=${() => onChange(v)}>${l}</button>`)}
  </div>`;

export const Chips = ({ options, value, onChange, multi }) => html`
  <div class="chips">${options.map(o => {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    const on = multi ? (value || []).includes(v) : value === v;
    const click = () => multi ? onChange(on ? value.filter(x => x !== v) : [...(value || []), v]) : onChange(v);
    return html`<button type="button" class=${cls('chip', on && 'on')} aria-pressed=${on} onClick=${click}>${l}</button>`;
  })}</div>`;

export const Toggle = ({ label, checked, onChange }) => html`
  <label class="toggle"><span>${label}</span>
    <input type="checkbox" checked=${checked} onChange=${e => onChange(e.currentTarget.checked)} /><span class="sw"></span></label>`;

export const Banner = ({ icon, title, text, action, onAction, onClose, warn }) => html`
  <div class=${cls('banner', warn && 'warn')}>
    <${Icon} name=${icon} />
    <div class="grow"><b>${title}</b>${text}
      ${action && html`<div class="mt-s"><button class="btn sm" onClick=${onAction}>${action}</button></div>`}</div>
    ${onClose && html`<button class="icon-btn muted" aria-label="Dismiss" onClick=${onClose}><${Icon} name="x" size=${18} /></button>`}
  </div>`;

export const Fab = ({ onClick, label }) => html`<button class="fab" aria-label=${label} onClick=${onClick}><${Icon} name="plus" size=${36} /></button>`;

// Horizontal bar chart (hand-written SVG, light enough for old phones).
export function Bars({ rows, fmt }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map(r => r.value), 1);
  const rowH = 30, w = 340, labelW = 116, valW = 76, barW = w - labelW - valW - 8;
  return html`<svg class="chart" viewBox=${`0 0 ${w} ${rows.length * rowH + 4}`} role="img" aria-label="Spending by category">
    ${rows.map((r, i) => html`<g>
      <text x="0" y=${i * rowH + 19}>${r.label.length > 15 ? r.label.slice(0, 14) + '…' : r.label}</text>
      <rect x=${labelW} y=${i * rowH + 8} width=${Math.max(3, (r.value / max) * barW)} height="14" rx="4" fill="var(--accent)" opacity=${i === 0 ? 1 : 0.55} />
      <text class="lbl2" x=${w} y=${i * rowH + 19} text-anchor="end">${fmt(r.value)}</text>
    </g>`)}
  </svg>`;
}

export function confirmBox(msg) { return window.confirm(msg); }
