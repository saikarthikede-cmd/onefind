// Today: Pip's greeting, quick actions, and everything due today and in the next 7 days.
import { html, useState, useStore, Header, Section, Icon, Pip, Banner, go } from '../ui/kit.js';
import { agenda, habitsToday, monthTotals, streak } from '../core/agenda.js';
import { today, fmtLong, fmt, rel, monthKey } from '../core/dates.js';
import { money, isIOS, isStandalone, cls } from '../core/util.js';
import { prefs, setUI, levelOf } from '../core/store.js';
import { completeTask, payBill, bumpHabit, lockNow } from './actions.js';
import { InstallGuide } from './gate.js';

function greeting(h) {
  return h < 5 ? 'Hello, night owl' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// What Pip says depends on the day.
function pipSays(a, habitsLeft, h) {
  const bday = a.today.find(x => x.kind === 'birthday');
  if (a.overdue.length) return ['worried', `${a.overdue.length} thing${a.overdue.length > 1 ? 's are' : ' is'} overdue. Let's clear ${a.overdue.length > 1 ? 'them' : 'it'} first!`];
  if (bday) return ['wow', `It's ${bday.ref.name}'s birthday today! 🎂 Send some love.`];
  const n = a.today.length;
  if (n) return ['happy', `${n} thing${n > 1 ? 's' : ''} for today${habitsLeft ? ` and ${habitsLeft} habit${habitsLeft > 1 ? 's' : ''}` : ''}. You've got this!`];
  if (habitsLeft) return ['happy', `Nothing due today. ${habitsLeft} habit${habitsLeft > 1 ? 's' : ''} left to tick.`];
  if (h >= 22 || h < 5) return ['sleepy', 'All done. Rest well — see you tomorrow.'];
  return ['happy', a.soon.length ? `All clear today! Next up: ${a.soon[0].title} ${rel(a.soon[0].days).toLowerCase()}.` : 'All clear! Enjoy your day ☀'];
}

const TONE = { birthday: 'people', anniversary: 'people', bill: 'bills', task: 'tasks' };

export function AgendaRow({ it }) {
  const tone = it.days < 0 ? 'bad' : TONE[it.kind];
  return html`<div class="item">
    ${it.kind === 'task'
      ? html`<button class=${cls('check', it.ref.priority > 1 && 'prio-' + it.ref.priority)} aria-label=${'Complete ' + it.title} onClick=${() => completeTask(it.ref)}></button>`
      : html`<span class=${cls('ico-circle', tone)}><${Icon} name=${it.icon} /></span>`}
    <button class="grow plain-btn" onClick=${() => go(it.route, { open: it.id })}>
      <div class="t">${it.title}</div>
      <div class="s">${[it.days === 0 ? '' : it.days < 0 ? rel(it.days) : `${fmt(it.date)} · ${rel(it.days)}`, it.sub].filter(Boolean).join(' · ') || ' '}</div>
    </button>
    ${it.kind === 'bill' && it.days <= 3 && html`<button class="btn sm soft" onClick=${() => payBill(it.ref)}>Paid</button>`}
  </div>`;
}

export function HabitRow({ h, d }) {
  const target = Number(h.target) || 1;
  const done = h.count >= target;
  const s = streak(h, d);
  return html`<div class="item">
    <button class=${cls('check', done && 'on')} aria-label=${'Log ' + h.name} onClick=${() => bumpHabit(h, d, done ? -h.count : 1)}>${done && html`<${Icon} name="check" />`}</button>
    <div class="grow"><div class=${cls('t', done && 'done-t')}>${h.name}</div>
      <div class="s">${target > 1 ? `${h.count}/${target} ${h.unit || ''}` : (h.time || 'Today')}${s ? ` · 🔥 ${s}` : ''}</div></div>
    ${target > 1 && !done && html`<button class="btn sm soft" onClick=${() => bumpHabit(h, d, 1)}>+1</button>`}
  </div>`;
}

const QUICK = [
  ['tasks', 'tasks', 'Task'],
  ['money', 'money', 'Expense'],
  ['people', 'people', 'Birthday'],
  ['notes', 'notes', 'Note']
];

export function Today() {
  const S = useStore();
  const [guide, setGuide] = useState(false);
  const t = today();
  const hour = new Date().getHours();
  const a = agenda(S, t, 7);
  const habits = habitsToday(S, t);
  const habitsLeft = habits.filter(h => h.count < (Number(h.target) || 1)).length;
  const pinned = S.items.notes.filter(n => n.pinned);
  const p = prefs();
  const { spent } = monthTotals(S, monthKey(t));
  const ui = S.ui;
  const daysSinceBackup = ui.lastBackupAt ? Math.floor((Date.now() - ui.lastBackupAt) / 864e5) : null;
  const hasData = S.items.people.length + S.items.tasks.length + S.items.transactions.length + S.items.bills.length > 0;
  const showIcs = (ui.icsDirty || 0) >= 5;
  const [mood, says] = pipSays(a, habitsLeft, hour);
  const xp = p.xp || 0;

  return html`<div>
    <${Header} title=${greeting(hour)} sub=${fmtLong(t)} right=${html`
      <button class="icon-btn" aria-label="Search" onClick=${() => go('search')}><${Icon} name="search" /></button>
      <button class="icon-btn" aria-label="Lock" onClick=${lockNow}><${Icon} name="lock" /></button>`} />
    <main class="wrap">
      <div class="card">
        <div class="pal"><${Pip} mood=${mood} size=${64} bounce /><div class="bubble">${says}</div></div>
        <div class="xp" title="Earn XP by finishing tasks, habits and bills">
          <span class="lv">Lv ${levelOf(xp)}</span>
          <div class="bar good" role="progressbar" aria-label="XP to next level" aria-valuenow=${xp % 100} aria-valuemax="100"><i style=${`width:${Math.max(4, xp % 100)}%`}></i></div>
          <span>${xp % 100}/100 XP</span>
        </div>
      </div>

      <div class="quick-grid">${QUICK.map(([r, icon, label]) => html`
        <button class="qa" onClick=${() => go(r, { add: 1 })} aria-label=${'Add ' + label.toLowerCase()}>
          <span class=${'ico-circle ' + r}><${Icon} name=${icon} /></span>+ ${label}</button>`)}</div>

      ${isIOS() && !isStandalone() && !ui.installDismissed && html`<${Banner} icon="download" warn title="Add to Home Screen"
        text=" to keep your data safe and use One Find offline." action="Show me how" onAction=${() => setGuide(true)}
        onClose=${() => setUI({ installDismissed: true })} />`}
      ${showIcs && html`<${Banner} icon="calendar" title="Update calendar reminders"
        text=${` ${ui.icsDirty} changes since your last calendar export.`} action="Export reminders" onAction=${() => go('settings', { open: 'calendar' })} />`}
      ${!showIcs && hasData && (daysSinceBackup === null || daysSinceBackup >= 7) && html`<${Banner} icon="upload"
        title=${daysSinceBackup === null ? 'No backup yet' : `Last backup ${daysSinceBackup} days ago`}
        text="Save an encrypted backup to Files or iCloud Drive." action="Back up now" onAction=${() => go('settings', { open: 'backup' })} />`}

      ${a.overdue.length > 0 && html`<${Section} title="⚠ Overdue"><div class="card list">${a.overdue.map(it => html`<${AgendaRow} key=${it.key} it=${it} />`)}</div><//>`}
      ${a.today.length > 0 && html`<${Section} title="Today"><div class="card list">${a.today.map(it => html`<${AgendaRow} key=${it.key} it=${it} />`)}</div><//>`}
      ${habits.length > 0 && html`<${Section} title="Habits" action="All habits" onAction=${() => go('habits')}><div class="card list">${habits.map(h => html`<${HabitRow} key=${h.id} h=${h} d=${t} />`)}</div><//>`}
      ${a.soon.length > 0 && html`<${Section} title="Next 7 days"><div class="card list">${a.soon.map(it => html`<${AgendaRow} key=${it.key} it=${it} />`)}</div><//>`}
      ${pinned.length > 0 && html`<${Section} title="Pinned notes"><div class="card list">${pinned.map(n => html`
        <button class="item" key=${n.id} onClick=${() => go('notes', { open: n.id })}>
          <span class="ico-circle notes"><${Icon} name="pin" /></span>
          <div class="grow"><div class="t">${n.title || 'Untitled'}</div>
            <div class="s">${(n.checklist || []).length ? `${(n.checklist || []).filter(c => !c.done).length} items left` : (n.body || '').slice(0, 80)}</div></div>
        </button>`)}</div><//>`}

      <${Section} title="This month">
        <button class="stat" style="width:100%;text-align:left;cursor:pointer;display:block" onClick=${() => go('money')}>
          <div class="k">Spent so far</div>
          <div class="v">${money(spent)}${p.budget ? html`<span class="muted small" style="font-weight:600"> of ${money(p.budget)}</span>` : ''}</div>
          ${p.budget > 0 && html`<div class=${cls('bar', spent > p.budget && 'over')}><i style=${`width:${Math.min(100, (spent / p.budget) * 100)}%`}></i></div>`}
        </button>
      <//>
    </main>
    ${guide && html`<${InstallGuide} onClose=${() => setGuide(false)} />`}
  </div>`;
}
