// "Where did I keep it?" — item, place, optional photo.
import { html, useState, useEffect, useStore, useForm, Header, Section, Icon, Sheet, Field, Empty, Fab, routeParam, clearParam, attempt, confirmBox, toast } from '../ui/kit.js';
import { save, remove } from '../core/store.js';
import { today, fmt } from '../core/dates.js';
import { by, norm, compressImage } from '../core/util.js';

function PlaceEditor({ place, onClose }) {
  const p = place || {};
  const [f, bind, set] = useForm({ item: p.item || '', location: p.location || '', note: p.note || '', photo: p.photo || '', date: p.date || today() });
  const [busy, setBusy] = useState(false);
  const valid = f.item.trim() && f.location.trim();
  const pick = async e => {
    const file = e.currentTarget.files && e.currentTarget.files[0];
    if (!file) return;
    setBusy(true);
    try { set('photo', await compressImage(file)); } catch (ex) { toast("Couldn't read that photo"); }
    setBusy(false);
  };
  const submit = e => {
    e && e.preventDefault();
    if (!valid) return;
    attempt(async () => { await save('places', { ...p, item: f.item.trim(), location: f.location.trim(), note: f.note, photo: f.photo, date: today() }); onClose(); }, 'Saved');
  };
  const del = () => confirmBox(`Delete ${p.item}?`) && attempt(async () => { await remove('places', p.id); onClose(); }, 'Deleted');
  return html`<${Sheet} title=${p.id ? p.item : 'Where did I keep it?'} onClose=${onClose} footer=${html`
      ${p.id && html`<button class="btn danger" onClick=${del}>Delete</button>`}
      <button class="btn" onClick=${submit} disabled=${!valid || busy}>Save</button>`}>
    <form onSubmit=${submit}>
      <${Field} label="What"><input class="inp" ...${bind('item')} placeholder="Passport, spare keys, warranty card…" autofocus=${!p.id} /><//>
      <${Field} label="Where"><input class="inp" ...${bind('location')} placeholder="Bedroom cupboard, top shelf, blue box" /><//>
      ${f.photo && html`<img class="photo" src=${f.photo} alt=${'Photo of ' + f.item} />`}
      <label class="btn plain block" style="margin-bottom:14px"><${Icon} name="camera" /> ${busy ? 'Processing…' : f.photo ? 'Change photo' : 'Add a photo'}
        <input type="file" accept="image/*" class="hide" onChange=${pick} /></label>
      ${f.photo && html`<button type="button" class="btn sm plain" style="margin:-6px 0 14px" onClick=${() => set('photo', '')}>Remove photo</button>`}
      <${Field} label="Note"><input class="inp" ...${bind('note')} /><//>
      ${p.date && html`<p class="small muted">Last updated ${fmt(p.date, true)}.</p>`}
    </form>
  <//>`;
}

export function Places() {
  const S = useStore();
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = routeParam('open');
    if (id) { const p = S.items.places.find(x => x.id === id); if (p) setEdit(p); clearParam(); }
    else if (routeParam('add')) { setEdit({}); clearParam(); }
  }, []);
  const list = S.items.places
    .filter(p => !q || norm(p.item).includes(norm(q)) || norm(p.location).includes(norm(q)) || norm(p.note).includes(norm(q)))
    .sort(by(p => p.updatedAt, -1));
  return html`<div>
    <${Header} title="Where did I keep it?" back="more" />
    <main class="wrap">
      <input class="inp" placeholder="Search: passport, keys, charger…" value=${q} onInput=${e => setQ(e.currentTarget.value)} aria-label="Search places" />
      <${Section}>
        ${list.length ? html`<div class="card list">${list.map(p => html`
          <button class="item" key=${p.id} onClick=${() => setEdit(p)}>
            ${p.photo ? html`<img class="thumb" src=${p.photo} alt="" />` : html`<span class="ico-circle places"><${Icon} name="places" /></span>`}
            <div class="grow"><div class="t">${p.item}</div><div class="s">${p.location}</div></div>
          </button>`)}</div>`
        : html`<div class="card"><${Empty} icon="places" title=${q ? 'Not found' : 'Nothing saved yet'} text=${q ? 'Try another word.' : 'Note where you put important things the moment you put them away.'} action=${q ? '' : 'Add an item'} onAction=${() => setEdit({})} /></div>`}
      <//>
    </main>
    <${Fab} label="Add item" onClick=${() => setEdit({})} />
    ${edit && html`<${PlaceEditor} place=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}
