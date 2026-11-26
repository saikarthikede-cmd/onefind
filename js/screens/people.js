// Birthdays & anniversaries.
import { html, useState, useEffect, useStore, useForm, Header, Section, Icon, Sheet, Field, Toggle, Empty, Fab, routeParam, clearParam, attempt, confirmBox, toast } from '../ui/kit.js';
import { save, remove, state } from '../core/store.js';
import { nextAnnual, fmtMMDD, rel, today } from '../core/dates.js';
import { by, norm } from '../core/util.js';

const RELATIONS = ['Family', 'Friend', 'Partner', 'Colleague', 'Other'];

function PersonEditor({ person, onClose }) {
  const p = person || {};
  const [f, bind, set] = useForm({
    name: p.name || '', relation: p.relation || '', phone: p.phone || '', notes: p.notes || '',
    gifts: (p.giftIdeas || []).join('\n'),
    bdate: p.birthday ? `${p.birthYear || 2000}-${p.birthday}` : '', byear: !!(p.birthday && !p.birthYear),
    adate: p.anniversary ? `${p.anniversaryYear || 2000}-${p.anniversary}` : '', ayear: !!(p.anniversary && !p.anniversaryYear)
  });
  const valid = f.name.trim() && f.bdate;
  const submit = e => {
    e && e.preventDefault();
    if (!valid) return;
    attempt(async () => {
      await save('people', {
        id: p.id, name: f.name.trim(), relation: f.relation, phone: f.phone.trim(), notes: f.notes,
        giftIdeas: f.gifts.split('\n').map(s => s.trim()).filter(Boolean),
        birthday: f.bdate.slice(5), birthYear: f.byear ? null : Number(f.bdate.slice(0, 4)),
        anniversary: f.adate ? f.adate.slice(5) : '', anniversaryYear: f.adate && !f.ayear ? Number(f.adate.slice(0, 4)) : null
      });
      onClose();
    });
  };
  const del = () => confirmBox(`Delete ${p.name}?`) && attempt(async () => { await remove('people', p.id); onClose(); }, 'Deleted');
  return html`<${Sheet} title=${p.id ? p.name : 'Add a birthday'} onClose=${onClose} footer=${html`
      ${p.id && html`<button class="btn danger" onClick=${del}>Delete</button>`}
      <button class="btn" onClick=${submit} disabled=${!valid}>Save</button>`}>
    <form onSubmit=${submit}>
      <${Field} label="Name"><input class="inp" ...${bind('name')} placeholder="e.g. Amma, Rahul" autofocus=${!p.id} /><//>
      <${Field} label="Birthday"><input class="inp" type="date" ...${bind('bdate')} /><//>
      <${Toggle} label="I don't know the year" checked=${f.byear} onChange=${v => set('byear', v)} />
      <${Field} label="Relation">
        <select class="inp" aria-label="Relation" ...${bind('relation')}><option value="">—</option>${RELATIONS.map(r => html`<option value=${r}>${r}</option>`)}</select><//>
      <${Field} label="Phone (optional)"><input class="inp" type="tel" ...${bind('phone')} /><//>
      <${Field} label="Anniversary (optional)"><input class="inp" type="date" ...${bind('adate')} /><//>
      ${f.adate && html`<${Toggle} label="I don't know the anniversary year" checked=${f.ayear} onChange=${v => set('ayear', v)} />`}
      <${Field} label="Gift ideas" hint="One per line."><textarea class="inp" ...${bind('gifts')}></textarea><//>
      <${Field} label="Notes"><textarea class="inp" ...${bind('notes')}></textarea><//>
      ${p.phone && html`<a class="btn plain block" href=${'tel:' + p.phone.replace(/[^0-9+]/g, '')}><${Icon} name="phone" /> Call ${p.name}</a>`}
    </form>
  <//>`;
}

