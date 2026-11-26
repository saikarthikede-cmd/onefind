// Calendar export (RFC 5545). iOS Calendar then delivers the reminders natively — no server needed.
// Vault items are never exported.
import { annualIn, addDays, today } from './dates.js';
import { money } from './util.js';

const te = new TextEncoder();
const esc = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const d8 = s => s.replace(/-/g, '');

// Fold lines at 74 octets without splitting a character.
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const n = te.encode(ch).length;
    if (bytes + n > 74) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}

function event({ uid, date, time, summary, desc, rrule, alarms, stamp }) {
  const L = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`];
  if (time) {
    L.push(`DTSTART:${d8(date)}T${time.replace(':', '')}00`, 'DURATION:PT15M');
  } else {
    L.push(`DTSTART;VALUE=DATE:${d8(date)}`, `DTEND;VALUE=DATE:${d8(addDays(date, 1))}`, 'TRANSP:TRANSPARENT');
  }
  L.push(`SUMMARY:${esc(summary)}`);
  if (desc) L.push(`DESCRIPTION:${esc(desc)}`);
  if (rrule) L.push(`RRULE:${rrule}`);
  for (const trig of alarms) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(summary)}`, `TRIGGER:${trig}`, 'END:VALARM');
  L.push('END:VEVENT');
  return L;
}

function monthlyRule(day, interval) {
  const iv = interval > 1 ? `;INTERVAL=${interval}` : '';
  if (day <= 28) return `FREQ=MONTHLY${iv};BYMONTHDAY=${day}`;
  const days = [];
  for (let d = 28; d <= day; d++) days.push(d);
  return `FREQ=MONTHLY${iv};BYMONTHDAY=${days.join(',')};BYSETPOS=-1`; // e.g. 31st -> last day in short months
}

const TASK_RULE = { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };

export function buildICS({ people = [], tasks = [], bills = [], prefs = {}, include = {} }) {
  const inc = { birthdays: true, bills: true, tasks: true, nudge: !!prefs.dailyNudge, ...include };
  const H = Math.min(Math.max(Number(prefs.alertHour) || 9, 5), 22);
  const onDay = `PT${H}H`, dayBefore = `-PT${24 - H}H`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const year = Number(today().slice(0, 4));
  const ev = [];
  let count = 0;

  if (inc.birthdays) {
    for (const p of people) {
      const add = (mmdd, yr, kind, emoji) => {
        if (!mmdd) return;
        const leapDay = mmdd === '02-29';
        ev.push(...event({
          uid: `${p.id}-${kind}@onefind`, stamp,
          date: annualIn(year, mmdd),
          summary: `${emoji} ${p.name}'s ${kind}`,
          desc: yr ? `Since ${yr}. Added by One Find.` : 'Added by One Find.',
          rrule: leapDay ? 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'FREQ=YEARLY',
          alarms: [dayBefore, onDay]
        }));
        count++;
      };
      add(p.birthday, p.birthYear, 'birthday', '🎂');
      add(p.anniversary, p.anniversaryYear, 'anniversary', '💍');
    }
  }

  if (inc.bills) {
    for (const b of bills) {
      if (!b.dueDate) continue;
      const day = b.dueDay || Number(b.dueDate.slice(8));
      const rrule = b.cycle === 'yearly' ? 'FREQ=YEARLY' : b.cycle === 'once' ? null : monthlyRule(day, b.cycle === 'quarterly' ? 3 : 1);
      ev.push(...event({
        uid: `${b.id}-bill@onefind`, stamp, date: b.dueDate,
        summary: `💳 ${b.name} · ${money(b.amount)}`,
        desc: b.autopay ? 'Autopay is on — check it went through.' : 'Pay and mark it paid in One Find.',
        rrule, alarms: [dayBefore, onDay]
      }));
      count++;
    }
  }

  if (inc.tasks) {
    for (const t of tasks) {
      if (t.doneAt || !t.dueDate) continue;
      ev.push(...event({
        uid: `${t.seriesId || t.id}-task@onefind`, stamp, date: t.dueDate, time: t.dueTime || null,
        summary: `✅ ${t.title}`, desc: t.note || '',
        rrule: TASK_RULE[t.repeat] || null,
        alarms: [t.dueTime ? 'PT0M' : onDay]
      }));
      count++;
    }
  }

  if (inc.nudge) {
    ev.push(...event({
      uid: 'daily-nudge@onefind', stamp, date: today(), time: '08:00',
      summary: 'Check One Find', desc: "Open One Find and look at today's list.",
      rrule: 'FREQ=DAILY', alarms: ['PT0M']
    }));
    count++;
  }

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//One Find//Personal Assistant//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:One Find', ...ev, 'END:VCALENDAR'];
  return { text: lines.map(fold).join('\r\n') + '\r\n', count };
}
