// First-run setup, lock screen, recovery, and the install guide.
import { html, useState, useForm, Icon, Pip, Sheet, Field, errMsg, toast } from '../ui/kit.js';
import { setupNew, unlock, recover } from '../core/keys.js';
import { readBackup, checkBackupPasscode, replaceWithBackup } from '../core/backup.js';
import { isIOS, isStandalone } from '../core/util.js';

const MIN = 6;

export function InstallGuide({ onClose }) {
  return html`<${Sheet} title="Add One Find to your Home Screen" onClose=${onClose}
    footer=${html`<button class="btn" onClick=${onClose}>Got it</button>`}>
    <ol class="small" style="padding-left:20px;line-height:1.6">
      <li>Open this page in <b>Safari</b> (not Chrome or an in-app browser).</li>
      <li>Tap the <b>Share</b> button — the square with an arrow pointing up.</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Close Safari and open <b>One Find</b> from the new icon.</li>
    </ol>
    <p class="small muted">Why it matters: iOS keeps Home Screen apps' data safe from Safari's automatic clean-up, and the app works fully offline. Data you add inside Safari is kept separately from the Home Screen app, so set up <b>after</b> installing.</p>
  <//>`;
}

export function Setup({ onDone }) {
  const [step, setStep] = useState('welcome');
  const [f, bind] = useForm({ p1: '', p2: '' });
  const [err, setErr] = useState('');
  const [rk, setRk] = useState('');
  const [dk, setDk] = useState(null);
  const [ack, setAck] = useState(false);
  const [guide, setGuide] = useState(false);
  const [bk, setBk] = useState(null);
  const [busy, setBusy] = useState(false);
  const needInstall = isIOS() && !isStandalone();

  async function create(e) {
    e.preventDefault(); setErr('');
    if (f.p1.length < MIN) return setErr(`Use at least ${MIN} characters.`);
    if (f.p1 !== f.p2) return setErr('The two passcodes do not match.');
    setStep('working');
    try {
      const r = await setupNew(f.p1);
      setDk(r.dk); setRk(r.recoveryKey); setStep('recovery');
    } catch (ex) { setErr(errMsg(ex)); setStep('create'); }
  }

  async function pickBackup(e) {
    setErr('');
    const file = e.currentTarget.files && e.currentTarget.files[0];
    if (!file) return;
    try { setBk(await readBackup(file)); } catch (ex) { setErr(errMsg(ex)); }
  }

  async function restore(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (!(await checkBackupPasscode(bk, f.p1))) throw new Error("That isn't the passcode for this backup.");
      await replaceWithBackup(bk);
      const key = await unlock(f.p1);
      toast('Backup restored');
      onDone(key);
    } catch (ex) { setErr(errMsg(ex)); }
    setBusy(false);
  }

  const copy = async () => { try { await navigator.clipboard.writeText(rk); toast('Copied — paste it somewhere safe, then clear it'); } catch (e) { toast('Select the key and copy it manually'); } };

  return html`<div class="gate">
    ${step === 'welcome' && html`
      <${Pip} mood="happy" size=${96} bounce />
      <h1>One Find</h1>
      <p class="lead">Hi, I'm Pip! I'll help you remember birthdays, to-dos, money, bills, habits and important details.</p>
      <ul class="points">
        <li><span class="ico-circle vault"><${Icon} name="lock" /></span><span><b>Encrypted on this phone.</b> Nothing is sent anywhere.</span></li>
        <li><span class="ico-circle tasks"><${Icon} name="download" /></span><span><b>Works offline.</b> No account, no internet needed.</span></li>
        <li><span class="ico-circle people"><${Icon} name="heart" /></span><span><b>Free forever.</b> No ads, no tracking.</span></li>
      </ul>
      ${needInstall && html`<div class="banner warn" style="margin:0 0 16px"><${Icon} name="alert" />
        <div class="grow"><b>Install first</b>You're in Safari. Add One Find to your Home Screen, then set it up there.
        <div class="mt-s"><button class="btn sm" onClick=${() => setGuide(true)}>Show me how</button></div></div></div>`}
      <button class="btn block" onClick=${() => setStep('create')}>Set up as new</button>
      <button class="btn plain block mt-s" onClick=${() => setStep('restore')}>Restore from a backup file</button>
    `}

    ${step === 'create' && html`<form onSubmit=${create}>
      <h1>Create a passcode</h1>
      <p class="lead">It unlocks the app and encrypts your data. A short phrase you'll remember works well.</p>
      <${Field} label="Passcode" hint=${`At least ${MIN} characters.`}><input class="inp" type="password" autocomplete="new-password" ...${bind('p1')} autofocus /><//>
      <${Field} label="Type it again"><input class="inp" type="password" autocomplete="new-password" ...${bind('p2')} /><//>
      ${err && html`<p class="err">${err}</p>`}
      <button class="btn block" type="submit">Continue</button>
      <button class="link" type="button" onClick=${() => setStep('welcome')}>Back</button>
    </form>`}

    ${step === 'working' && html`<div class="center"><div class="spinner"></div><p class="muted">Creating your encryption keys…<br/>This takes a few seconds on older phones.</p></div>`}

    ${step === 'recovery' && html`
      <h1>Your recovery key</h1>
      <p class="lead">If you forget your passcode, this is the <b>only</b> way back in. Write it on paper and keep it somewhere safe — not on this phone.</p>
      <div class="reckey" aria-label="Recovery key">${rk.split('-').map((g, i, a) => html`<span>${g}${i < a.length - 1 ? '-' : ''}</span>`)}</div>
      <button class="btn plain block" onClick=${copy}><${Icon} name="copy" /> Copy</button>
      <label class="toggle mt"><span>I've written it down somewhere safe</span>
        <input type="checkbox" checked=${ack} onChange=${e => setAck(e.currentTarget.checked)} /><span class="sw"></span></label>
      <button class="btn block" disabled=${!ack} onClick=${() => onDone(dk)}>Start using One Find</button>
    `}

    ${step === 'restore' && html`<form onSubmit=${restore}>
      <h1>Restore a backup</h1>
      <p class="lead">Pick a <b>.onefind</b> backup file (from Files, iCloud Drive or AirDrop). It opens with the passcode that was set when the backup was made.</p>
      <${Field} label="Backup file"><input class="inp" type="file" onChange=${pickBackup} /><//>
      ${bk && html`<p class="small muted">Backup from ${new Date(bk.createdAt).toLocaleString('en-IN')}.</p>
        <${Field} label="Passcode for this backup"><input class="inp" type="password" autocomplete="current-password" ...${bind('p1')} /><//>`}
      ${err && html`<p class="err">${err}</p>`}
      <button class="btn block" type="submit" disabled=${!bk || !f.p1 || busy}>${busy ? 'Restoring…' : 'Restore'}</button>
      <button class="link" type="button" onClick=${() => { setStep('welcome'); setErr(''); }}>Back</button>
    </form>`}
    ${guide && html`<${InstallGuide} onClose=${() => setGuide(false)} />`}
  </div>`;
}

