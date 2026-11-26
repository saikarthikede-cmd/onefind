// More menu, global search, desk mode.
import { html, useState, useEffect, useStore, Header, Section, Icon, Pip, go } from '../ui/kit.js';
import { PixelClock } from '../ui/pip.js';
import { agenda, habitsToday, habitDone } from '../core/agenda.js';
import { today, fmt, fmtMMDD, rel, fmtLong, WEEKDAYS_LONG, MONTHS_LONG } from '../core/dates.js';
import { money, norm } from '../core/util.js';
import { lockNow } from './actions.js';

const TILES = [
  ['bills', 'bills', 'Bills', 'bills'], ['habits', 'habits', 'Habits', 'habits'], ['notes', 'notes', 'Notes & lists', 'notes'],
  ['vault', 'vault', 'Vault', 'vault'], ['places', 'places', 'Where is it?', 'places'], ['search', 'search', 'Search', 'today'],
  ['desk', 'desk', 'Desk mode', 'money'], ['settings', 'settings', 'Settings', 'settings'], ['lock', 'lock', 'Lock now', 'people']
];

export function More() {
  return html`<div>
    <${Header} title="More" />
    <main class="wrap">
      <div class="grid">${TILES.map(([r, icon, label, tone]) => html`
        <button class="tile" onClick=${() => (r === 'lock' ? lockNow() : go(r))}><span class=${'ico-circle ' + tone}><${Icon} name=${icon} size=${36} /></span>${label}</button>`)}</div>
      <div class="card mt"><div class="pal"><${Pip} mood="happy" size=${48} /><div class="bubble small">Everything here is encrypted on this phone. Remember to back up from Settings!</div></div></div>
    </main>
  </div>`;
}

export function Search() {
  const S = useStore();
  const [q, setQ] = useState('');
  const n = norm(q);
  const hit = (...xs) => xs.some(x => norm(x).includes(n));
  const groups = n.length < 2 ? [] : [
    ['Birthdays', 'people', S.items.people.filter(p => hit(p.name, p.relation, p.notes, (p.giftIdeas || []).join(' '))).map(p => [p.id, p.name, fmtMMDD(p.birthday)])],
    ['To-dos', 'tasks', S.items.tasks.filter(t => hit(t.title, t.note)).map(t => [t.id, t.title, t.doneAt ? 'Done' : t.dueDate ? fmt(t.dueDate) : 'No date'])],
    ['Bills', 'bills', S.items.bills.filter(b => hit(b.name, b.note)).map(b => [b.id, b.name, `${money(b.amount)} · due ${fmt(b.dueDate)}`])],
    ['Notes', 'notes', S.items.notes.filter(x => hit(x.title, x.body, (x.tags || []).join(' '), (x.checklist || []).map(c => c.t).join(' '))).map(x => [x.id, x.title || 'Untitled', (x.body || '').slice(0, 60)])],
    ['Where is it?', 'places', S.items.places.filter(p => hit(p.item, p.location, p.note)).map(p => [p.id, p.item, p.location])],
    ['Money', 'money', S.items.transactions.filter(t => hit(t.note, t.category)).slice(0, 30).map(t => [t.id, t.note || t.category, `${money(t.amount)} · ${fmt(t.date, true)}`])],
    ['Habits', 'habits', S.items.habits.filter(h => hit(h.name, h.note)).map(h => [h.id, h.name, h.note || ''])]
  ].filter(g => g[2].length);
  return html`<div>
    <${Header} title="Search" back="more" />
    <main class="wrap">
      <input class="inp" type="search" placeholder="Search everything (vault excluded)" value=${q} onInput=${e => setQ(e.currentTarget.value)} autofocus aria-label="Search everything" />
      ${groups.map(([title, route, rows]) => html`<${Section} key=${title} title=${title}><div class="card list">${rows.map(([id, t, s]) => html`
        <button class="item" key=${id} onClick=${() => go(route, { open: id })}><div class="grow"><div class="t">${t}</div><div class="s">${s}</div></div><${Icon} name="next" /></button>`)}</div><//>`)}
      ${n.length >= 2 && !groups.length && html`<p class="center muted mt">No results for “${q}”.</p>`}
    </main>
  </div>`;
}

export function Desk() {
  const S = useStore();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  const t = today();
  const a = agenda(S, t, 3);
  const habits = habitsToday(S, t).filter(h => !habitDone(h, t));
  const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
  const todayList = [...a.overdue, ...a.today];
  return html`<div class="desk" onDblClick=${() => go('today')}>
    <button class="exit" onClick=${() => go('today')}>Exit desk mode</button>
    <div>
      <div class="clock"><${PixelClock} text=${`${hh}:${mm}`} /></div>
      <div class="date"><${Pip} mood=${now.getHours() >= 22 || now.getHours() < 6 ? 'sleepy' : todayList.length ? 'happy' : 'wow'} size=${48} />${WEEKDAYS_LONG[now.getDay()]}, ${now.getDate()} ${MONTHS_LONG[now.getMonth()]}</div>
    </div>
    <div>
      <h2>Today</h2>
      <ul>${todayList.length ? todayList.map(it => html`<li key=${it.key}>${it.title}<span>${it.days < 0 ? rel(it.days) : it.sub}</span></li>`) : html`<li>All clear<span>✓</span></li>`}
        ${habits.map(h => html`<li key=${h.id}>${h.name}<span>${h.count}/${h.target || 1}</span></li>`)}</ul>
      ${a.soon.length > 0 && html`<h2 style="margin-top:18px">Next 3 days</h2>
        <ul>${a.soon.map(it => html`<li key=${it.key}>${it.title}<span>${rel(it.days)}</span></li>`)}</ul>`}
    </div>
  </div>`;
}
