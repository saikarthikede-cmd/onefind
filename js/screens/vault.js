// Vault: sensitive details behind a second passphrase. Auto-locks after 2 minutes.
import { html, useState, useEffect, useStore, useForm, Header, Section, Icon, Sheet, Field, Chips, Empty, Fab, attempt, confirmBox, toast, errMsg } from '../ui/kit.js';
import { openVault, lockVault, touchVault, saveVaultItem, remove } from '../core/store.js';
import { vaultExists, vaultSetup, vaultUnlock, vaultRecover } from '../core/keys.js';
import { by } from '../core/util.js';

export const TEMPLATES = {
  aadhaar: { name: 'Aadhaar', fields: ['Aadhaar number', 'Name on card', 'Date of birth', 'Address'] },
  pan: { name: 'PAN card', fields: ['PAN', 'Name on card', 'Date of birth'] },
  passport: { name: 'Passport', fields: ['Passport number', 'Name', 'Issue date', 'Expiry date', 'Place of issue'] },
  licence: { name: 'Driving licence', fields: ['Licence number', 'Valid until', 'RTO'] },
  bank: { name: 'Bank account', fields: ['Bank', 'Account holder', 'Account number', 'IFSC', 'Branch', 'Customer ID', 'UPI ID'] },
  card: { name: 'Card details', fields: ['Bank', 'Card name', 'Last 4 digits', 'Expiry (MM/YY)', 'Customer care number'] },
  insurance: { name: 'Insurance policy', fields: ['Insurer', 'Policy number', 'Type', 'Sum assured', 'Premium', 'Renewal date', 'Nominee', 'Agent contact'] },
  warranty: { name: 'Warranty', fields: ['Product', 'Brand', 'Purchase date', 'Warranty until', 'Invoice number', 'Store', 'Service centre'] },
  wifi: { name: 'Wi-Fi', fields: ['Network name', 'Password'] },
  login: { name: 'Login', fields: ['Website or app', 'Username', 'Password'] },
  other: { name: 'Other', fields: ['Detail'] }
};
const MIN = 8;

function VaultEditor({ item, onClose }) {
  const it = item || {};
  const [tpl, setTpl] = useState(it.template || '');
  const [label, setLabel] = useState(it.label || '');
  const [fields, setFields] = useState(it.fields || []);
  const [notes, setNotes] = useState(it.notes || '');
  const pick = k => { setTpl(k); setLabel(TEMPLATES[k].name); setFields(TEMPLATES[k].fields.map(f => ({ k: f, v: '' }))); };
  const setF = (i, key, v) => { touchVault(); setFields(fields.map((x, j) => (j === i ? { ...x, [key]: v } : x))); };
  const submit = () => attempt(async () => {
    await saveVaultItem({ ...it, template: tpl, label: label.trim() || TEMPLATES[tpl].name, fields: fields.filter(x => x.k.trim() || x.v.trim()), notes });
    onClose();
  }, 'Saved to vault');
  if (!tpl) {
    return html`<${Sheet} title="What do you want to store?" onClose=${onClose}>
      <div class="grid">${Object.keys(TEMPLATES).map(k => html`<button class="tile" onClick=${() => pick(k)}><span class="ico-circle vault"><${Icon} name="vault" /></span>${TEMPLATES[k].name}</button>`)}</div>
      <p class="small muted mt">Never store card CVVs, ATM PINs or OTPs anywhere — including here.</p>
    <//>`;
  }
  return html`<${Sheet} title=${it.id ? 'Edit' : 'New ' + TEMPLATES[tpl].name} onClose=${onClose} footer=${html`<button class="btn" onClick=${submit}>Save</button>`}>
    <${Field} label="Label"><input class="inp" value=${label} onInput=${e => setLabel(e.currentTarget.value)} placeholder="e.g. My PAN, Amma's passport" /><//>
    ${fields.map((x, i) => html`<div class="field" key=${i}>
      <input class="inp" style="border:0;background:none;padding:0 2px;min-height:0;font-size:13px;color:var(--text2);margin-bottom:6px" value=${x.k} onInput=${e => setF(i, 'k', e.currentTarget.value)} aria-label="Field name" />
      <div style="display:flex;gap:6px"><input class="inp" value=${x.v} onInput=${e => setF(i, 'v', e.currentTarget.value)} autocomplete="off" autocapitalize="off" spellcheck="false" aria-label=${x.k} />
      <button type="button" class="icon-btn muted" aria-label="Remove field" onClick=${() => setFields(fields.filter((y, j) => j !== i))}><${Icon} name="x" /></button></div>
    </div>`)}
    <button type="button" class="btn sm plain" onClick=${() => setFields([...fields, { k: 'New field', v: '' }])}><${Icon} name="plus" /> Add field</button>
    <${Field} label="Notes"><textarea class="inp mt-s" value=${notes} onInput=${e => setNotes(e.currentTarget.value)}></textarea><//>
  <//>`;
}

