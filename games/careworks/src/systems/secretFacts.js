// The secret fact registry (Milestone 29, bible §35): every fact a secret rule may read, by its plain name (data/secrets.js
// FACTS lists them, with the harmful ones marked), answered from the systems that already exist — nothing here keeps a
// score of its own except the few run records the engine needs and the systems don't keep:
//   log.months     one record per closed month (the five headline scores, profit, essential care, agency, Safe Coverage,
//                  Family Trust …), written at the month's close (monthRecord) — "consecutive months"
//   log.joined     staff id → the day they joined (continuous employment; a departure removes them), log.starting the
//                  starting staff, log.lastLeft the last day anyone left (no-quit streaks)
//   log.at         the counters at the last month's close (this month's essential care missed, agency, unsafe shifts …)
// Run facts live in the campaign save (care.secrets.log); account facts (Memory Book, New Game+, secrets found) come from
// the account store through `account`.
//
//   createSecretFacts({ env, log, engine, account }) → core FactRegistry
//   monthRecord(env, log) → the month's record (and moves log.at on)
//   newLog(env) · ensureLog(saved, env)     an older save (M28b): months rebuilt from the history it has (economy history:
//                                           profit; the quality window: that month's scores), staff from their records
//   env: the home world's read-only view (src/systems/homeWorld.js secretEnv)
import { FactRegistry } from '../../../../core/SecretEngine.js';
import { SCORE_IDS } from '../../data/quality.js';
import { FRIENDSHIP } from '../../data/relationships.js';
import { stayTypeOf } from './endOfLife.js';
import { dietOf } from './dining.js';
import { AID_LEVELS } from '../../data/mobility.js';

const r1 = (x) => Math.round(x * 10) / 10;
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const LONG_TERM = ['Long Term', 'Palliative'];
const STORY_TAGS = ['History', 'Community'];
const MONTHS_KEPT = 240; // 20 years of months: the whole campaign and its postgame
// Milestone 30: the daily records (dailyRecord) —
//   log.programBest   program id → its longest unbroken run in days (a program "run for a full month": FULL_RUN days)
//   log.familiar90    resident id → the day their highest Familiar Care last reached FAMILIAR_HIGH (gone when it drops)
//   log.forcedDependence  resident-days a resident who could walk with a frame or better was on a wheelchair / transfer
//                     plan (harm: only ever in forbids)
const FULL_RUN = 28;
const FAMILIAR_HIGH = 90;
const DEPENDENCE_PLANS = ['MO08', 'MO04']; // Wheelchair Mobility Plan, Transfer Assist
const WALKS_FROM = AID_LEVELS.find((a) => a.aid === 'frame').from; // a mobility level at which a walking plan fits
const topFamiliar = (env, residentId) => Math.max(0, ...env.team().map((q) => env.familiarityOf(residentId, q.id) ?? 0));
const forcedNow = (env) => env.residentsHere().filter((p) => DEPENDENCE_PLANS.includes(p.state.plan?.MO) && (p.state.mobility?.level ?? 0) >= WALKS_FROM).length;

// --- the counters a month's record reads (each ever-rising, so a month is the difference since the last close) -------------
function counters(env) {
  const c = env.care;
  const cs = env.staffState.coverage;
  return {
    essentialMissed: c.counts?.essentialMissed ?? 0,
    unsafe: cs?.unsafe ?? 0,
    agency: cs?.agencyHired ?? 0,
    medErrors: c.clinical?.issues ?? 0,
    complaints: (c.family?.complaints ?? []).length,
    passings: (c.eol?.passings ?? []).length,
    falls: (c.incidents?.falls ?? []).length,
  };
}
export function newLog(env) {
  return { v: 1, months: [], joined: {}, starting: [], lastLeft: null, birthdays: 0, discharges: 0, timeline: [], opened: env.today(), at: counters(env), monthStart: env.today(), rebuilt: false, programBest: {}, familiar90: {}, forcedDependence: 0 };
}

