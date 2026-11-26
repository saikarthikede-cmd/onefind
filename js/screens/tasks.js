// To-dos: quick capture, due dates, repeats, priority.
import { html, useState, useEffect, useStore, useForm, Header, Section, Icon, Sheet, Field, Seg, Chips, Empty, Fab, routeParam, clearParam, attempt, confirmBox } from '../ui/kit.js';
import { save, remove } from '../core/store.js';
import { today, addDays, diffDays, fmt, rel, timeLabel } from '../core/dates.js';
import { by, cls } from '../core/util.js';
import { completeTask, reopenTask } from './actions.js';

const REPEATS = [['none', 'Never'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']];
const PRIOS = [['1', 'Low'], ['2', 'Medium'], ['3', 'High']];

function TaskEditor({ task, onClose }) {
  const [f, bind, set] = useForm({ title: '', note: '', dueDate: '', dueTime: '', repeat: 'none', ...task, priority: String((task && task.priority) || 1) });
  const submit = e => {
    e && e.preventDefault();
    if (!f.title.trim()) return;
    attempt(async () => {
      const anchorDay = f.dueDate ? Number(f.dueDate.slice(8)) : null;
      await save('tasks', { ...f, title: f.title.trim(), priority: Number(f.priority), anchorDay, dueTime: f.dueDate ? f.dueTime : '' });
      onClose();
    });
  };
  const del = () => confirmBox('Delete this task?') && attempt(async () => { await remove('tasks', task.id); onClose(); }, 'Task deleted');
  return html`<${Sheet} title=${task && task.id ? 'Edit task' : 'New task'} onClose=${onClose} footer=${html`
      ${task && task.id && html`<button class="btn danger" onClick=${del}>Delete</button>`}
      <button class="btn" onClick=${submit} disabled=${!f.title.trim()}>Save</button>`}>
    <form onSubmit=${submit}>
      <${Field} label="Task"><input class="inp" ...${bind('title')} placeholder="What needs doing?" autofocus /><//>
      <div class="two">
        <${Field} label="Due date"><input class="inp" type="date" ...${bind('dueDate')} /><//>
        <${Field} label="Time (optional)"><input class="inp" type="time" ...${bind('dueTime')} disabled=${!f.dueDate} /><//>
      </div>
      <div class="row-btns" style="margin:-4px 0 14px">
        <button type="button" class="btn sm plain" onClick=${() => set('dueDate', today())}>Today</button>
        <button type="button" class="btn sm plain" onClick=${() => set('dueDate', addDays(today(), 1))}>Tomorrow</button>
        <button type="button" class="btn sm plain" onClick=${() => { set('dueDate', ''); set('repeat', 'none'); }}>No date</button>
      </div>
      ${f.dueDate && html`<${Field} group label="Repeat"><${Chips} options=${REPEATS} value=${f.repeat} onChange=${v => set('repeat', v)} /><//>`}
      <${Field} group label="Priority"><${Seg} options=${PRIOS} value=${f.priority} onChange=${v => set('priority', v)} /><//>
      <${Field} label="Note"><textarea class="inp" ...${bind('note')} placeholder="Details, links, numbers…"></textarea><//>
    </form>
  <//>`;
}

function TaskRow({ t, onOpen }) {
  const days = t.dueDate ? diffDays(today(), t.dueDate) : null;
  const meta = [
    t.dueDate ? (days === 0 ? 'Today' : days < 0 ? rel(days) : `${fmt(t.dueDate)} · ${rel(days)}`) : '',
    t.dueTime ? timeLabel(t.dueTime) : '',
    t.repeat && t.repeat !== 'none' ? '↻ ' + t.repeat : '',
    t.note ? '📝' : ''
  ].filter(Boolean).join(' · ');
  return html`<div class="item">
    <button class=${cls('check', t.doneAt && 'on', !t.doneAt && t.priority > 1 && 'prio-' + t.priority)} aria-label=${t.doneAt ? 'Mark not done' : 'Complete'}
      onClick=${() => (t.doneAt ? reopenTask(t) : completeTask(t))}>${t.doneAt && html`<${Icon} name="check" />`}</button>
    <button class="grow" style="background:none;border:0;padding:0;text-align:left;cursor:pointer" onClick=${() => onOpen(t)}>
      <div class=${cls('t', t.doneAt && 'done-t')}>${t.title}</div>
      ${meta && html`<div class=${cls('s', days !== null && days < 0 && !t.doneAt && 'err')} style="margin:0">${meta}</div>`}
    </button>
  </div>`;
}

export function Tasks() {
  const S = useStore();
  const [tab, setTab] = useState('today');
  const [edit, setEdit] = useState(null);
  const [quick, setQuick] = useState('');
  const t = today();

  useEffect(() => {
    const id = routeParam('open');
    if (id) { const task = S.items.tasks.find(x => x.id === id); if (task) setEdit(task); clearParam(); }
    else if (routeParam('add')) { setEdit({ dueDate: today() }); clearParam(); }
  }, []);

  const open = S.items.tasks.filter(x => !x.doneAt);
  const lists = {
    today: open.filter(x => x.dueDate && x.dueDate <= t).sort(by(x => x.dueDate + (x.dueTime || '99') + (9 - (x.priority || 1)))),
    upcoming: open.filter(x => x.dueDate && x.dueDate > t).sort(by(x => x.dueDate + (x.dueTime || '99'))),
    anytime: open.filter(x => !x.dueDate).sort(by(x => -(x.priority || 1) * 1e13 - x.updatedAt)),
    done: S.items.tasks.filter(x => x.doneAt).sort(by(x => x.doneAt, -1)).slice(0, 50)
  };
  const list = lists[tab];

  const add = e => {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    const dueDate = tab === 'today' ? t : tab === 'upcoming' ? addDays(t, 1) : '';
    attempt(async () => { await save('tasks', { title, dueDate, dueTime: '', repeat: 'none', priority: 1, note: '', anchorDay: dueDate ? Number(dueDate.slice(8)) : null }); setQuick(''); });
  };

  return html`<div>
    <${Header} title="To-dos" />
    <main class="wrap">
      <${Seg} options=${[['today', `Today${lists.today.length ? ' ' + lists.today.length : ''}`], ['upcoming', 'Upcoming'], ['anytime', 'Anytime'], ['done', 'Done']]} value=${tab} onChange=${setTab} />
      ${tab !== 'done' && html`<form class="quick" onSubmit=${add}>
        <input class="inp" value=${quick} onInput=${e => setQuick(e.currentTarget.value)} placeholder=${tab === 'today' ? 'Add a task for today…' : tab === 'upcoming' ? 'Add a task for tomorrow…' : 'Add a task, no date…'} aria-label="Quick add task" />
        <button class="icon-btn filled" style="width:46px;height:46px;border-radius:12px" aria-label="Add" type="submit"><${Icon} name="plus" /></button>
      </form>`}
      <${Section}>
        ${list.length ? html`<div class="card list">${list.map(x => html`<${TaskRow} key=${x.id} t=${x} onOpen=${setEdit} />`)}</div>`
          : html`<div class="card"><${Empty} mood=${tab === 'done' ? 'sleepy' : 'happy'} title=${tab === 'done' ? 'Nothing done yet' : tab === 'today' ? 'Free day!' : 'Nothing here'} text=${tab === 'today' ? 'Type above to add a task for today.' : ''} /></div>`}
      <//>
    </main>
    <${Fab} label="New task" onClick=${() => setEdit({ dueDate: tab === 'today' ? t : '' })} />
    ${edit && html`<${TaskEditor} task=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}