function parseVcf(text) {
  const out = [];
  for (const c of text.split(/BEGIN:VCARD/i).slice(1)) {
    const u = c.replace(/\r?\n[ \t]/g, '');
    const fn = (u.match(/^FN[^:\n]*:(.*)$/mi) || [])[1];
    const bday = (u.match(/^BDAY[^:\n]*:(.*)$/mi) || [])[1];
    const tel = (u.match(/^TEL[^:\n]*:(.*)$/mi) || [])[1];
    if (!fn || !bday) continue;
    const m = bday.trim().match(/^(\d{4}|--)-?(\d{2})-?(\d{2})/);
    if (!m) continue;
    const yr = m[1] === '--' || m[1] === '1604' ? null : Number(m[1]); // Apple uses 1604 for "no year"
    out.push({ name: fn.trim().replace(/\\,/g, ','), birthday: `${m[2]}-${m[3]}`, birthYear: yr, phone: tel ? tel.trim() : '' });
  }
  return out;
}

async function importVcf(e) {
  const file = e.currentTarget.files && e.currentTarget.files[0];
  e.currentTarget.value = '';
  if (!file) return;
  const found = parseVcf(await file.text());
  const have = new Set(state.items.people.map(p => norm(p.name) + p.birthday));
  let n = 0;
  for (const p of found) {
    if (have.has(norm(p.name) + p.birthday)) continue;
    await save('people', { ...p, relation: '', notes: '', giftIdeas: [] });
    n++;
  }
  toast(found.length ? `Imported ${n} birthday${n === 1 ? '' : 's'}` : 'No birthdays found in that file');
}

export function People() {
  const S = useStore();
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = routeParam('open');
    if (id) { const p = S.items.people.find(x => x.id === id); if (p) setEdit(p); clearParam(); }
    else if (routeParam('add')) { setEdit({}); clearParam(); }
  }, []);
  const t = today();
  const rows = S.items.people
    .filter(p => !q || norm(p.name).includes(norm(q)) || norm(p.relation).includes(norm(q)))
    .map(p => ({ p, n: nextAnnual(p.birthday, t) }))
    .sort(by(x => x.n.days));

  return html`<div>
    <${Header} title="Birthdays" right=${html`
      <label class="icon-btn" aria-label="Import contacts (.vcf)" title="Import .vcf"><${Icon} name="upload" />
        <input type="file" accept=".vcf,text/vcard,text/x-vcard" class="hide" onChange=${importVcf} /></label>`} />
    <main class="wrap">
      ${S.items.people.length > 6 && html`<input class="inp" placeholder="Search people" value=${q} onInput=${e => setQ(e.currentTarget.value)} aria-label="Search people" />`}
      <${Section}>
        ${rows.length ? html`<div class="card list">${rows.map(({ p, n }) => {
          const age = p.birthYear ? Number(n.date.slice(0, 4)) - p.birthYear : null;
          return html`<button class="item" key=${p.id} onClick=${() => setEdit(p)}>
            <span class="ico-circle people"><${Icon} name=${n.days === 0 ? 'party' : 'people'} /></span>
            <div class="grow"><div class="t">${p.name}</div>
              <div class="s">${fmtMMDD(p.birthday)}${age ? ` · turns ${age}` : ''}${p.relation ? ' · ' + p.relation : ''}</div></div>
            <div class=${n.days <= 7 ? 'r strong' : 'r'}>${n.days === 0 ? 'Today 🎉' : rel(n.days)}</div>
          </button>`;
        })}</div>` : html`<div class="card"><${Empty} icon="people" title=${q ? 'No match' : 'No birthdays yet'}
            text=${q ? '' : 'Add the people you never want to forget. You can also import a .vcf contacts file with the button at the top.'}
            action=${q ? '' : 'Add a birthday'} onAction=${() => setEdit({})} /></div>`}
      <//>
    </main>
    <${Fab} label="Add birthday" onClick=${() => setEdit({})} />
    ${edit && html`<${PersonEditor} person=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}
