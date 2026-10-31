// The verdict calendar (Milestone 32b; Kairosoft gaps 1 and 2). No new system: the four inspectors are a new way of
// showing the routine review's existing maths (core/GradeEngine on data/quality.js ROUTINE_GRADE — the grade and the
// total out of 100 are unchanged), and the two yearly shows ride the quality scores, the peer homes, the items and the
// event director that already exist. Pure rules on plain state (care.verdicts), so the Node tests drive it as the page does.
//
//   panelOf(grade) → [{ id, score, pts, max }]   a gradeRun result in four parts: each inspector's points (their
//                    categories' own) and a score out of 10; the points add up to grade.total exactly
//   panelTotal(panel) → the four scores added up (out of 40)
//   createVerdicts({ state, seed, bus, quality, items, dateOf, programsRunning })
//     v.isOpenDay(day) · v.daily(day) (after quality.daily: judge yesterday's Open Day, hold the Awards Evening)
//     v.trophies() (newest first) · v.openDayOf(year) · v.eveningOf(year)
//   bus: 'care:openDayToday' { year } · 'care:openDay' { year, ceremony } · 'care:awardsEvening' { year, ceremony }
import { Rng } from '../../../../core/Rng.js';
import { INSPECTION } from '../../data/quality.js';
import { INSPECTORS, PANEL_MAX, SCORE10, OPEN_DAY, AWARDS_EVENING, tierById } from '../../data/verdicts.js';

const clamp10 = (x) => Math.max(0, Math.min(PANEL_MAX, Math.round(x)));
const score10 = (v) => clamp10((PANEL_MAX * ((v ?? 0) - SCORE10.floor)) / (SCORE10.full - SCORE10.floor));

export function panelOf(grade) {
  const cats = Object.fromEntries((grade?.categories ?? []).map((c) => [c.id, c]));
  return INSPECTORS.map((i) => {
    const pts = i.categories.reduce((t, id) => t + (cats[id]?.score ?? 0), 0);
    const max = i.categories.reduce((t, id) => t + (cats[id]?.max ?? 0), 0);
    return { id: i.id, score: max ? clamp10((PANEL_MAX * pts) / max) : 0, pts, max };
  });
}
export const panelTotal = (panel) => (panel ?? []).reduce((t, p) => t + p.score, 0);

export function newVerdictsState() {
  return { openDays: {}, evenings: {}, trophies: [], announced: {} };
}
export function ensureVerdictsState(saved) {
  const fresh = newVerdictsState();
  if (!saved || typeof saved !== 'object') return fresh;
  return { ...fresh, ...saved, openDays: { ...(saved.openDays ?? {}) }, evenings: { ...(saved.evenings ?? {}) }, trophies: [...(saved.trophies ?? [])], announced: { ...(saved.announced ?? {}) } };
}

