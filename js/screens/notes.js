// Notes & lists: important info, checklists (grocery, packing), pin to Today.
import { html, useState, useEffect, useStore, useForm, Header, Section, Icon, Sheet, Field, Toggle, Empty, Fab, routeParam, clearParam, attempt, confirmBox } from '../ui/kit.js';
import { save, remove } from '../core/store.js';
import { by, norm, cls } from '../core/util.js';

function NoteEditor({ note, onClose }) {
  const n = note || {};
  const [f, bind, set] = useForm({ title: n.title || '', body: n.body || '', tags: (n.tags || []).join(', '), pinned: !!n.pinned });
  const [items, setItems] = useState(n.checklist || []);
  const [nw, setNw] = useState('');
  const valid = f.title.trim() || f.body.trim() || items.length;
  const addItem = e => { e && e.preventDefault(); if (!nw.trim()) return; setItems([...items, { t: nw.trim(), done: false }]); setNw(''); };
  const submit = () => {
    if (!valid) return onClose();
    const data = { title: f.title.trim(), body: f.body, pinned: f.pinned, checklist: items, tags: f.tags.split(',').map(s => s.trim()).filter(Boolean) };
    const before = { title: (n.title || '').trim(), body: n.body || '', pinned: !!n.pinned, checklist: n.checklist || [], tags: n.tags || [] };
    if (n.id && JSON.stringify(data) === JSON.stringify(before)) return onClose(); // nothing changed
    attempt(async () => { await save('notes', { ...n, ...data }); onClose(); });
  };
  const del = () => confirmBox('Delete this note?') && attempt(async () => { await remove('notes', n.id); onClose(); }, 'Deleted');
  return html`<${Sheet} title=${n.id ? 'Edit note' : 'New note'} onClose=${submit} footer=${html`
      ${n.id && html`<button class="btn danger" onClick=${del}>Delete</button>`}
      <button class="btn" onClick=${submit}>Done</button>`}>
    <${Field} label="Title"><input class="inp" ...${bind('title')} placeholder="e.g. Grocery list, Wi-Fi at home, Doctor's advice" autofocus=${!n.id} /><//>
    <${Field} label="Note"><textarea class="inp" ...${bind('body')} rows="5"></textarea><//>
    <${Field} group label="Checklist">
      <div class="card" style="padding:0 12px">
        ${items.map((it, i) => html`<div class="cl" key=${i}>
          <button type="button" class=${cls('check', it.done && 'on')} aria-label="Toggle item"
            onClick=${() => setItems(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}>${it.done && html`<${Icon} name="check" />`}</button>
          <span class=${cls('grow', it.done && 'done-t')}>${it.t}</span>
          <button type="button" class="icon-btn muted" aria-label="Remove item" onClick=${() => setItems(items.filter((x, j) => j !== i))}><${Icon} name="x" /></button>
        </div>`)}
        <form class="cl" onSubmit=${addItem}>
          <input class="inp" style="border:0;padding:8px 0;min-height:40px" value=${nw} onInput=${e => setNw(e.currentTarget.value)} placeholder="Add an item…" aria-label="New checklist item" />
          <button class="icon-btn" aria-label="Add item" type="submit"><${Icon} name="plus" /></button>
        </form>
      </div>
      ${items.some(x => x.done) && html`<button type="button" class="btn sm plain mt-s" onClick=${() => setItems(items.map(x => ({ ...x, done: false })))}>Untick all (reuse list)</button>`}
    <//>
    <${Field} label="Tags" hint="Comma separated, e.g. home, health"><input class="inp" ...${bind('tags')} /><//>
    <${Toggle} label="Pin to Today" checked=${f.pinned} onChange=${v => set('pinned', v)} />
  <//>`;
}

export function Notes() {
  const S = useStore();
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = routeParam('open');
    if (id) { const n = S.items.notes.find(x => x.id === id); if (n) setEdit(n); clearParam(); }
    else if (routeParam('add')) { setEdit({}); clearParam(); }
  }, []);
  const notes = S.items.notes
    .filter(n => !q || [n.title, n.body, (n.tags || []).join(' '), (n.checklist || []).map(c => c.t).join(' ')].some(s => norm(s).includes(norm(q))))
    .sort(by(n => (n.pinned ? 1 : 0) * 1e14 + n.updatedAt, -1));
  return html`<div>
    <${Header} title="Notes & lists" back="more" />
    <main class="wrap">
      ${S.items.notes.length > 4 && html`<input class="inp" placeholder="Search notes" value=${q} onInput=${e => setQ(e.currentTarget.value)} aria-label="Search notes" />`}
      <${Section}>
        ${notes.length ? html`<div class="card list">${notes.map(n => {
          const left = (n.checklist || []).filter(c => !c.done).length;
          return html`<button class="item" key=${n.id} onClick=${() => setEdit(n)}>
            <span class="ico-circle notes"><${Icon} name=${n.pinned ? 'pin' : 'notes'} /></span>
            <div class="grow"><div class="t">${n.title || (n.body || '').split('\n')[0] || 'Untitled'}</div>
              <div class="s">${(n.checklist || []).length ? `${left} of ${n.checklist.length} left` : (n.body || '').replace(/\n/g, ' ').slice(0, 90)}${(n.tags || []).length ? ' · #' + n.tags.join(' #') : ''}</div></div>
          </button>`;
        })}</div>` : html`<div class="card"><${Empty} icon="notes" title=${q ? 'No match' : 'No notes yet'} text=${q ? '' : 'Keep checklists and important info here. Pin a note to see it on Today.'} action=${q ? '' : 'New note'} onAction=${() => setEdit({})} /></div>`}
      <//>
    </main>
    <${Fab} label="New note" onClick=${() => setEdit({})} />
    ${edit && html`<${NoteEditor} note=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}
