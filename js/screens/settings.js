// Settings: security, backup, calendar reminders, money, appearance, help, erase.
import { html, useState, useEffect, useStore, useForm, Header, Section, Icon, Sheet, Field, Seg, Toggle, go, routeParam, clearParam, attempt, toast, errMsg } from '../ui/kit.js';
import { prefs, savePrefs, setUI, state } from '../core/store.js';
import { changePasscode, regenerateRecovery, vaultExists } from '../core/keys.js';
import { makeBackup, readBackup, sameFamily, mergeBackup, checkBackupPasscode, replaceWithBackup } from '../core/backup.js';
import { buildICS } from '../core/ics.js';
import { clearAll } from '../core/db.js';
import { shareOrDownload, lsSet } from '../core/util.js';
import { today } from '../core/dates.js';
import { lockNow } from './actions.js';
import { InstallGuide } from './gate.js';

export const VERSION = '1.1.0';
const MIN = 6;

export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t || 'auto');
  lsSet('theme', t || 'auto');
}

function PasscodeSheet({ onClose }) {
  const [f, bind] = useForm({ o: '', n1: '', n2: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e && e.preventDefault(); setErr('');
    if (f.n1.length < MIN) return setErr(`Use at least ${MIN} characters.`);
    if (f.n1 !== f.n2) return setErr('The new passcodes do not match.');
    setBusy(true);
    try { await changePasscode(f.o, f.n1); toast('Passcode changed'); onClose(); } catch (ex) { setErr(errMsg(ex)); }
    setBusy(false);
  };
  return html`<${Sheet} title="Change passcode" onClose=${onClose} footer=${html`<button class="btn" onClick=${submit} disabled=${busy}>${busy ? 'Saving…' : 'Change'}</button>`}>
    <form onSubmit=${submit}>
      <${Field} label="Current passcode"><input class="inp" type="password" autocomplete="current-password" ...${bind('o')} /><//>
      <${Field} label="New passcode"><input class="inp" type="password" autocomplete="new-password" ...${bind('n1')} /><//>
      <${Field} label="Type it again"><input class="inp" type="password" autocomplete="new-password" ...${bind('n2')} /><//>
      ${err && html`<p class="err">${err}</p>`}
      <p class="small muted">Older backups still open with the passcode that was set when they were made.</p>
    </form><//>`;
}

function RecoverySheet({ onClose }) {
  const [f, bind] = useForm({ p: '', v: '' });
  const [hasVault, setHasVault] = useState(false);
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { vaultExists().then(setHasVault); }, []);
  const submit = async e => {
    e && e.preventDefault(); setErr(''); setBusy(true);
    try { setKey(await regenerateRecovery(f.p, f.v)); } catch (ex) { setErr(errMsg(ex)); }
    setBusy(false);
  };
  return html`<${Sheet} title="New recovery key" onClose=${onClose} footer=${key ? html`<button class="btn" onClick=${onClose}>I've written it down</button>` : html`<button class="btn" onClick=${submit} disabled=${busy || !f.p}>${busy ? 'Creating…' : 'Create new key'}</button>`}>
    ${key ? html`<p>Your old recovery key no longer works on this phone. Write this one down:</p><div class="reckey" aria-label="Recovery key">${key.split('-').map((g, i, a) => html`<span>${g}${i < a.length - 1 ? '-' : ''}</span>`)}</div>`
      : html`<form onSubmit=${submit}>
        <p class="small muted">Use this if you lost your recovery key. The old key stops working on this phone.</p>
        <${Field} label="Passcode"><input class="inp" type="password" ...${bind('p')} /><//>
        ${hasVault && html`<${Field} label="Vault passphrase"><input class="inp" type="password" ...${bind('v')} /><//>`}
        ${err && html`<p class="err">${err}</p>`}
      </form>`}
  <//>`;
}

function BackupSheet({ onClose }) {
  const S = useStore();
  const [busy, setBusy] = useState(false);
  const [bk, setBk] = useState(null);
  const [fam, setFam] = useState(false);
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const last = S.ui.lastBackupAt ? new Date(S.ui.lastBackupAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'never';

  const doExport = async () => {
    setBusy(true);
    try {
      const blob = await makeBackup();
      const r = await shareOrDownload(blob, `onefind-backup-${today()}.onefind`, 'One Find backup');
      if (r !== 'cancelled') { await setUI({ lastBackupAt: Date.now() }); toast('Backup saved'); }
    } catch (ex) { toast(errMsg(ex)); }
    setBusy(false);
  };
  const pick = async e => {
    setErr('');
    const file = e.currentTarget.files && e.currentTarget.files[0];
    e.currentTarget.value = '';
    if (!file) return;
    try { const obj = await readBackup(file); setBk(obj); setFam(await sameFamily(obj)); } catch (ex) { setErr(errMsg(ex)); }
  };
  const merge = async () => {
    setBusy(true);
    try {
      const r = await mergeBackup(bk);
      toast(`Merged: ${r.added} added, ${r.updated} updated${r.skipped ? `, ${r.skipped} skipped` : ''}`);
      if (r.vaultClash) toast('Vault items were skipped: each phone has its own vault.');
      onClose();
    } catch (ex) { setErr(errMsg(ex)); }
    setBusy(false);
  };
  const replace = async () => {
    setErr('');
    if (!window.confirm('Replace ALL data on this phone with this backup? This cannot be undone.')) return;
    setBusy(true);
    try {
      if (!(await checkBackupPasscode(bk, pass))) throw new Error("That isn't the passcode for this backup.");
      await replaceWithBackup(bk);
      toast('Restored. Unlock with the backup\'s passcode.');
      lockNow();
    } catch (ex) { setErr(errMsg(ex)); setBusy(false); }
  };

  return html`<${Sheet} title="Backup & move data" onClose=${onClose}>
    <div class="card" style="padding:14px">
      <b>Back up</b>
      <p class="small muted" style="margin:4px 0 12px">Creates one encrypted file. Save it to Files or iCloud Drive, or AirDrop it to your other phone. Last backup: ${last}.</p>
      <button class="btn block" onClick=${doExport} disabled=${busy}><${Icon} name="upload" /> Back up now</button>
    </div>
    <div class="card mt" style="padding:14px">
      <b>Restore or merge</b>
      <p class="small muted" style="margin:4px 0 12px">To use both phones: set up phone 1, back up, then on phone 2 choose “Restore from a backup file” at setup. After that, merge backups either way and the newest change wins.</p>
      <label class="btn plain block"><${Icon} name="download" /> Choose backup file<input type="file" class="hide" onChange=${pick} /></label>
      ${bk && html`<p class="small mt-s">Backup from <b>${new Date(bk.createdAt).toLocaleString('en-IN')}</b>.</p>
        ${fam ? html`<button class="btn block mt-s" onClick=${merge} disabled=${busy}>Merge into this phone</button>`
          : html`<p class="small muted">This backup came from a phone set up separately, so it can only replace this phone's data.</p>`}
        <details class="mt-s"><summary class="small">Replace everything instead</summary>
          <${Field} label="Passcode for that backup"><input class="inp mt-s" type="password" value=${pass} onInput=${e => setPass(e.currentTarget.value)} /><//>
          <button class="btn danger block" onClick=${replace} disabled=${busy || !pass}>Replace all data on this phone</button>
        </details>`}
      ${err && html`<p class="err mt-s">${err}</p>`}
    </div>
  <//>`;
}

function CalendarSheet({ onClose }) {
  const S = useStore();
  const p = prefs();
  const [inc, setInc] = useState({ birthdays: true, bills: true, tasks: true, nudge: !!p.dailyNudge });
  const { text, count } = buildICS({ people: S.items.people, tasks: S.items.tasks, bills: S.items.bills, prefs: p, include: inc });
  const blob = () => new Blob([text], { type: 'text/calendar' });
  const done = () => setUI({ lastIcsAt: Date.now(), icsDirty: 0 });
  const share = async () => { const r = await shareOrDownload(blob(), 'one-find-reminders.ics', 'One Find reminders'); if (r !== 'cancelled') done(); };
  const openCal = () => {
    const url = URL.createObjectURL(blob());
    const w = window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    if (!w) return share(); // pop-up blocked: fall back to the share sheet
    done();
  };
  const tog = k => v => setInc({ ...inc, [k]: v });
  return html`<${Sheet} title="Calendar reminders" onClose=${onClose}>
    <p class="small muted" style="margin-top:0">iPhones can't let a web app ring alarms by itself, so One Find puts your reminders into the iPhone Calendar. Calendar then alerts you on both phones — free and offline.</p>
    <${Toggle} label="Birthdays & anniversaries" checked=${inc.birthdays} onChange=${tog('birthdays')} />
    <${Toggle} label="Bills (day before + due day)" checked=${inc.bills} onChange=${tog('bills')} />
    <${Toggle} label="To-dos with a date" checked=${inc.tasks} onChange=${tog('tasks')} />
    <${Toggle} label="Daily 8 AM nudge to open One Find" checked=${inc.nudge} onChange=${v => { tog('nudge')(v); savePrefs({ dailyNudge: v }); }} />
    <${Field} label="Alert time for all-day reminders">
      <select class="inp" aria-label="Alert time" value=${String(p.alertHour)} onChange=${e => savePrefs({ alertHour: Number(e.currentTarget.value) })}>
        ${[6, 7, 8, 9, 10, 11, 12, 18, 20].map(h => html`<option value=${String(h)}>${h <= 12 ? h + (h === 12 ? ' PM' : ' AM') : h - 12 + ' PM'}</option>`)}
      </select><//>
    <div class="row-btns"><button class="btn" onClick=${openCal} disabled=${!count}><${Icon} name="calendar" /> Add to Calendar</button>
      <button class="btn plain" onClick=${share} disabled=${!count}><${Icon} name="share" /> Save / share file</button></div>
    <p class="small center muted">${count} reminder${count === 1 ? '' : 's'} ready.</p>
    <ol class="small" style="padding-left:20px;line-height:1.55">
      <li>Once: in the Calendar app, tap <b>Calendars → Add Calendar</b> and name it <b>One Find</b>.</li>
      <li>Tap <b>Add to Calendar</b> above, then <b>Add All</b> and pick the One Find calendar.</li>
      <li>If nothing opens, use <b>Save / share file</b> → Save to Files, then tap the file in the Files app (or AirDrop / mail it to yourself and tap it).</li>
      <li>After big changes, delete the One Find calendar, recreate it and import again — this avoids duplicate alerts.</li>
    </ol>
  <//>`;
}

function CategoriesSheet({ onClose }) {
  const p = prefs();
  const [ex, setEx] = useState(p.expenseCats.join('\n'));
  const [inc, setInc] = useState(p.incomeCats.join('\n'));
  const clean = s => Array.from(new Set(s.split('\n').map(x => x.trim()).filter(Boolean)));
  const submit = () => attempt(async () => { await savePrefs({ expenseCats: clean(ex), incomeCats: clean(inc) }); onClose(); }, 'Categories saved');
  return html`<${Sheet} title="Money categories" onClose=${onClose} footer=${html`<button class="btn" onClick=${submit}>Save</button>`}>
    <${Field} label="Expense categories" hint="One per line."><textarea class="inp" rows="10" value=${ex} onInput=${e => setEx(e.currentTarget.value)}></textarea><//>
    <${Field} label="Income categories"><textarea class="inp" rows="5" value=${inc} onInput=${e => setInc(e.currentTarget.value)}></textarea><//>
  <//>`;
}

async function eraseAll() {
  const typed = window.prompt('This deletes ALL One Find data on this phone. Type ERASE to confirm.');
  if (typed !== 'ERASE') return;
  await clearAll();
  try { localStorage.clear(); } catch (e) { /* ignore */ }
  location.replace(location.pathname);
}

const Row = ({ icon, title, sub, onClick, right, tone }) => html`
  <button class="item" onClick=${onClick}><span class=${'ico-circle ' + (tone || 'settings')}><${Icon} name=${icon} /></span>
    <div class="grow"><div class="t">${title}</div>${sub && html`<div class="s">${sub}</div>`}</div>${right || html`<${Icon} name="next" />`}</button>`;

export function Settings() {
  const S = useStore();
  const [sheet, setSheet] = useState(null);
  useEffect(() => { const o = routeParam('open'); if (o) { setSheet(o); clearParam(); } }, []);
  const ui = S.ui;
  const ago = ts => (ts ? `${Math.max(0, Math.floor((Date.now() - ts) / 864e5))} days ago` : 'Never');
  const close = () => setSheet(null);
  return html`<div>
    <${Header} title="Settings" back="more" />
    <main class="wrap">
      <${Section} title="Security"><div class="card list">
        <${Row} icon="key" title="Change passcode" onClick=${() => setSheet('passcode')} />
        <div class="item"><span class="ico-circle settings"><${Icon} name="lock" /></span><div class="grow"><div class="t">Auto-lock</div><div class="s">When in background</div></div>
          <select class="inp" style="width:auto;min-height:36px;padding:6px 10px" value=${String(ui.lockMinutes)} onChange=${e => setUI({ lockMinutes: Number(e.currentTarget.value) })} aria-label="Auto-lock time">
            ${[[0, 'Immediately'], [1, '1 min'], [5, '5 min'], [15, '15 min'], [60, '1 hour']].map(([v, l]) => html`<option value=${String(v)}>${l}</option>`)}</select></div>
        <${Row} icon="alert" title="New recovery key" sub="If you lost the one from setup" onClick=${() => setSheet('recovery')} />
        <${Row} icon="lock" title="Lock now" onClick=${lockNow} />
      </div><//>

      <${Section} title="Backup & reminders"><div class="card list">
        <${Row} icon="upload" title="Backup & move data" sub=${'Last backup: ' + ago(ui.lastBackupAt)} onClick=${() => setSheet('backup')} />
        <${Row} icon="calendar" title="Calendar reminders" sub=${'Last export: ' + ago(ui.lastIcsAt)} onClick=${() => setSheet('calendar')} />
      </div><//>

      <${Section} title="Money"><div class="card list">
        <${Row} icon="money" title="Monthly budget" onClick=${() => go('money')} />
        <${Row} icon="edit" title="Categories" onClick=${() => setSheet('categories')} />
      </div><//>

      <${Section} title="Appearance"><div class="card" style="padding:12px 14px">
        <${Seg} options=${[['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']]} value=${ui.theme} onChange=${v => { applyTheme(v); setUI({ theme: v }); }} />
      </div><//>

      <${Section} title="Help"><div class="card list">
        <${Row} icon="download" title="Add to Home Screen" onClick=${() => setSheet('install')} />
        <${Row} icon="desk" title="Desk mode" sub="Big clock + today's list for your old iPhone" onClick=${() => go('desk')} />
      </div>
      <p class="small muted" style="margin:8px 4px">Desk mode tip: on the old phone set Settings → Display & Brightness → Auto-Lock → Never, and keep it on the charger.</p><//>

      <${Section} title="About"><div class="card" style="padding:14px">
        <b>One Find ${VERSION}</b>
        <p class="small muted" style="margin:6px 0 0">Pixel icons: Pixelarticons (MIT). Title font: Pixelify Sans (SIL OFL). Pip is an original character made for One Find.</p>
        <p class="small muted" style="margin:6px 0 0">Your data is encrypted on this phone (AES-256) with a key only your passcode can unlock. Nothing is sent to any server. No ads, no tracking, no accounts.</p>
      </div><//>

      <${Section}><button class="btn danger block" onClick=${eraseAll}>Erase all data on this phone</button><//>
    </main>
    ${sheet === 'passcode' && html`<${PasscodeSheet} onClose=${close} />`}
    ${sheet === 'recovery' && html`<${RecoverySheet} onClose=${close} />`}
    ${sheet === 'backup' && html`<${BackupSheet} onClose=${close} />`}
    ${sheet === 'calendar' && html`<${CalendarSheet} onClose=${close} />`}
    ${sheet === 'categories' && html`<${CategoriesSheet} onClose=${close} />`}
    ${sheet === 'install' && html`<${InstallGuide} onClose=${close} />`}
  </div>`;
}
