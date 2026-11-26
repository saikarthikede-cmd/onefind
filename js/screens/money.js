// Money: expenses, income, monthly budget, category breakdown, CSV export.
import { html, useState, useEffect, useStore, useForm, Header, Section, Icon, Sheet, Field, Seg, Chips, Empty, Fab, Bars, routeParam, clearParam, attempt, confirmBox, toast } from '../ui/kit.js';
import { save, remove, prefs, savePrefs } from '../core/store.js';
import { monthTotals } from '../core/agenda.js';
import { today, monthKey, monthLabel, shiftMonth, fmt, fmtLong } from '../core/dates.js';
import { money, parseMoney, moneyInput, by, cls, csvEscape, shareOrDownload } from '../core/util.js';

function TxEditor({ tx, onClose }) {
  const p = prefs();
  const t = tx || {};
  const [f, bind, set] = useForm({
    type: t.type || 'expense', amount: moneyInput(t.amount), category: t.category || '', mode: t.mode || 'UPI',
    date: t.date || today(), note: t.note || ''
  });
  const cats = f.type === 'income' ? p.incomeCats : p.expenseCats;
  const amount = parseMoney(f.amount);
  const valid = amount > 0 && f.date;
  const submit = e => {
    e && e.preventDefault();
    if (!valid) return;
    attempt(async () => {
      await save('transactions', { ...t, type: f.type, amount, category: f.category || (f.type === 'income' ? 'Other income' : 'Other'), mode: f.mode, date: f.date, note: f.note.trim() });
      onClose();
    }, t.id ? 'Saved' : `${f.type === 'income' ? 'Income' : 'Expense'} added`);
  };
  const del = () => confirmBox('Delete this entry?') && attempt(async () => { await remove('transactions', t.id); onClose(); }, 'Deleted');
  return html`<${Sheet} title=${t.id ? 'Edit entry' : 'Add money entry'} onClose=${onClose} footer=${html`
      ${t.id && html`<button class="btn danger" onClick=${del}>Delete</button>`}
      <button class="btn" onClick=${submit} disabled=${!valid}>Save</button>`}>
    <form onSubmit=${submit}>
      <${Field} group label="Type"><${Seg} options=${[['expense', 'Expense'], ['income', 'Income']]} value=${f.type} onChange=${v => { set('type', v); set('category', ''); }} /><//>
      <${Field} label="Amount (₹)"><input class="inp" inputmode="decimal" ...${bind('amount')} placeholder="0" autofocus=${!t.id} style="font-size:24px;font-weight:600" /><//>
      <${Field} group label="Category"><${Chips} options=${cats} value=${f.category} onChange=${v => set('category', v)} /><//>
      ${f.type === 'expense' && html`<${Field} group label="Paid by"><${Chips} options=${p.modes} value=${f.mode} onChange=${v => set('mode', v)} /><//>`}
      <div class="two">
        <${Field} label="Date"><input class="inp" type="date" ...${bind('date')} /><//>
        <${Field} label="Note"><input class="inp" ...${bind('note')} placeholder="Optional" /><//>
      </div>
    </form>
  <//>`;
}

function BudgetEditor({ onClose }) {
  const [v, setV] = useState(moneyInput(prefs().budget));
  const submit = e => { e && e.preventDefault(); attempt(async () => { await savePrefs({ budget: parseMoney(v) }); onClose(); }, 'Budget saved'); };
  return html`<${Sheet} title="Monthly budget" onClose=${onClose} footer=${html`<button class="btn" onClick=${submit}>Save</button>`}>
    <form onSubmit=${submit}><${Field} label="Budget per month (₹)" hint="Leave empty to turn the budget off.">
      <input class="inp" inputmode="decimal" value=${v} onInput=${e => setV(e.currentTarget.value)} autofocus /><//></form>
  <//>`;
}

