// Recruitment and training (Milestone 11, bible §11 / §13) on core/RecruitmentSystem and core/TrainingSystem. Pure
// rules on plain state (no walking, no drawing): the home world walks new hires in, takes trainees off the roster and
// pays through the ledger via the hooks here.
//
//   createStaffing({ state, sys, ledger, seed, bus, today, year, teamSize, trainingPlaces }) → staffing
//     state            the run's staff state (its .staffing part is made here when missing: an M10 save → a fresh board)
//     sys              the run's core/StaffSystem · ledger (src/systems/ledger.js)
//     today() / year() the game day and year · teamSize() the team without agency workers
//     trainingPlaces() places at the Training Room(s) now (F11 × 2; ?debug=1 without one)
//   staffing.board → the candidate cards · staffing.card(id) · staffing.nextFreeDay
//   staffing.channels() → [{ channel, ok, reason }] · staffing.refresh(channelId) → { ok, reason }
//   staffing.cap · staffing.canHire(cardId) → { ok, reason } · staffing.take(cardId) → the card (the world hires them)
//   staffing.tick(day)                          a new day: the free refresh every 56 days, training days
//   staffing.courses(staffId) → [{ course, ok, reason, preview, capped, specialty }] · staffing.startCourse(courseId, staffId)
//   staffing.trainingOf(staffId) · staffing.cancelTraining(staffId) · staffing.specialtiesOf(staffId)
//   staffing.setDebug(on) · staffing.serialize() (writes the core systems' state into state.staffing)
// A card: { id, channel, personId, name, role, tier, level, stats, salary, trait, shiftPref, art }.
import { RecruitmentSystem } from '../../../../core/RecruitmentSystem.js';
import { TrainingSystem } from '../../../../core/TrainingSystem.js';
import { Rng } from '../../../../core/Rng.js';
import { STAFF, staffById } from '../../data/staff.js';
import { ROLES, ROLE_IDS, STAT_IDS, TIERS } from '../../data/roles.js';
import { CHANNELS, NEVER_TIERS, TIER_FALLBACK, RECRUIT, EMPLOYEE_CAP, RANK_NOW } from '../../data/recruitment.js';
import { COURSES, courseById, SPECIALTIES, SPECIALTY_LIMIT } from '../../data/training.js';

export function newStaffingState() {
  return { recruit: null, nextFree: null, training: null, specialties: {}, departed: [], hires: [], debug: false };
}
export function ensureStaffingState(saved) {
  const s = { ...newStaffingState(), ...(saved ?? {}) };
  s.specialties = Object.fromEntries(Object.entries(s.specialties ?? {}).map(([k, v]) => [k, [...v]]));
  s.departed = [...(s.departed ?? [])];
  s.hires = [...(s.hires ?? [])];
  return s;
}
const toCoreCourse = (c) => ({ id: c.id, name: c.name, cost: c.cost, days: c.days, requires: null, effect: c.gains ? { kind: 'stats', stats: c.gains } : { kind: 'lowest', count: c.lowest.count, min: c.lowest.min, max: c.lowest.max } });
const cardOf = (d) => ({ personId: d.id, name: d.name, role: d.role, tier: d.tier, level: d.level, stats: { ...d.stats }, salary: d.salary, trait: d.traits[0], shiftPref: d.shiftPref, art: d.art });

