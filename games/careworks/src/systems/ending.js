// The Year-16 ending (Milestone 33, bible §47, §3): the 1,000-point grade on core/GradeEngine, the ending itself on
// core/CampaignEnding (fires once, at the first month close after Year 16 — so a home already past Year 16 gets its
// ending at its next month close), the ceremony's pages and the indefinite postgame. Pure rules on plain state
// (care.ending), so the Node tests drive it exactly as the page does.
//
//   endingFacts({ months, fact }) → the grade's facts (plain numbers). months: the M29 month records (newest last);
//     fact(name): a M29 fact (run.birthdaysHeld …). Nothing about passings is read: a death never costs points.
//   gradeEnding(facts) → { total, max, band, categories, panel: [{ id, score, max, comment, parts }] }
//   createEnding({ state, clock, facts, lookBack, c10, bus, livingFound }) → api
//     api.monthClose() (after the month's records: the ending fires here once) · api.reached · api.pending · api.postgame
//     api.page · api.setPage(page) · api.pages() (the ceremony's pages in order) · api.keepRunning() · api.grade
//     api.lookBack · api.c10 · api.dateTag() · api.livingDue · api.livingShown() · api.forceForTests()
//   Moments: 'care:ending' { total, band } (a big beat through the M28 director) · 'care:livingLegacy' {}
import { CampaignEnding } from '../../../../core/CampaignEnding.js';
import { gradeRun, checkGrade } from '../../../../core/GradeEngine.js';
import { ENDING_GRADE, ENDING_PANEL, END_YEAR, endingComment } from '../../data/ending.js';

const avg = (xs) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null);
const r1 = (x) => Math.round(x * 10) / 10;
const num = (v) => (Array.isArray(v) ? v.length : Number(v) || 0);
export const MONTHS_PER_YEAR = 12;

export function endingFacts({ months = [], fact = () => 0, score = () => null }) {
  const last = months.slice(-MONTHS_PER_YEAR);
  const scoreAvg = (list, id) => avg(list.map((m) => m.scores?.[id]).filter((x) => typeof x === 'number')) ?? score(id) ?? 0;
  const fieldAvg = (list, f, fallback) => avg(list.map((m) => m[f]).filter((x) => typeof x === 'number')) ?? fallback;
  return {
    wellbeingYear: r1(scoreAvg(last, 'residentWellbeing')),
    wellbeingRun: r1(scoreAvg(months, 'residentWellbeing')),
    birthdays: num(fact('run.birthdaysHeld')),
    clinicalYear: r1(scoreAvg(last, 'clinicalSafety')),
    safeYear: r1(fieldAvg(last.filter((m) => (m.shiftsAll ?? 0) > 0), 'safeAllPct', fieldAvg(last, 'safePct', 0))),
    familyYear: r1(scoreAvg(last, 'familyTrust')),
    familyHighMonths: months.filter((m) => (m.scores?.familyTrust ?? 0) >= 85).length,
    staffYear: r1(scoreAvg(last, 'staffWellbeing')),
    trained: num(fact('run.trainedStaff')),
    longestYears: r1(num(fact('run.longestServing')) / 336),
    awards: num(fact('run.awardCount')),
    programs: num(fact('run.programsEver')),
    environmentYear: r1(scoreAvg(last, 'environment')),
    stage: num(fact('run.stage')) || 1,
    profitMonths: last.filter((m) => m.profit).length,
    credits: Math.max(0, num(fact('credits'))),
    choiceYear: r1(fieldAvg(last, 'choice', 50)),
    community: r1(num(fact('run.community'))),
    secrets: num(fact('run.secretsFound')),
  };
}