export function createVerdicts({ state, seed = 'careworks', bus = null, quality, items = null, dateOf, programsRunning = () => 0 }) {
  const st = state;
  const isOpenDay = (day) => {
    const d = dateOf(day);
    return d.month === OPEN_DAY.month && d.day === OPEN_DAY.day;
  };

  function reward(R, tier, why, day) {
    const r = R.rewards[tier];
    if (r.reputation) quality.addReputation(r.reputation, day, why);
    const item = r.item && items ? items.grant(R === OPEN_DAY ? 'openDay' : 'awardsEvening', { weights: r.item, why: tierById(tier).name }) : null;
    return { reputation: r.reputation, item: item ? items.typeOf(item)?.name ?? null : null };
  }
  const tierOfOpenDay = (place, total) => {
    for (const k of ['gold', 'silver', 'bronze']) if (place <= OPEN_DAY.place[k].place && total >= OPEN_DAY.place[k].min) return k;
    return 'part';
  };
  const tierOfEvening = (place, grade) => {
    for (const k of ['gold', 'silver', 'bronze']) if (place <= AWARDS_EVENING.place[k].place && AWARDS_EVENING.place[k].grades.includes(grade)) return k;
    return 'part';
  };
  const rewardWords = (got) => [got.reputation ? `Reputation +${got.reputation}` : null, got.item ? `an item: ${got.item}` : null].filter(Boolean).join(' · ');

  // --- the Open Day: judged at the midnight after it, on that day's readings -----------------------------------------
  function judgeOpenDay(day, year) {
    const sample = quality.state.samples.at(-1);
    if (!sample) return null;
    const s = sample.scores;
    const ess = sample.essential.done + sample.essential.missed;
    const essPct = ess ? (100 * sample.essential.done) / ess : 100;
    const E = OPEN_DAY.essential;
    const progs = Math.min(OPEN_DAY.programsMax, programsRunning());
    const devPts = clamp10(E.points * Math.max(0, Math.min(1, (essPct - E.floor) / (E.full - E.floor))) + progs);
    const home = { clinical: devPts, wellbeing: score10(s.residentWellbeing), family: score10(s.familyTrust), environment: score10(s.environment) };
    const panel = INSPECTORS.map((i) => ({ id: i.id, score: home[i.id] }));
    const total = panelTotal(panel);
    // the peer homes on the day: the same four looks at their own scores, a little seeded give either way
    const rng = new Rng(`${seed}:openDay:${year}`);
    const peers = quality.peers().map((p) => {
      const n = () => rng.int(-OPEN_DAY.peerNoise, OPEN_DAY.peerNoise);
      const t = clamp10(score10(p.scores.clinicalSafety) + n()) + clamp10(score10(p.scores.residentWellbeing) + n()) + clamp10(score10(p.scores.familyTrust) + n()) + clamp10(score10(p.scores.environment) + n());
      return { id: p.def.id, name: p.def.name, total: t };
    });
    const place = 1 + peers.filter((p) => p.total > total).length; // (a tie goes to the home)
    const tier = tierOfOpenDay(place, total);
    const got = reward(OPEN_DAY, tier, `Open Day: ${tierById(tier).name}`, day);
    const rec = { kind: 'openDay', year, day: day - 1, tier, total, place, of: peers.length + 1, panel, best: [...peers].sort((a, b) => b.total - a.total)[0] ?? null, ...got };
    st.openDays[year] = rec;
    st.trophies.push(rec);
    bus?.emit('care:openDay', { year, ceremony: ceremonyOf(rec) });
    return rec;
  }

  // --- the Awards Evening: the routine review and the recognition table held today (quality.daily) ---------------------
  function holdEvening(day, year) {
    const review = [...quality.inspections()].reverse().find((x) => x.kind === 'routine' && x.day === day);
    const table = quality.recognition().years.at(-1)?.table ?? [];
    if (!review) return null;
    const home = table.find((r) => r.id === 'home');
    const place = home?.place ?? 1;
    const tier = tierOfEvening(place, review.grade);
    const got = reward(AWARDS_EVENING, tier, `Awards Evening: ${tierById(tier).name}`, day);
    const rec = { kind: 'awards', year, day, tier, place, of: table.length || 1, grade: review.grade, total100: review.total, panel: review.panel ?? null, total: panelTotal(review.panel), routineRep: review.reputation ?? 0, top: table.slice(0, 3).map((r) => ({ id: r.id, place: r.place })), ...got };
    st.evenings[year] = rec;
    st.trophies.push(rec);
    bus?.emit('care:awardsEvening', { year, ceremony: ceremonyOf(rec) });
    return rec;
  }

  // What the ceremony shows (plain data: it waits in the director's saved queue).
  function ceremonyOf(rec) {
    const t = tierById(rec.tier);
    const reward = rewardWords(rec);
    if (rec.kind === 'openDay') {
      return { kind: 'openDay', title: `${OPEN_DAY.title} · Year ${rec.year}`, panel: rec.panel, total: rec.total, max: 40, tier: rec.tier, headline: t.name, lines: [rec.of > 1 ? `${ordinal(rec.place)} of ${rec.of} homes on the day` : 'The first Open Day in the network', reward || 'Thank you for opening your doors'], art: OPEN_DAY.art };
    }
    return { kind: 'awards', title: `${AWARDS_EVENING.title} · Year ${rec.year}`, panel: rec.panel, total: rec.total, max: 40, tier: rec.tier, headline: `Grade ${rec.grade} · ${t.name}`, lines: [`Routine review ${rec.total100} / 100${rec.routineRep ? ` · Reputation +${rec.routineRep}` : ''}`, `${ordinal(rec.place)} of ${rec.of} in the recognition table`, ...(reward ? [reward] : [])], art: AWARDS_EVENING.art };
  }

  function daily(day) {
    const year = dateOf(day).year;
    if (isOpenDay(day) && !st.announced[year]) {
      st.announced[year] = true;
      bus?.emit('care:openDayToday', { year });
    }
    // yesterday was the Open Day: judge it once (a reload never judges it again)
    if (day > 0 && isOpenDay(day - 1)) {
      const y = dateOf(day - 1).year;
      if (!st.openDays[y]) judgeOpenDay(day, y);
    }
    // the routine review was held at this midnight (the year's end): the Awards Evening of the year just finished
    if (day > 0 && day % INSPECTION.routineEvery === 0) {
      const y = dateOf(day - 1).year;
      if (!st.evenings[y]) holdEvening(day, y);
    }
  }

  return {
    state: st,
    isOpenDay,
    daily,
    ceremonyOf,
    trophies: () => [...st.trophies].reverse(),
    openDayOf: (y) => st.openDays[y] ?? null,
    eveningOf: (y) => st.evenings[y] ?? null,
  };
}
export const ordinal = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
