// Habits: water, gym, medicines — daily tick, counts, streaks.
import { html, useState, useEffect, useStore, useForm, Header, Section, Icon, Sheet, Field, Chips, Empty, Fab, routeParam, clearParam, attempt, confirmBox } from '../ui/kit.js';
import { save, remove } from '../core/store.js';
import { streak, scheduledOn, habitDone } from '../core/agenda.js';
import { today, addDays, WEEKDAYS, timeLabel } from '../core/dates.js';
import { cls } from '../core/util.js';
import { bumpHabit } from './actions.js';

const DAY_OPTS = WEEKDAYS.map((d, i) => [i, d]);
const PRESETS = [
  { name: 'Drink water', target: 8, unit: 'glasses' },
  { name: 'Take medicine', target: 1, unit: '', time: '09:00' },
  { name: 'Walk / gym', target: 1, unit: '' },
  { name: 'Read', target: 20, unit: 'pages' },
  { name: 'Sleep by 11', target: 1, unit: '' }
];

function HabitEditor({ habit, onClose }) {
  const h = habit || {};
  const [f, bind, set, setF] = useForm({ name: h.name || '', target: String(h.target || 1), unit: h.unit || '', time: h.time || '', note: h.note || '', days: h.days || [] });
  const valid = f.name.trim();
  const submit = e => {
    e && e.preventDefault();
    if (!valid) return;
    attempt(async () => {
      // keep ~4 months of history
      const cutoff = addDays(today(), -120);
      const log = {};
      Object.keys(h.log || {}).forEach(d => { if (d >= cutoff) log[d] = h.log[d]; });
      await save('habits', { ...h, name: f.name.trim(), target: Math.max(1, parseInt(f.target, 10) || 1), unit: f.unit.trim(), time: f.time, note: f.note, days: f.days, log });
      onClose();
    });
  };
  const del = () => confirmBox(`Delete ${h.name}?`) && attempt(async () => { await remove('habits', h.id); onClose(); }, 'Deleted');
  return html`<${Sheet} title=${h.id ? h.name : 'New habit'} onClose=${onClose} footer=${html`
      ${h.id && html`<button class="btn danger" onClick=${del}>Delete</button>`}
      <button class="btn" onClick=${submit} disabled=${!valid}>Save</button>`}>
    <form onSubmit=${submit}>
      ${!h.id && html`<${Field} group label="Quick start"><div class="chips">${PRESETS.map(p => html`
        <button type="button" class="chip" onClick=${() => setF(s => ({ ...s, name: p.name, target: String(p.target), unit: p.unit, time: p.time || '' }))}>${p.name}</button>`)}</div><//>`}
      <${Field} label="Habit"><input class="inp" ...${bind('name')} placeholder="e.g. Drink water" /><//>
      <div class="two">
        <${Field} label="Times per day"><input class="inp" inputmode="numeric" ...${bind('target')} /><//>
        <${Field} label="Unit (optional)"><input class="inp" ...${bind('unit')} placeholder="glasses, pages…" /><//>
      </div>
      <${Field} group label="Days" hint="Leave all off for every day."><${Chips} multi options=${DAY_OPTS} value=${f.days} onChange=${v => set('days', v)} /><//>
      <${Field} label="Time (optional)" hint="For medicines: add the time and dosage in the note."><input class="inp" type="time" ...${bind('time')} /><//>
      <${Field} label="Note"><input class="inp" ...${bind('note')} placeholder="e.g. 1 tablet after breakfast" /><//>
    </form>
  <//>`;
}

export function Habits() {
  const S = useStore();
  const [edit, setEdit] = useState(null);
  useEffect(() => {
    const id = routeParam('open');
    if (id) { const h = S.items.habits.find(x => x.id === id); if (h) setEdit(h); clearParam(); }
    else if (routeParam('add')) { setEdit({}); clearParam(); }
  }, []);
  const t = today();
  const week = [6, 5, 4, 3, 2, 1, 0].map(n => addDays(t, -n));
  const bump = (h, n) => bumpHabit(h, t, n);

  return html`<div>
    <${Header} title="Habits" back="more" />
    <main class="wrap">
      <${Section}>
        ${S.items.habits.length ? html`<div class="card list">${S.items.habits.map(h => {
          const c = (h.log && h.log[t]) || 0;
          const target = Number(h.target) || 1;
          const s = streak(h, t);
          const sched = scheduledOn(h, t);
          return html`<div class="item" key=${h.id}>
            <button class="grow" style="background:none;border:0;padding:0;text-align:left;cursor:pointer" onClick=${() => setEdit(h)}>
              <div class=${cls('t', c >= target && 'done-t')}>${h.name}</div>
              <div class="s">${sched ? `${c}/${target} ${h.unit || ''} today` : 'Not today'}${h.time ? ' · ' + timeLabel(h.time) : ''}${s ? ` · 🔥 ${s} day${s > 1 ? 's' : ''}` : ''}</div>
              <div class="dots" aria-label="Last 7 days">${week.map(d => html`<i class=${!scheduledOn(h, d) ? 'off' : habitDone(h, d) ? 'on' : ''}></i>`)}</div>
            </button>
            <div class="counter">
              <button class="icon-btn muted" aria-label=${'Less ' + h.name} onClick=${() => bump(h, -1)} disabled=${!c}><${Icon} name="minus" /></button>
              <b>${c}</b>
              <button class="icon-btn filled" aria-label=${'More ' + h.name} onClick=${() => bump(h, 1)}><${Icon} name="plus" /></button>
            </div>
          </div>`;
        })}</div>` : html`<div class="card"><${Empty} mood="wow" title="No habits yet" text="Track water, medicines, exercise — anything you want to do daily." action="Add a habit" onAction=${() => setEdit({})} /></div>`}
      <//>
    </main>
    <${Fab} label="Add habit" onClick=${() => setEdit({})} />
    ${edit && html`<${HabitEditor} habit=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}