// Each midnight, before the day's rules (Milestone 30): the records a day can't rebuild later.
export function dailyRecord(env, log) {
  const day = env.today();
  log.programBest ??= {};
  for (const [id, run] of Object.entries(env.care.programs?.running ?? {})) log.programBest[id] = Math.max(log.programBest[id] ?? 0, day - (run.since ?? day));
  const here = env.residentsHere();
  const f = (log.familiar90 ??= {});
  for (const id of Object.keys(f)) if (!here.some((p) => p.id === id)) delete f[id];
  for (const p of here) {
    if (topFamiliar(env, p.id) >= FAMILIAR_HIGH) f[p.id] ??= day;
    else delete f[p.id];
  }
  log.forcedDependence = (log.forcedDependence ?? 0) + forcedNow(env);
}
// Each staff member here: joined day 0 (a new home) / the hire's day / the Founder's days employed.
function noteTeam(env, log) {
  for (const q of env.team()) {
    if (log.joined[q.id] != null) continue;
    const hire = [...(env.staffing?.state?.hires ?? [])].reverse().find((h) => h.id === q.id);
    const founder = env.staffState.founder?.id === q.id ? env.today() - (env.staffState.founder.history?.daysEmployed ?? 0) : null;
    log.joined[q.id] = founder ?? hire?.day ?? (log.starting.includes(q.id) ? 0 : env.today());
  }
}
export function ensureLog(saved, env) {
  if (saved && typeof saved === 'object' && saved.v) {
    const log = { ...newLog(env), ...JSON.parse(JSON.stringify(saved)) };
    log.at = { ...counters(env), ...(saved.at ?? {}) };
    noteTeam(env, log);
    return log;
  }
  // An older save (or a new home): what the systems already keep.
  const log = newLog(env);
  log.starting = [...env.startingIds()];
  log.opened = env.care.quality?.opened ?? env.today();
  log.rebuilt = env.today() > 0;
  log.birthdays = Object.keys(env.birthdaysHeld()).length; // (each resident whose birthday was held: the count it has)
  log.discharges = (env.care.rewards?.discharges ?? []).length; // (the rehab discharges it kept)
  // the firsts it can see, in the order they happened (ranks, awards, the first birthday and discharge)
  const t = [...(env.care.quality?.rankLog ?? []).map((r) => ({ key: `rank:${r.rank}`, day: r.day })), ...Object.entries(env.care.quality?.acc ?? {}).filter(([, a]) => a.won != null).map(([id, a]) => ({ key: `award:${id}`, day: a.won }))];
  const b = env.birthdayFirst?.();
  if (b != null) t.push({ key: 'birthday', day: b });
  const dc = (env.care.rewards?.discharges ?? [])[0];
  if (dc) t.push({ key: 'discharge', day: dc.day });
  log.timeline = t.sort((x, y) => x.day - y.day);
  // closed months from the economy history (profit), with that month's scores from the quality window when it covers it
  const samples = env.care.quality?.samples ?? [];
  for (const h of env.economy.history(24)) {
    const inMonth = samples.filter((s) => s.day > h.day - env.daysPerMonth && s.day <= h.day);
    const scores = inMonth.length >= env.daysPerMonth / 2 ? Object.fromEntries(SCORE_IDS.map((id) => [id, r1(avg(inMonth.map((s) => s.scores[id])))])) : null;
    log.months.push({ m: Math.round(h.day / env.daysPerMonth), day: h.day, scores, lowest: scores ? Math.min(...SCORE_IDS.map((id) => scores[id])) : null, net: h.net, profit: h.net > 0, rebuilt: true });
  }
  const departed = env.staffing?.state?.departed ?? [];
  log.lastLeft = departed.length ? Math.max(...departed.map((d) => d.day ?? 0)) : null;
  noteTeam(env, log);
  return log;
}

