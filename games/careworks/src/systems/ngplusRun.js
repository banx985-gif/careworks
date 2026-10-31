// Building a New Game+ home (Milestone 33, bible §3.5.8, §37) from a finished one — pure data in, data out, so the Node
// tests use it exactly as the page does. The rules (what carries, what resets) are data/ngplus.js on core/NgPlusSystem.
//
//   ngOptions(parent)                 what the player can pick: { level, legacy, legacyPicks, blueprints, blueprintPicks,
//                                     discount (null below NG+2), rpPct, rp, living }
//   ngSnapshot(parent, account)       every key of the finished home's save and of the account store under its declared
//                                     field (core refuses a key nobody declared)
//   ngProblems(choices, options, founderId) → [plain sentences] (empty = fine): core's checks, plus the §3.5.8 rule — the
//                                     new home's Founder can't also be Legacy Staff
//   buildNgPlusRun({ parent, account, choices, setup, now }) → { data, pack } the new home's save (the finished home's data
//                                     is never changed) and core's carry package
//   accountAfterNgPlus(account, parent, level) → the account store with the highest NG+ level and the finished home's
//                                     summary (its trophies for the Trophy Case) added; nothing else touched
import { RunArchive } from '../../../../core/RunArchive.js';
import { NG_PLUS, RUN_FIELDS, CARE_FIELDS, ACCOUNT_FIELDS, NGPLUS_TEXT } from '../../data/ngplus.js';
import { VISIBLE_PROGRAMS, programById } from '../../data/programs.js';
import { FACILITIES, facilityById } from '../../data/facilities.js';
import { founderById, FOUNDER_FLAG } from '../../data/setup.js';
import { STAFF_BALANCE } from '../../data/balance.js';
import { newCampaign } from './facility.js';
import { newRosterState } from './roster.js';
import { ngRules, researchRpOf, researchPctOf, discountOpen, livingOpen } from './ngplus.js';

const copy = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const levelOf = (parent) => ngRules.levelAfter(parent.ngPlus ?? 0);

// Staff employed now (the finished home goes on into its postgame, so "at the ending" is whoever is on the team when
// New Game+ starts). Agency workers are never on the team list.
const employed = (parent) => (parent.staff?.staff ?? []).filter((m) => !m.counters?.agency);
const programsRun = (parent) => {
  const p = parent.care?.programs ?? {};
  // (a blueprint this home started with counts as used here: it can go on to the next New Game+ home)
  const ids = new Set([...(p.history ?? []).filter((h) => h.what === 'started').map((h) => h.id), ...Object.keys(p.running ?? {}), ...(parent.care?.ngPlusStart?.blueprints ?? [])]);
  return VISIBLE_PROGRAMS.filter((d) => ids.has(d.id));
};

export function ngOptions(parent) {
  const level = levelOf(parent);
  return {
    level,
    from: parent.ngPlus ?? 0,
    legacy: employed(parent).map((m) => ({ id: m.id, name: m.name, role: m.role, tier: m.tier, level: m.level, everHired: true, chain: m.counters?.legacy?.levels ?? [] })),
    legacyPicks: ngRules.picks('legacy', level),
    blueprints: programsRun(parent).map((d) => ({ id: d.id, name: d.name })),
    blueprintPicks: ngRules.picks('blueprints', level),
    discount: discountOpen(level) ? FACILITIES.filter((f) => !f.secret).map((f) => ({ id: f.id, name: f.name, cost: f.cost, pct: NG_PLUS.discount.pct })) : null,
    rpPct: researchPctOf(level),
    rp: researchRpOf(parent.care?.research?.tree?.done ?? [], level),
    living: livingOpen(level),
  };
}

export function ngSnapshot(parent, account = {}) {
  const snap = {};
  const put = (field, key, value) => ((snap[field] ??= {})[key] = value);
  for (const [k, v] of Object.entries(parent)) {
    if (k === 'care') {
      for (const [ck, cv] of Object.entries(v ?? {})) put(CARE_FIELDS[ck] ?? `care.${ck}`, ck, cv);
    } else put(RUN_FIELDS[k] ?? k, k, v);
  }
  // the chosen fields hold everything the player could pick from
  const o = ngOptions(parent);
  snap.legacyStaff = employed(parent);
  snap.blueprints = o.blueprints;
  snap.discount = Object.fromEntries((o.discount ?? []).map((d) => [d.id, { id: d.id, pct: d.pct }]));
  // §37 reset fields that live inside other parts of the save (named on purpose)
  for (const f of ['rank', 'research', 'partners', 'quality', 'programs', 'economy', 'events', 'incidents', 'endOfLife', 'homeSecrets', 'homeAchievements', 'verdicts', 'ending', 'homeLife', 'ngPlusStart', 'care', 'calendar', 'layout', 'credits', 'ledger', 'level', 'playSec', 'seed', 'facility', 'admissions', 'staff', 'guide']) snap[f] ??= null; // (Milestone 34: guide — a home saved without one)
  snap.rank = parent.care?.quality?.rep ?? null;
  // the account store: every key under its declared field
  for (const [k, v] of Object.entries(account ?? {})) put(ACCOUNT_FIELDS[k] ?? `account.${k}`, k, v);
  const sec = account.secrets?.flags ?? account.secrets?.account?.flags ?? {};
  const ach = account.achievements ?? {};
  snap.memoryBook ??= null;
  snap.secrets ??= null;
  snap.achievements ??= null;
  snap.pastHomes ??= null;
  snap.settings ??= null;
  snap.records = { secrets: sec.records ?? {}, achievements: ach.records ?? ach.bests ?? null };
  snap.prestigeTokens = Object.values(sec.rewards ?? {}).reduce((t, x) => t + (x.amount ?? 0), 0);
  snap.storyDiscoveries = account.secrets ?? null;
  snap.staffIdentities = { godsHired: sec.godsHired ?? {}, hall: (ach.hall ?? []).map((e) => e.id) };
  snap.cosmetics = { palettes: sec.palettes ?? {}, keepsakes: ach.keepsakes ?? {} };
  snap.hallOfFame = ach.hall ?? [];
  snap.trophyCase = [...(account.ngplus?.pastHomes ?? []).flatMap((h) => h.trophies ?? []), ...(parent.care?.verdicts?.trophies ?? [])];
  snap.highestNgPlus = account.ngplus?.highest ?? 0;
  return snap;
}

