// The home's money (Milestone 6, bible §27 income lines): Credits on core/EconomySystem — every change is one ledger
// line, and the balance always equals the sum of the lines. At each month's close every resident's accommodation fee
// and Care Support Funding (by Support Level, for the days they lived here that month) come in and every team
// member's salary goes out (data/balance.js FEES, data/staff.js salaries). No debt system yet (Milestone 22): the
// balance may go below zero and is simply shown red; no interest, no closure.
//   createLedger({ saved, bus, now, startCredits }) → ledger
//   ledger.balance · ledger.closeMonth({ month, fromDay, toDay, residents, staff }) → the lines added
//   ledger.monthLines(month) → that close's lines · ledger.lastClose → the newest close's month label (or null)
//   ledger.forecast({ fromDay, toDay, day, residents, staff }) → this month so far: income earned, wages due
//   ledger.serialize()
//     residents: [{ id, name, support level, admittedDay, leftDay (Milestone 9: went home) }]   staff: [{ id, name, salary }]
import { EconomySystem } from '../../../../core/EconomySystem.js';
import { FEES, LEDGER } from '../../data/balance.js';

const CAT = LEDGER.categories;

// Days a resident lived here in [fromDay, toDay) (they pay for those days only).
// Milestone 9: someone who went home (leftDay) pays up to that day.
export const daysHere = (r, fromDay, toDay) => Math.max(0, Math.min(toDay, r.leftDay ?? toDay) - Math.max(fromDay, r.admittedDay ?? fromDay));

// The lines one month's close brings: fees and funding per resident, wages per team member.
// len = the whole month in days (a forecast passes the days so far as toDay but the full month as len).
export function monthLinesFor({ fromDay, toDay, residents, staff, len = toDay - fromDay }) {
  const out = [];
  for (const r of residents) {
    const d = daysHere(r, fromDay, toDay);
    if (!d) continue;
    out.push({ category: 'fees', amount: Math.round((FEES.accommodationPerMonth * d) / len), reason: `${CAT.fees}: ${r.name}${d < len ? ` (${d} days)` : ''}` });
    out.push({ category: 'funding', amount: Math.round((FEES.careSupportFundingByLevel[r.level] * d) / len), reason: `${CAT.funding}: ${r.name} (level ${r.level})` });
  }
  for (const s of staff) out.push({ category: 'wages', amount: -s.salary, reason: `${CAT.wages}: ${s.name}` });
  return out;
}

export function createLedger({ saved = null, bus = null, now = () => 0, startCredits = 0 } = {}) {
  const eco = new EconomySystem({
    bus,
    currencies: { credits: { name: 'Credits' } },
    debt: { warnBelow: 0, limit: -Infinity, monthlyInterestPct: 0, closureMonths: Infinity }, // no debt system yet
    now,
    maxLines: LEDGER.maxLines,
  });
  const closes = []; // [{ month (label), day, lines: [line numbers] }] newest last (the last 12 kept)
  if (saved?.economy) {
    eco.load(saved.economy);
    closes.push(...(saved.closes ?? []));
  } else if (startCredits) eco.add('credits', startCredits, CAT.opening, 'opening');

  const ledger = {
    economy: eco,
    get balance() {
      return eco.balance('credits');
    },
    get lastClose() {
      return closes[closes.length - 1] ?? null;
    },
    closes,
    closeMonth({ month, fromDay, toDay, residents, staff }) {
      const lines = monthLinesFor({ fromDay, toDay, residents, staff }).map((l) => eco.add('credits', l.amount, l.reason, l.category)).filter(Boolean);
      closes.push({ month, day: toDay, lines: lines.map((l) => ({ reason: l.reason, amount: l.amount, category: l.category })) });
      if (closes.length > 12) closes.shift();
      bus?.emit('ledger:close', { month, lines: lines.length, balance: eco.balance('credits') });
      return lines;
    },
    // This month so far: what the close would bring if the month ended today (residents' days so far, full wages).
    // income: earned for the days so far; wages: the full month (they are due at the close either way).
    forecast({ fromDay, toDay, day, residents, staff }) {
      return monthLinesFor({ fromDay, toDay: Math.max(fromDay, day), residents, staff, len: toDay - fromDay });
    },
    totals: (lines) => ({
      income: lines.filter((l) => l.amount > 0).reduce((t, l) => t + l.amount, 0),
      costs: lines.filter((l) => l.amount < 0).reduce((t, l) => t + l.amount, 0),
    }),
    reconcile: () => eco.reconcile(),
    serialize: () => ({ economy: eco.serialize(), closes: closes.map((c) => ({ ...c, lines: c.lines.map((l) => ({ ...l })) })) }),
  };
  return ledger;
}