async function exportCsv(txs, key) {
  const head = ['Date', 'Type', 'Amount (INR)', 'Category', 'Paid by', 'Note'];
  const rows = txs.slice().sort(by(x => x.date)).map(x => [x.date, x.type, (x.amount / 100).toFixed(2), x.category, x.type === 'income' ? '' : x.mode, x.note]);
  const csv = [head, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  const r = await shareOrDownload(new Blob([csv], { type: 'text/csv' }), `onefind-money-${key}.csv`, 'One Find money');
  if (r !== 'cancelled') toast('CSV ready');
}

export function Money() {
  const S = useStore();
  const [key, setKey] = useState(monthKey(today()));
  const [edit, setEdit] = useState(null);
  const [budget, setBudget] = useState(false);
  useEffect(() => {
    const id = routeParam('open');
    if (id) { const tx = S.items.transactions.find(x => x.id === id); if (tx) { setKey(monthKey(tx.date)); setEdit(tx); } clearParam(); }
    else if (routeParam('add')) { setEdit({}); clearParam(); }
  }, []);
  const p = prefs();
  const { tx, spent, income } = monthTotals(S, key);
  const byCat = {};
  tx.filter(x => x.type !== 'income').forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
  const cats = Object.keys(byCat).map(k => ({ label: k, value: byCat[k] })).sort(by(r => r.value, -1));
  const top = cats.slice(0, 6);
  if (cats.length > 6) top.push({ label: 'Everything else', value: cats.slice(6).reduce((s, r) => s + r.value, 0) });
  const days = {};
  tx.forEach(x => { (days[x.date] = days[x.date] || []).push(x); });
  const dates = Object.keys(days).sort().reverse();
  const isNow = key === monthKey(today());
  const left = p.budget - spent;

  return html`<div>
    <${Header} title="Money" right=${html`<button class="icon-btn" aria-label="Export CSV" onClick=${() => exportCsv(tx, key)} disabled=${!tx.length}><${Icon} name="share" /></button>`} />
    <main class="wrap">
      <div class="seg" style="align-items:center">
        <button aria-label="Previous month" onClick=${() => setKey(shiftMonth(key, -1))}><${Icon} name="back" /></button>
        <button class="on" style="flex:3" onClick=${() => setKey(monthKey(today()))}>${monthLabel(key)}</button>
        <button aria-label="Next month" onClick=${() => setKey(shiftMonth(key, 1))} disabled=${isNow}><${Icon} name="next" /></button>
      </div>
      <div class="stats mt">
        <div class="stat"><div class="k">Spent</div><div class="v">${money(spent)}</div></div>
        <div class="stat"><div class="k">Income</div><div class="v" style="color:var(--good)">${money(income)}</div></div>
      </div>
      <button class="card stat mt-s" style="width:100%;text-align:left;border:0;cursor:pointer;display:block" onClick=${() => setBudget(true)}>
        ${p.budget > 0 ? html`
          <div class="k">Budget ${money(p.budget)} · ${left >= 0 ? 'left' : 'over by'}</div>
          <div class="v" style=${left < 0 ? 'color:var(--bad)' : ''}>${money(Math.abs(left))}</div>
          <div class=${cls('bar', left < 0 && 'over')}><i style=${`width:${Math.min(100, (spent / p.budget) * 100)}%`}></i></div>`
        : html`<div class="k">No monthly budget</div><div class="small" style="color:var(--accent);font-weight:600">Set a budget →</div>`}
      </button>
      ${top.length > 0 && html`<${Section} title="Where it went"><div class="card" style="padding:12px 14px"><${Bars} rows=${top} fmt=${money} /></div><//>`}
      ${dates.length ? dates.map(d => html`<${Section} key=${d} title=${d === today() ? 'Today' : fmtLong(d)}>
          <div class="card list">${days[d].sort(by(x => x.updatedAt, -1)).map(x => html`
            <button class="item" key=${x.id} onClick=${() => setEdit(x)}>
              <span class=${x.type === 'income' ? 'ico-circle income' : 'ico-circle money'}><${Icon} name=${x.type === 'income' ? 'down' : 'up'} /></span>
              <div class="grow"><div class="t">${x.note || x.category}</div><div class="s">${x.note ? x.category + ' · ' : ''}${x.type === 'income' ? 'Income' : x.mode}</div></div>
              <div class="r strong" style=${x.type === 'income' ? 'color:var(--good)' : ''}>${x.type === 'income' ? '+' : ''}${money(x.amount)}</div>
            </button>`)}</div><//>`)
        : html`<div class="card mt"><${Empty} icon="money" title=${`Nothing in ${monthLabel(key)}`} text="Log expenses as you spend — it takes 10 seconds." action="Add expense" onAction=${() => setEdit({})} /></div>`}
    </main>
    <${Fab} label="Add expense" onClick=${() => setEdit({ date: isNow ? today() : key + '-01' })} />
    ${edit && html`<${TxEditor} tx=${edit} onClose=${() => setEdit(null)} />`}
    ${budget && html`<${BudgetEditor} onClose=${() => setBudget(false)} />`}
  </div>`;
}