export function gradeEnding(facts) {
  const g = gradeRun({ categories: ENDING_GRADE.categories, bands: ENDING_GRADE.bands, facts });
  const byId = Object.fromEntries(g.categories.map((c) => [c.id, c]));
  const panel = ENDING_PANEL.map((p) => {
    const cats = p.categories.map((id) => byId[id]);
    const score = cats.reduce((t, c) => t + c.score, 0);
    const max = cats.reduce((t, c) => t + c.max, 0);
    return { id: p.id, score, max, comment: endingComment(p.id, max ? score / max : 0), parts: cats.map((c) => ({ id: c.id, name: c.name, score: c.score, max: c.max })) };
  });
  return { total: g.total, max: g.max, band: g.band, categories: g.categories.map((c) => ({ id: c.id, name: c.name, score: c.score, max: c.max })), panel };
}
export const checkEndingGrade = () => checkGrade({ ...ENDING_GRADE });

export function newEndingState() {
  return { core: null, page: null, grade: null, facts: null, lookBack: null, c10: null, living: { shown: false, page: null, announced: null } };
}
export function ensureEndingState(saved) {
  const fresh = newEndingState();
  if (!saved || typeof saved !== 'object') return fresh;
  return { ...fresh, ...saved, living: { ...fresh.living, ...(saved.living ?? {}) } };
}

// The ceremony's pages: the C10 result only if C10 was applied for (won, fell short, or still booked).
export const PAGES = ['c10', 'grade', 'look', 'closing', 'choice'];
export const LIVING_PAGES = ['living', 'livingClosing'];

export function createEnding({ state, clock, facts = () => ({}), lookBack = () => ({}), c10 = () => null, bus = null, livingFound = () => false }) {
  const st = state;
  const core = new CampaignEnding({
    bus: null,
    clock,
    endYear: END_YEAR,
    onReach: () => {
      st.facts = facts();
      st.grade = gradeEnding(st.facts);
      st.lookBack = lookBack();
      st.c10 = c10();
      st.page = pagesNow()[0];
    },
  });
  core.load(st.core);
  const save = () => (st.core = core.serialize());
  const pagesNow = () => PAGES.filter((p) => p !== 'c10' || !!st.c10);
  const api = {
    get state() {
      return st;
    },
    get reached() {
      return core.reached;
    },
    // waiting on the player (a page of the ceremony or the end choice)
    get pending() {
      return core.pending;
    },
    get postgame() {
      return core.postgame;
    },
    get grade() {
      return st.grade;
    },
    get lookBack() {
      return st.lookBack;
    },
    get c10() {
      return st.c10;
    },
    get page() {
      return core.pending ? st.page ?? pagesNow()[0] : null;
    },
    pages: () => pagesNow(),
    setPage(page) {
      if (!core.pending || !pagesNow().includes(page)) return false;
      st.page = page;
      core.setStage(page);
      save();
      return true;
    },
    // The first month close after Year 16 (and, for a save loaded past Year 16, its next month close).
    monthClose() {
      if (!core.check()) return false;
      save();
      bus?.emit('care:ending', { total: st.grade.total, band: st.grade.band, year: END_YEAR });
      return true;
    },
    // The player chose either way at the end: the ending is behind them and the calendar runs on.
    keepRunning() {
      if (!core.reached) return false;
      core.continuePostgame();
      st.page = 'done';
      save();
      return true;
    },
    dateTag: () => core.dateTag(),
    // The Living Legacy ending (SEC-NGP-03's true ending): its own short ceremony, once
    get livingDue() {
      return !!livingFound() && !st.living.shown;
    },
    livingPage: () => st.living.page ?? LIVING_PAGES[0],
    setLivingPage(page) {
      if (!LIVING_PAGES.includes(page)) return false;
      st.living.page = page;
      return true;
    },
    livingShown() {
      if (st.living.shown) return false;
      st.living.shown = true;
      st.living.page = null;
      return true;
    },
    // a check only: the Living Legacy moment once (called each midnight)
    livingCheck() {
      if (!livingFound() || st.living.announced != null) return false;
      st.living.announced = clock.totalDays;
      bus?.emit('care:livingLegacy', {});
      return true;
    },
    // ?debug=1 and the tests: the ending now
    forceForTests() {
      if (!core.reach()) return false;
      save();
      bus?.emit('care:ending', { total: st.grade.total, band: st.grade.band, year: END_YEAR });
      return true;
    },
    serialize() {
      save();
      return st;
    },
  };
  return api;
}