// The month just closed (called after the ledger, the partners and the economy have closed it).
export function monthRecord(env, log) {
  const now = counters(env);
  const was = log.at ?? now;
  const day = env.today();
  const q = env.quality;
  const scores = q.scores();
  const here = env.residentsHere();
  const recs = (env.staffState.coverage?.history ?? []).filter((h) => h.day >= log.monthStart && h.day < day);
  const shifts = recs.length;
  const agencyShifts = recs.filter((h) => (h.agency ?? 0) > 0).length;
  const cap = env.capacity();
  const rec = {
    m: Math.round(day / env.daysPerMonth),
    day,
    year: env.year(),
    scores: { ...scores },
    lowest: Math.min(...SCORE_IDS.map((id) => scores[id])),
    net: env.economy.history(1).at(-1)?.net ?? 0,
    profit: (env.economy.history(1).at(-1)?.net ?? 0) > 0,
    essentialMissed: Math.max(0, now.essentialMissed - was.essentialMissed),
    noMissed: now.essentialMissed - was.essentialMissed <= 0 && here.length > 0,
    familyTrust: env.familyTrust() ?? null,
    nutrition: q.measure('nutrition'),
    environment: env.environment(),
    residents: here.length,
    occupancy: cap ? Math.round((100 * here.length) / cap) : 0,
    shifts,
    agencyShifts,
    agencyPct: shifts ? r1((100 * agencyShifts) / shifts) : 0,
    safePct: shifts ? r1((100 * recs.filter((h) => h.safe).length) / shifts) : 100,
    unsafeShifts: Math.max(0, now.unsafe - was.unsafe),
    medErrors: Math.max(0, now.medErrors - was.medErrors),
    complaints: Math.max(0, now.complaints - was.complaints),
    falls: Math.max(0, now.falls - was.falls),
    passings: Math.max(0, now.passings - was.passings),
  };
  log.months.push(rec);
  if (log.months.length > MONTHS_KEPT) log.months.splice(0, log.months.length - MONTHS_KEPT);
  log.at = now;
  log.monthStart = day;
  return rec;
}

