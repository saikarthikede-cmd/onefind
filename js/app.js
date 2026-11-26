// One Find — app shell: boot, lock/unlock, routing, tab bar, auto-lock, offline updates.
import { html, render, useState, useEffect } from './vendor/preact-htm.js';
import { Icon, Toasts, toast } from './ui/kit.js';
import { openDB, getMeta } from './core/db.js';
import { loadAll, loadUI, wipe, lockVault, state } from './core/store.js';
import { lsGet, cls } from './core/util.js';
import { setLockHandler } from './screens/actions.js';
import { Setup, Lock } from './screens/gate.js';
import { Today } from './screens/today.js';
import { Tasks } from './screens/tasks.js';
import { Money } from './screens/money.js';
import { People } from './screens/people.js';
import { Bills } from './screens/bills.js';
import { Notes } from './screens/notes.js';
import { Habits } from './screens/habits.js';
import { Vault } from './screens/vault.js';
import { Places } from './screens/places.js';
import { More, Search, Desk } from './screens/more.js';
import { Settings, applyTheme } from './screens/settings.js';

applyTheme(lsGet('theme', 'auto'));

const ROUTES = { today: Today, tasks: Tasks, money: Money, people: People, more: More, bills: Bills, notes: Notes, habits: Habits, vault: Vault, places: Places, search: Search, settings: Settings, desk: Desk };
const TABS = [['today', 'today', 'Today'], ['tasks', 'tasks', 'To-dos'], ['money', 'money', 'Money'], ['people', 'people', 'Birthdays'], ['more', 'more', 'More']];
const currentRoute = () => { const r = location.hash.replace(/^#\/?/, '').split('?')[0]; return ROUTES[r] ? r : 'today'; };

// Returns [route, navKey]; navKey changes on every navigation so screens re-read ?open= params.
function useRoute() {
  const [r, setR] = useState([currentRoute(), location.hash]);
  useEffect(() => {
    const f = () => { setR([currentRoute(), location.hash]); window.scrollTo(0, 0); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}

function Shell() {
  const [route, navKey] = useRoute();
  const Screen = ROUTES[route];
  if (route === 'desk') return html`<${Screen} />`;
  const tab = TABS.some(t => t[0] === route) ? route : 'more';
  return html`<div class="app">
    <${Screen} key=${navKey} />
    <nav class="tabbar" aria-label="Main"><div class="wrap">${TABS.map(([r, icon, label]) => html`
      <a href=${'#/' + r} class=${cls(tab === r && 'on')} aria-current=${tab === r ? 'page' : null}><span class="tab-ico"><${Icon} name=${icon} /></span>${label}</a>`)}
    </div></nav>
  </div>`;
}

function App() {
  const [phase, setPhase] = useState('boot');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        await openDB();
        const ui = await loadUI();
        applyTheme(ui.theme);
        setPhase((await getMeta('keys')) ? 'locked' : 'setup');
      } catch (e) {
        console.error(e);
        setError((e && e.message) || 'Storage is not available.');
      }
    })();
    setLockHandler(() => { wipe(); setPhase('locked'); });
  }, []);

  // Auto-lock after the app has been in the background for the chosen time; vault locks at once.
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) { hiddenAt = Date.now(); lockVault(); return; }
      if (phase === 'ready' && hiddenAt && Date.now() - hiddenAt >= (state.ui.lockMinutes || 0) * 60000) { wipe(); setPhase('locked'); }
      hiddenAt = 0;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase]);

  const unlocked = async dk => {
    setPhase('loading');
    try { await loadAll(dk); setPhase('ready'); }
    catch (e) { console.error(e); toast('Could not load data'); wipe(); setPhase('locked'); }
  };

  let body;
  if (error) body = html`<div class="gate"><h1>Can't open storage</h1><p class="lead">${error}</p><p class="small muted">In Safari settings, make sure “Block All Cookies” is off and you're not in Private Browsing, then reopen One Find.</p></div>`;
  else if (phase === 'setup') body = html`<${Setup} onDone=${unlocked} />`;
  else if (phase === 'locked') body = html`<${Lock} onUnlocked=${unlocked} />`;
  else if (phase === 'ready') body = html`<${Shell} />`;
  else body = html`<div class="gate center"><div class="spinner"></div><p class="muted">${phase === 'loading' ? 'Decrypting…' : ''}</p></div>`;
  return html`${body}<${Toasts} />`;
}

render(html`<${App} />`, document.getElementById('app'));

// ---- Offline support & updates ----
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const prompt = w => toast('A new version of One Find is ready', { action: 'Reload', ms: 15000, onAction: () => w.postMessage({ type: 'SKIP_WAITING' }) });
    if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w); });
    });
  }).catch(e => console.warn('Offline mode unavailable:', e));
  // Reload only when an update replaces a running version (not on the very first install).
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