function VaultView({ item, onClose, onEdit }) {
  const [shown, setShown] = useState({});
  const copy = async v => {
    touchVault();
    try {
      await navigator.clipboard.writeText(v);
      toast('Copied. Paste it, then clear your clipboard.');
      setTimeout(() => { navigator.clipboard.writeText(' ').catch(() => {}); }, 30000);
    } catch (e) { toast('Copy is not available — tap the eye to read it'); }
  };
  const del = () => confirmBox(`Delete ${item.label} from the vault?`) && attempt(async () => { await remove('vault', item.id); onClose(); }, 'Deleted');
  return html`<${Sheet} title=${item.label} onClose=${onClose} footer=${html`
      <button class="btn danger" onClick=${del}>Delete</button><button class="btn plain" onClick=${onEdit}>Edit</button>`}>
    <div class="card list">${(item.fields || []).map((x, i) => html`<div class="kv" key=${i}>
      <div class="grow"><div class="k">${x.k}</div><div class="v">${shown[i] ? x.v || '—' : x.v ? '••••••••' : '—'}</div></div>
      ${x.v && html`<button class="icon-btn muted" aria-label=${shown[i] ? 'Hide' : 'Show'} onClick=${() => { touchVault(); setShown({ ...shown, [i]: !shown[i] }); }}><${Icon} name=${shown[i] ? 'eyeoff' : 'eye'} /></button>`}
      ${x.v && html`<button class="icon-btn" aria-label=${'Copy ' + x.k} onClick=${() => copy(x.v)}><${Icon} name="copy" /></button>`}
    </div>`)}</div>
    ${item.notes && html`<p class="mt" style="white-space:pre-wrap">${item.notes}</p>`}
  <//>`;
}

function VaultGate({ exists, onReady }) {
  const [mode, setMode] = useState(exists ? 'unlock' : 'setup');
  const [f, bind, , setF] = useForm({ p: '', p2: '', rk: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (e, fn) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await openVault(await fn()); onReady(); } catch (ex) { setErr(errMsg(ex)); setF(s => ({ ...s, p: mode === 'unlock' ? '' : s.p })); }
    setBusy(false);
  };
  const checkNew = () => { if (f.p.length < MIN) throw new Error(`Use at least ${MIN} characters.`); if (f.p !== f.p2) throw new Error("The passphrases don't match."); };
  return html`<div class="card" style="padding:18px">
    ${mode === 'setup' && html`<form onSubmit=${e => run(e, async () => { checkNew(); return vaultSetup(f.p); })}>
      <h3 style="margin-top:0">Create a vault passphrase</h3>
      <p class="small muted">Use something different from your app passcode. Your recovery key can reset it if you forget.</p>
      <${Field} label="Vault passphrase"><input class="inp" type="password" autocomplete="new-password" ...${bind('p')} /><//>
      <${Field} label="Type it again"><input class="inp" type="password" autocomplete="new-password" ...${bind('p2')} /><//>
      ${err && html`<p class="err">${err}</p>`}
      <button class="btn block" disabled=${busy}>${busy ? 'Creating…' : 'Create vault'}</button></form>`}
    ${mode === 'unlock' && html`<form onSubmit=${e => run(e, () => vaultUnlock(f.p))}>
      <h3 style="margin-top:0">Vault is locked</h3>
      <${Field} label="Vault passphrase"><input class="inp" type="password" autocomplete="current-password" ...${bind('p')} autofocus /><//>
      ${err && html`<p class="err">${err}</p>`}
      <button class="btn block" disabled=${busy || !f.p}>${busy ? 'Opening…' : 'Open vault'}</button>
      <button type="button" class="btn plain block mt-s" onClick=${() => { setMode('recover'); setErr(''); }}>Forgot? Use recovery key</button></form>`}
    ${mode === 'recover' && html`<form onSubmit=${e => run(e, async () => { checkNew(); return vaultRecover(f.rk, f.p); })}>
      <h3 style="margin-top:0">Reset vault passphrase</h3>
      <${Field} label="Recovery key"><input class="inp" autocapitalize="characters" autocomplete="off" ...${bind('rk')} /><//>
      <${Field} label="New vault passphrase"><input class="inp" type="password" autocomplete="new-password" ...${bind('p')} /><//>
      <${Field} label="Type it again"><input class="inp" type="password" autocomplete="new-password" ...${bind('p2')} /><//>
      ${err && html`<p class="err">${err}</p>`}
      <button class="btn block" disabled=${busy}>${busy ? 'Checking…' : 'Reset and open'}</button>
      <button type="button" class="btn plain block mt-s" onClick=${() => { setMode('unlock'); setErr(''); }}>Back</button></form>`}
  </div>`;
}

export function Vault() {
  const S = useStore();
  const [exists, setExists] = useState(null);
  const [view, setView] = useState(null);
  const [edit, setEdit] = useState(null);
  useEffect(() => { vaultExists().then(setExists); }, [S.vk]);
  const open = !!S.vk && !!S.vault;
  const items = open ? S.vault.slice().sort(by(x => (x.label || '').toLowerCase())) : [];
  return html`<div onClick=${() => open && touchVault()}>
    <${Header} title="Vault" back="more" right=${open && html`<button class="icon-btn" aria-label="Lock vault" onClick=${lockVault}><${Icon} name="lock" /></button>`} />
    <main class="wrap">
      ${exists === null ? null : !open ? html`<${VaultGate} exists=${exists} onReady=${() => setExists(true)} />` : html`
        <p class="small muted" style="margin:0 4px">Locks automatically after 2 minutes. Not included in search or calendar exports.</p>
        <${Section}>${items.length ? html`<div class="card list">${items.map(x => html`
          <button class="item" key=${x.id} onClick=${() => setView(x)}>
            <span class="ico-circle vault"><${Icon} name="vault" /></span>
            <div class="grow"><div class="t">${x.label}</div><div class="s">${(TEMPLATES[x.template] || TEMPLATES.other).name} · ${(x.fields || []).length} fields</div></div>
            <${Icon} name="next" />
          </button>`)}</div>` : html`<div class="card"><${Empty} icon="vault" title="Vault is empty" text="Store ID numbers, policy details, account numbers and warranties." action="Add something" onAction=${() => setEdit({})} /></div>`}<//>
      `}
    </main>
    ${open && html`<${Fab} label="Add to vault" onClick=${() => setEdit({})} />`}
    ${view && open && html`<${VaultView} item=${view} onClose=${() => setView(null)} onEdit=${() => { setEdit(view); setView(null); }} />`}
    ${edit && open && html`<${VaultEditor} item=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}