export function createSecretFacts({ env, log, engine, account }) {
  const L = () => log();
  const here = () => env.residentsHere();
  const longTerm = (p) => LONG_TERM.includes(stayTypeOf(p.def, p.state));
  const tagsOf = (p) => (p.state.tags?.length ? p.state.tags : p.def.tags ?? []);
  const daysEmployed = (id) => (L().joined[id] == null ? 0 : env.today() - L().joined[id]);
  const scores = () => env.quality.scores();
  const month = () => {
    const now = counters(env);
    const was = L().at ?? now;
    return { essentialMissed: Math.max(0, now.essentialMissed - was.essentialMissed), unsafe: Math.max(0, now.unsafe - was.unsafe) };
  };
  const monthShifts = () => (env.staffState.coverage?.history ?? []).filter((h) => h.day >= L().monthStart);
  const residentList = () =>
    here().map((p) => {
      const o = p.state.outcomes ?? {};
      const since = L().familiar90?.[p.id];
      return {
        id: p.id, stay: stayTypeOf(p.def, p.state), longTerm: longTerm(p), tags: tagsOf(p), mood: o.mood ?? 0, comfort: o.comfort ?? 0, independence: o.independence ?? 0, connection: o.connection ?? 0, mobility: p.state.mobility?.level ?? null, familyTrust: env.care.families?.[p.id]?.trust ?? null, daysHere: env.today() - (p.state.admittedDay ?? 0), memorySupport: !!env.isMemorySupport(p.id),
        // (Milestone 30)
        starting: (p.state.admittedDay ?? 0) <= (L().opened ?? 0),
        plan: { ...(p.state.plan ?? {}) },
        specialMenu: dietOf(p.state) !== 'standard' && !!env.dietMadeByTeam?.(p.id),
        favouriteFood: p.state.plan?.NU === 'NU07' && p.state.optionPrefs?.NU07 !== 'refuse',
        dining: p.state.dining?.avg ?? null,
        familiar: topFamiliar(env, p.id),
        familiar90Days: since == null ? 0 : env.today() - since,
      };
    });
  const avgOver = (key) => {
    const v = residentList().map((x) => x[key]).filter((x) => typeof x === 'number');
    return v.length ? r1(avg(v)) : 0;
  };
  const friendships = () => {
    const byId = new Map(here().map((p) => [p.id, p]));
    return Object.values(env.care.friendships ?? {})
      .filter((r) => byId.has(r.a) && byId.has(r.b))
      .map((r) => {
        const a = byId.get(r.a);
        const b = byId.get(r.b);
        const ta = tagsOf(a);
        const tb = tagsOf(b);
        return { a: r.a, b: r.b, friendship: r.friendship, both: ta.filter((t) => tb.includes(t)), bothLongTerm: longTerm(a) && longTerm(b), storyTags: ta.some((t) => STORY_TAGS.includes(t)) && tb.some((t) => STORY_TAGS.includes(t)), days: r.firstDay == null ? 0 : env.today() - r.firstDay, friends: r.friendship >= FRIENDSHIP.friendAt };
      });
  };
  const familiarity = () => {
    const out = [];
    const staff = env.team().map((q) => q.id);
    for (const p of here()) for (const s of staff) out.push({ staff: s, resident: p.id, familiarity: env.familiarityOf(p.id, s), starting: L().starting.includes(s) });
    return out;
  };
  const staffList = () => env.team().map((q) => ({ id: q.id, role: q.role, tier: q.model?.tier ?? null, founder: env.staffState.founder?.id === q.id, starting: L().starting.includes(q.id), daysEmployed: daysEmployed(q.id) }));
  const discharges = () => (env.care.rewards?.discharges ?? []).map((d) => ({ id: d.id, day: d.day, days: d.days ?? 0, independence: d.independence ?? null }));
  const eolResults = () => env.care.eol?.results ?? [];
  const programIds = () => Object.keys(env.care.programs?.running ?? {});
  const partnersList = () => {
    const P = env.care.partners ?? {};
    const ids = new Set([...Object.keys(P.tiers ?? {}), ...Object.keys(P.deals ?? {})]);
    return [...ids].map((id) => ({ id, tier: P.tiers?.[id] ?? 0, active: !!P.deals?.[id] }));
  };

  const facts = new FactRegistry()
    // thresholds
    .defineGroup('run.score', (id) => scores()[id])
    .define('run.lowestScore', () => Math.min(...SCORE_IDS.map((id) => scores()[id])))
    .define('run.nutrition', () => env.quality.measure('nutrition'))
    .define('run.environment', () => env.environment())
    .define('run.residents', () => here().length)
    .define('run.capacity', () => env.capacity())
    .define('run.occupancy', () => (env.capacity() ? Math.round((100 * here().length) / env.capacity()) : 0))
    .define('run.stage', () => env.stage())
    .define('run.year', () => env.year())
    .define('run.rank', () => env.quality.rankIndex)
    .define('run.residentList', residentList)
    .define('run.community', () => avgOver('connection'))
    .define('run.mobilityOutcome', () => avgOver('independence'))
    .define('run.diningSatisfaction', () => avgOver('dining'))
    // consecutive months
    .define('run.months', () => L().months)
    .define('run.monthsClosed', () => L().months.length)
    // history: the firsts in the order they happened (rank:D, award:C01, birthday, discharge, stage:2, partner:P01 …)
    .define('run.timeline', () => (L().timeline ?? []).map((x) => x.key))
    // programs
    .define('run.programsRunning', () => programIds().length)
    .define('run.programIds', programIds)
    .define('run.programsEver', () => [...new Set([...(env.care.programs?.history ?? []).filter((h) => h.what === 'started').map((h) => h.id), ...programIds()])])
    .define('run.programs', () => Object.entries(env.care.programs?.running ?? {}).map(([id, run]) => ({ id, days: Math.max(0, env.today() - (run.since ?? env.today())) })))
    .define('run.programsCompleted', () => Object.values(L().programBest ?? {}).filter((d) => d >= FULL_RUN).length)
    // resident outcomes
    .define('run.rehabDischarges', () => L().discharges ?? 0)
    .define('run.discharges', discharges)
    .define('run.birthdaysHeld', () => L().birthdays ?? 0)
    .define('run.wishesHonoured', () => eolResults().filter((r) => (r.parts ?? []).some((x) => x.id === 'wishes' && x.value >= 60)).length)
    .define('run.wellSupported', () => eolResults().filter((r) => r.good).length)
    // friendship / familiarity
    .define('run.friendships', friendships)
    .define('run.bestFriendship', () => Math.max(0, ...friendships().map((f) => f.friendship)))
    .define('run.storyFriendship', () => Math.max(0, ...friendships().filter((f) => f.bothLongTerm && f.storyTags).map((f) => f.friendship)))
    .define('run.familiarity', familiarity)
    .define('run.familiarCare', () => {
      const staff = env.team().map((q) => q.id);
      const tops = here().map((p) => Math.max(0, ...staff.map((s) => env.familiarityOf(p.id, s))));
      return tops.length ? r1(avg(tops)) : 0;
    })
    // staff continuous employment
    .define('run.staff', staffList)
    .define('run.startingKept', () => L().starting.filter((id) => env.team().some((q) => q.id === id) && L().joined[id] != null).length)
    .define('run.longestServing', () => Math.max(0, ...env.team().map((q) => daysEmployed(q.id))))
    .define('run.noQuitDays', () => env.today() - (L().lastLeft ?? L().opened ?? 0))
    // (Milestone 30: who finished a course — the quality system's trainedOn record; a staff id starts with its role)
    .define('run.trainedStaff', () => Object.keys(env.care.quality?.trainedOn ?? {}).map((id) => ({ id, role: id.slice(0, 2) })))
    // family trust
    .define('run.familyTrust', () => env.familyTrust())
    .define('run.families', () => here().map((p) => ({ resident: p.id, trust: env.care.families?.[p.id]?.trust ?? null })))
    // roster / agency
    .define('run.agencyShiftsMonth', () => monthShifts().filter((h) => (h.agency ?? 0) > 0).length)
    .define('run.safePctMonth', () => {
      const m = monthShifts();
      return m.length ? r1((100 * m.filter((h) => h.safe).length) / m.length) : 100;
    })
    // awards, partners, secrets
    .define('run.awards', () => env.quality.wonIds())
    .define('run.awardCount', () => env.quality.wonIds().length)
    .define('run.partners', partnersList)
    .define('run.partnerTopTier', () => Math.max(0, ...partnersList().map((p) => p.tier)))
    .define('run.secretsFound', () => engine().rules.filter((r) => engine().unlockedInRun(r.id)).length)
    // harm (§35): only ever in forbids
    .define('run.essentialMissedMonth', () => month().essentialMissed)
    .define('run.essentialMissed', () => env.care.counts?.essentialMissed ?? 0)
    .define('run.falls28', () => (env.care.incidents?.falls ?? []).filter((f) => f.day > env.today() - 28).length)
    .define('run.unsafeShiftsMonth', () => month().unsafe)
    .define('run.unsafeShifts', () => env.staffState.coverage?.unsafe ?? 0)
    .define('run.medErrors', () => env.care.clinical?.issues ?? 0)
    .define('run.openMedAlerts', () => (env.care.clinical?.alerts ?? []).filter((a) => a.status === 'open').length)
    .define('run.distress', () => here().filter((p) => (p.state.outcomes?.mood ?? 100) < 20).length)
    .define('run.complaints', () => (env.care.family?.complaints ?? []).length)
    .define('run.passings', () => (env.care.eol?.passings ?? []).length)
    .define('run.eolNotWellSupported', () => eolResults().filter((r) => !r.good).length)
    .define('run.forcedDependence', () => L().forcedDependence ?? 0)
    // account
    .define('account.ngPlus', () => env.ngPlus())
    .define('account.memoryBook', () => account().memoryBook())
    .define('account.secretsFound', () => engine().rules.filter((r) => engine().everUnlocked(r.id)).length)
    .define('account.secretsFoundIds', () => engine().rules.filter((r) => engine().everUnlocked(r.id)).map((r) => r.id))
    .define('account.prestigeTokens', () => account().prestigeTokens())
    .define('account.storySecretsFound', () => engine().rules.filter((r) => r.category === 'residentStory' && engine().everUnlocked(r.id)).length)
    // the moment's own payload
    .defineGroup('event', (field, ctx) => ctx?.payload?.[field]);
  return facts;
}