export function Lock({ onUnlocked }) {
  const [mode, setMode] = useState('unlock');
  const [f, bind, , setF] = useForm({ p: '', rk: '', n1: '', n2: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function doUnlock(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { onUnlocked(await unlock(f.p)); } catch (ex) { setErr(errMsg(ex)); setF(s => ({ ...s, p: '' })); }
    setBusy(false);
  }
  async function doRecover(e) {
    e.preventDefault(); setErr('');
    if (f.n1.length < MIN) return setErr(`New passcode needs at least ${MIN} characters.`);
    if (f.n1 !== f.n2) return setErr('The new passcodes do not match.');
    setBusy(true);
    try { const dk = await recover(f.rk, f.n1); toast('Passcode reset'); onUnlocked(dk); } catch (ex) { setErr(errMsg(ex)); }
    setBusy(false);
  }

  return html`<div class="gate">
    <${Pip} mood="sleepy" size=${80} />
    ${mode === 'unlock' ? html`<form onSubmit=${doUnlock}>
      <h1>Welcome back</h1>
      <p class="lead">Enter your passcode to unlock.</p>
      <${Field} label="Passcode"><input class="inp" type="password" autocomplete="current-password" ...${bind('p')} autofocus /><//>
      ${err && html`<p class="err">${err}</p>`}
      <button class="btn block" type="submit" disabled=${!f.p || busy}>${busy ? 'Unlocking…' : 'Unlock'}</button>
      <button class="link" type="button" onClick=${() => { setMode('recover'); setErr(''); }}>Forgot passcode? Use recovery key</button>
    </form>` : html`<form onSubmit=${doRecover}>
      <h1>Reset passcode</h1>
      <p class="lead">Enter the recovery key you wrote down at setup, then choose a new passcode.</p>
      <${Field} label="Recovery key"><input class="inp" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" ...${bind('rk')} /><//>
      <${Field} label="New passcode"><input class="inp" type="password" autocomplete="new-password" ...${bind('n1')} /><//>
      <${Field} label="Type it again"><input class="inp" type="password" autocomplete="new-password" ...${bind('n2')} /><//>
      ${err && html`<p class="err">${err}</p>`}
      <button class="btn block" type="submit" disabled=${busy}>${busy ? 'Checking…' : 'Reset and unlock'}</button>
      <button class="link" type="button" onClick=${() => { setMode('unlock'); setErr(''); }}>Back</button>
    </form>`}
  </div>`;
}
