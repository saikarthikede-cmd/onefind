// Bills & subscriptions: due-date countdown, mark paid (logs an expense automatically).
import { html, useState, useEffect, useStore, useForm, Header, Section, Icon, Sheet, Field, Chips, Toggle, Empty, Fab, routeParam, clearParam, attempt, confirmBox } from '../ui/kit.js';
import { save, remove, prefs } from '../core/store.js';
import { monthlyFixed } from '../core/agenda.js';
import { today, diffDays, fmt, rel } from '../core/dates.js';
import { money, parseMoney, moneyInput, by } from '../core/util.js';
import { payBill } from './actions.js';

const CYCLES = [['monthly', 'Monthly'], ['quarterly', 'Every 3 months'], ['yearly', 'Yearly'], ['once', 'One time']];

function BillEditor({ bill, onClose }) {
  const b = bill || {};
  const p = prefs();
  const [f, bind, set] = useForm({
    name: b.name || '', amount: moneyInput(b.amount), dueDate: b.dueDate || today(), cycle: b.cycle || 'monthly',
    autopay: !!b.autopay, category: b.category || 'Bills & utilities', note: b.note || ''
  });
  const amount = parseMoney(f.amount);
  const valid = f.name.trim() && amount > 0 && f.dueDate;
  const submit = e => {
    e && e.preventDefault();
    if (!valid) return;
    attempt(async () => {
      const dueDay = b.dueDate === f.dueDate && b.dueDay ? b.dueDay : Number(f.dueDate.slice(8));
      await save('bills', { ...b, name: f.name.trim(), amount, dueDate: f.dueDate, dueDay, cycle: f.cycle, autopay: f.autopay, category: f.category, note: f.note });
      onClose();
    });
  };
  const del = () => confirmBox(`Delete ${b.name}?`) && attempt(async () => { await remove('bills', b.id); onClose(); }, 'Deleted');
  return html`<${Sheet} title=${b.id ? b.name : 'New bill or subscription'} onClose=${onClose} footer=${html`
      ${b.id && html`<button class="btn danger" onClick=${del}>Delete</button>`}
      <button class="btn" onClick=${submit} disabled=${!valid}>Save</button>`}>
    <form onSubmit=${submit}>
      <${Field} label="Name"><input class="inp" ...${bind('name')} placeholder="Rent, Netflix, Car EMI, Credit card…" autofocus=${!b.id} /><//>
      <div class="two">
        <${Field} label="Amount (₹)"><input class="inp" inputmode="decimal" ...${bind('amount')} /><//>
        <${Field} label="Next due date"><input class="inp" type="date" ...${bind('dueDate')} /><//>
      </div>
      <${Field} group label="Repeats"><${Chips} options=${CYCLES} value=${f.cycle} onChange=${v => set('cycle', v)} /><//>
      <${Toggle} label="Autopay is set up" checked=${f.autopay} onChange=${v => set('autopay', v)} />
      <${Field} label="Category when paid">
        <select class="inp" aria-label="Category when paid" ...${bind('category')}>${p.expenseCats.map(c => html`<option value=${c}>${c}</option>`)}</select><//>
      <${Field} label="Note"><input class="inp" ...${bind('note')} placeholder="Account no., biller ID, card…" /><//>
      ${b.lastPaid && html`<p class="small muted">Last paid ${fmt(b.lastPaid, true)}.</p>`}
    </form>
  <//>`;
}

export function Bills() {
  const S = useStore();
  const [edit, setEdit] = useState(null);
  useEffect(() => {
    const id = routeParam('open');
    if (id) { const b = S.items.bills.find(x => x.id === id); if (b) setEdit(b); clearParam(); }
    else if (routeParam('add')) { setEdit({}); clearParam(); }
  }, []);
  const t = today();
  const bills = S.items.bills.slice().sort(by(b => b.dueDate));
  const fixed = monthlyFixed(S.items.bills);
  const dueSoon = bills.filter(b => diffDays(t, b.dueDate) <= 7);
  const dueSum = dueSoon.reduce((s, b) => s + b.amount, 0);

  return html`<div>
    <${Header} title="Bills" back="more" />
    <main class="wrap">
      <div class="stats">
        <div class="stat"><div class="k">Fixed costs / month</div><div class="v">${money(fixed)}</div></div>
        <div class="stat"><div class="k">Due in 7 days</div><div class="v" style=${dueSum ? 'color:var(--warn)' : ''}>${money(dueSum)}</div></div>
      </div>
      <${Section}>
        ${bills.length ? html`<div class="card list">${bills.map(b => {
          const d = diffDays(t, b.dueDate);
          const tone = d < 0 ? 'bad' : 'bills';
          return html`<div class="item" key=${b.id}>
            <span class=${'ico-circle ' + tone}><${Icon} name="bills" /></span>
            <button class="grow" style="background:none;border:0;padding:0;text-align:left;cursor:pointer" onClick=${() => setEdit(b)}>
              <div class="t">${b.name} · ${money(b.amount)}</div>
              <div class="s" style=${d < 0 ? 'color:var(--bad)' : ''}>${fmt(b.dueDate)} · ${rel(d)}${b.autopay ? ' · autopay' : ''}${b.cycle !== 'monthly' ? ' · ' + (CYCLES.find(c => c[0] === b.cycle) || [0, ''])[1].toLowerCase() : ''}</div>
            </button>
            <button class="btn sm soft" onClick=${() => payBill(b)}>Paid</button>
          </div>`;
        })}</div>` : html`<div class="card"><${Empty} icon="bills" title="No bills yet" text="Add rent, EMIs, phone recharges, OTT subscriptions and card bills to see what's due." action="Add a bill" onAction=${() => setEdit({})} /></div>`}
      <//>
      ${bills.length > 0 && html`<p class="small muted center mt">Tapping Paid logs the expense in Money and moves the bill to its next due date.</p>`}
    </main>
    <${Fab} label="Add bill" onClick=${() => setEdit({})} />
    ${edit && html`<${BillEditor} bill=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}