export function createStaffing({ state, sys, ledger, seed = 'careworks', bus = null, today = () => 0, year = () => 1, teamSize = () => sys.staff.length, trainingPlaces = () => 0 }) {
  state.staffing = ensureStaffingState(state.staffing);
  const st = state.staffing;

  // --- recruitment ---------------------------------------------------------------------------------------------------
  const employed = () => new Set(sys.staff.map((m) => m.id));
  const never = () => new Set(state.noCandidates ?? []); // the Founder (bible §3.5.4) — never offered, ever
  let building = [];
  // Who may be on a card of this tier: a §12 row of that tier, not employed, never the Founder, not already on the board.
  function poolFor(tier) {
    if (NEVER_TIERS.includes(tier)) return [];
    const emp = employed();
    const no = never();
    const onBoard = new Set([...rs.cards, ...building].map((c) => c.personId));
    return STAFF.filter((d) => d.tier === tier && !emp.has(d.id) && !no.has(d.id) && !onBoard.has(d.id));
  }
  const rs = new RecruitmentSystem({
    rng: new Rng(`${seed}:recruit`),
    bus,
    channels: CHANNELS.filter((c) => c.id !== 'special').map((c) => ({ id: c.id, name: c.name, cost: c.cost, roles: ROLE_IDS, weights: c.weights })),
    boardSize: RECRUIT.boardSize,
    reappearChance: 0, // (people who left are simply back in the pool)
    autoRefresh: () => false, // (the free refresh is every 56 days: tick below)
    hooks: {
      makeCandidate(ch, tier, rng) {
        for (let t = tier; t; t = TIER_FALLBACK[t]) {
          const pool = poolFor(t);
          if (!pool.length) continue;
          const card = cardOf(rng.pick(pool));
          building.push(card);
          return card;
        }
        return { personId: null };
      },
    },
  });
  function refreshBoard(channelId, reason) {
    building = [];
    rs.refresh(channelId, reason);
    rs.board = rs.board.filter((c) => c.personId); // (nobody left of any tier the channel offers: fewer cards)
    building = [];
  }
  if (!rs.load(st.recruit)) refreshBoard(RECRUIT.freeChannel, 'start');
  if (st.nextFree == null) st.nextFree = today() + RECRUIT.freeRefreshDays;

  const channelState = (c) => {
    if (c.unlock.type === 'start') return { ok: true, reason: null };
    if (st.debug && c.unlock.type !== 'condition') return { ok: true, reason: null };
    return { ok: false, reason: c.unlock.text };
  };
  const cap = () => EMPLOYEE_CAP[RANK_NOW];

  // --- training ------------------------------------------------------------------------------------------------------
  let onDone = null;
  const ts = new TrainingSystem({
    rng: new Rng(`${seed}:train`),
    bus,
    staff: sys,
    statKeys: STAT_IDS,
    courses: COURSES.map(toCoreCourse),
    slots: [{ id: 'trainingRoom', name: 'Training Room', roles: null }],
    hooks: {
      statCap: (s) => TIERS[s.tier]?.statCap ?? 220,
      primaryStat: (s) => ROLES[s.role]?.primaryStat,
      slotCount: () => (st.debug ? Math.max(trainingPlaces(), 2) : trainingPlaces()),
      canPay: (c) => (ledger.balance >= c.cost ? null : `Not enough Credits: it costs ${c.cost.toLocaleString('en-GB')}`),
      pay: (c, s) => ledger.economy.add('credits', -c.cost, `Training: ${c.name} (${s.name})`, 'training'),
      now: () => ({ day: today(), year: year() }),
      onComplete(s, c, gains) {
        const sp = courseById(c.id)?.specialty;
        const granted = sp && grantSpecialty(s, sp);
        onDone?.(s, c, gains, granted ? sp : null);
      },
    },
  });
  ts.load(st.training);
  const specialtiesOf = (id) => st.specialties[id] ?? [];
  const limitOf = (s) => SPECIALTY_LIMIT[s.tier] ?? 1;
  function grantSpecialty(s, sp) {
    const list = specialtiesOf(s.id);
    if (list.includes(sp) || list.length >= limitOf(s)) return false;
    st.specialties[s.id] = [...list, sp];
    return true;
  }
  // Why this person can't take this course now (null: they can).
  function courseBlock(courseId, staffId) {
    const c = courseById(courseId);
    const s = sys.get(staffId);
    if (!c || !s) return 'Unknown';
    if (!c.roles.includes(s.role)) return `Only for ${c.roles.map((r) => ROLES[r].short).join(' / ')}`;
    if (!ts.slotCount({ id: 'trainingRoom' })) return 'Needs a Training Room';
    return ts.courseBlock(courseId) ?? ts.workerBlock(courseId, staffId);
  }

  const staffing = {
    recruitment: rs,
    training: ts,
    state: st,
    get board() {
      return rs.board;
    },
    card: (id) => rs.get(id),
    get nextFreeDay() {
      return st.nextFree;
    },
    get cap() {
      return cap();
    },
    get debug() {
      return !!st.debug;
    },
    setDebug(on) {
      st.debug = !!on;
    },
    channels: () => CHANNELS.map((c) => ({ channel: c, ...channelState(c) })),
    // A paid refresh from a channel (Credits through the ledger). The free one comes by itself every 56 days.
    refresh(channelId) {
      const c = CHANNELS.find((x) => x.id === channelId);
      if (!c) return { ok: false, reason: 'Unknown channel' };
      const open = channelState(c);
      if (!open.ok || c.id === 'special') return { ok: false, reason: open.reason ?? c.unlock.text };
      if (ledger.balance < c.cost) return { ok: false, reason: `Not enough Credits: a new board costs ${c.cost.toLocaleString('en-GB')}` };
      ledger.economy.add('credits', -c.cost, `Recruitment: ${c.name}`, 'recruit');
      refreshBoard(c.id, 'paid');
      return { ok: true, reason: null };
    },
    canHire(cardId) {
      const c = rs.get(cardId);
      if (!c) return { ok: false, reason: 'They are no longer on the board' };
      if (teamSize() >= cap()) return { ok: false, reason: `The team is at its cap (${cap()} at Rank ${RANK_NOW})` };
      if (employed().has(c.personId)) return { ok: false, reason: 'Already on the team' };
      return { ok: true, reason: null };
    },
    take(cardId) {
      const ok = staffing.canHire(cardId);
      if (!ok.ok) return { ...ok, card: null };
      const card = rs.take(cardId);
      st.hires.push({ id: card.personId, day: today(), channel: card.channel });
      if (st.hires.length > 40) st.hires.shift();
      return { ok: true, reason: null, card, def: staffById(card.personId) };
    },
    // Someone left the team: on record (their Familiar Care stays in the care state), and back in the pool — never
    // the Founder (state.noCandidates).
    departed(model, day, founder = false) {
      ts.cancel(model.id);
      st.departed.push({ id: model.id, name: model.name, day, founder });
      if (st.departed.length > 40) st.departed.shift();
    },
    tick(day) {
      let refreshed = false;
      while (day >= st.nextFree) {
        st.nextFree += RECRUIT.freeRefreshDays;
        refreshed = true;
      }
      if (refreshed) refreshBoard(RECRUIT.freeChannel, 'free');
      ts.dailyTick();
      return { refreshed };
    },
    onTrained(fn) {
      onDone = fn;
    },
    // Every course for this person: can they take it now, what it would add (trimmed at the tier cap), the specialty.
    courses(staffId) {
      const s = sys.get(staffId);
      return COURSES.map((c) => {
        const reason = courseBlock(c.id, staffId);
        const preview = s ? ts.preview(c.id, staffId) : [];
        const capped = preview.some((p) => p.max < p.want);
        const sp = c.specialty;
        const has = specialtiesOf(staffId).includes(sp);
        const full = s && !has && specialtiesOf(staffId).length >= limitOf(s);
        return { course: c, ok: !reason, reason, preview, capped, specialty: sp, specialtyNote: has ? 'already has it' : full ? `specialty slots full (${limitOf(s)} for ${TIERS[s.tier].name})` : null };
      });
    },
    startCourse(courseId, staffId) {
      const reason = courseBlock(courseId, staffId);
      if (reason) return { ok: false, reason };
      return ts.start(courseId, staffId);
    },
    trainingOf: (staffId) => ts.trainingOf(staffId),
    cancelTraining: (staffId) => ts.cancel(staffId),
    specialtiesOf,
    specialtyLimit: (staffId) => (sys.get(staffId) ? limitOf(sys.get(staffId)) : 0),
    specialtyName: (id) => SPECIALTIES[id]?.name ?? id,
    serialize() {
      st.recruit = rs.serialize();
      st.training = ts.serialize();
      return st;
    },
  };
  return staffing;
}