export function ngProblems(choices = {}, options = ngOptions({}), founderId = null) {
  const out = ngRules.checkChoices({ legacyStaff: choices.legacyStaff ?? [], blueprints: choices.blueprints ?? [] }, { legacy: options.legacy, blueprints: options.blueprints }, options.level);
  if (founderId && (choices.legacyStaff ?? []).includes(founderId)) out.push(NGPLUS_TEXT.duplicate(founderById(founderId)?.name ?? founderId));
  if (choices.discount) {
    if (!options.discount) out.push(`No discounted facility at New Game+ ${options.level}`);
    else if (!options.discount.some((d) => d.id === choices.discount)) out.push(`${choices.discount} can't be discounted`);
  }
  return out;
}

// A Legacy Staff member as they join the new home: their level, stats, traits (a god's blessing is a trait) and salary as
// they were; rested; their carry-over history grows by this level and the home they came from.
function legacyJoin(m, level, parent) {
  const was = m.counters?.legacy ?? { levels: [], mentored: [], from: [] };
  const counters = { tasks: 0, legacy: { levels: [...new Set([...(was.levels ?? []), level])].sort((a, b) => a - b), mentored: copy(was.mentored ?? []), from: [...(was.from ?? []), { home: parent.facility?.name ?? null, runId: parent.seed ?? null, ngPlus: parent.ngPlus ?? 0 }] } };
  return { ...copy(m), energy: STAFF_BALANCE.startEnergy, morale: STAFF_BALANCE.startMorale, status: { tired: false, stressed: false, inspired: false }, activity: 'idle', assigned: false, monthsUnassigned: 0, counters };
}

export function buildNgPlusRun({ parent, account = {}, choices = {}, setup, now = Date.now() }) {
  const options = ngOptions(parent);
  const problems = ngProblems(choices, options, setup?.founder);
  if (problems.length) throw new Error(problems.join(' · '));
  const level = options.level;
  const pack = ngRules.transition({ snapshot: ngSnapshot(parent, account), choices: { legacyStaff: choices.legacyStaff ?? [], blueprints: choices.blueprints ?? [], discount: choices.discount ?? null }, level });
  const data = newCampaign(setup, now); // every reset field starts fresh here
  data.ngPlus = level;
  // Legacy Staff: one who is also in the opening team (Maya, Ruby, Zoe) joins as their Legacy self instead
  const legacy = (pack.chosen.legacyStaff ?? []).map((m) => legacyJoin(m, level, parent));
  const ids = new Set(legacy.map((m) => m.id));
  const st = data.staff;
  st.staff = [...st.staff.filter((m) => !ids.has(m.id)), ...legacy];
  for (const m of st.staff) if (m.id !== st.founder.id && m.counters) delete m.counters[FOUNDER_FLAG];
  st.roster = newRosterState(st.staff);
  st.noCandidates = [...new Set([...(st.noCandidates ?? []), ...ids])];
  const disc = pack.chosen.discount ? { id: pack.chosen.discount.id, pct: pack.chosen.discount.pct, used: null } : null;
  data.care.ngPlusStart = {
    level,
    from: { home: parent.facility?.name ?? null, runId: parent.seed ?? null, ngPlus: parent.ngPlus ?? 0, grade: parent.care?.ending?.grade?.band ?? null },
    legacy: [...ids],
    blueprints: (pack.chosen.blueprints ?? []).map((b) => b.id),
    discount: disc,
    rp: options.rp,
    rpPct: options.rpPct,
    rpGiven: false,
    living: options.living,
  };
  return { data, pack, options };
}

export function accountAfterNgPlus(account = {}, parent, level) {
  const archive = new RunArchive({ max: NG_PLUS.pastHomesKept });
  archive.load(account.ngplus?.pastHomes);
  const e = parent.care?.ending;
  archive.add({ runId: parent.seed, home: parent.facility?.name ?? null, director: parent.facility?.director ?? null, ngPlus: parent.ngPlus ?? 0, year: parent.clock?.year ?? parent.date?.year ?? null, grade: e?.grade?.band ?? null, total: e?.grade?.total ?? null, trophies: (parent.care?.verdicts?.trophies ?? []).map((t) => ({ ...copy(t), home: parent.facility?.name ?? null })) });
  return { ...account, ngplus: { ...(account.ngplus ?? {}), highest: Math.max(account.ngplus?.highest ?? 0, level), pastHomes: archive.serialize() } };
}

export const blueprintName = (id) => programById(id)?.name ?? id;
export const discountName = (id) => facilityById(id)?.name ?? id;
