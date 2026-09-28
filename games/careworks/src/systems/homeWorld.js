// The home's world (Milestones 1–6): the hidden grid with its inside walls, the placed rooms and facilities, the game
// clock (core/Clock on data/routine.js DAY), the residents living their daily routine, and (Milestone 3) the opening
// team on the Morning shift: they stand their posts and rest at the Staff Room off shift. Milestone 4: each band every
// resident's care plan, routine and needs make care tasks (src/systems/careTasks.js); free staff on shift pick their
// next task themselves by the bible §15 score, walk to the resident (or their room), spend the task's minutes there and
// finish it; a need over the bell line rings that resident's call bell. A routine step with a helper happens when the
// help is done. Milestone 5: the Dining Room (meals) and the Staff Room (off-shift rest), the props block their tiles,
// and each midnight 'care:dayEnd' says how the day went ({ day, done, missed }).
// Milestone 6: up to four residents, one to a Standard Room, each with their own seat at the Dining Room and the
// lounge (their room's number) and their own helpers' spots; the applicant board (src/systems/admissions.js) ticks each
// day; admit() gives a free room, walks them in from the entrance and they join the routine and the task planning from
// the next band; the ledger (src/systems/ledger.js) closes each month (fees and funding in, wages out).
// Milestone 7: three shifts (src/systems/roster.js) with floats, a wing and the Night on-call flag; Safe Coverage Points
// and the four-step fallback (src/systems/coverage.js) tick before the staff move: a warning the band before a short
// shift, float cover, agency workers (hired here: they walk in from the entrance for one shift and leave after), then
// admissions pause and the Cards activity is skipped. Missed essential tasks cost care recovery at the end of each day.
// Milestone 8: all 48 plan options with eligibility (world.eligibility / planCtx), option preferences (a disliked
// option costs a little Mood when chosen; a refused one's tasks are refused and logged as they come up), the plan
// review / stale flag (world.stalePlans, world.reviewPlan) and a new resident's first plan from their primary support.
// People walk on core/Agent (A* on core/Grid), so they only pass through doorways. No drawing here — the home screen
// draws it — so the Node tests run it as it is.
//   createHomeWorld({ founderId, clock, resident, residents, staff, care, seed, bus, admissions, ledger, startCredits, shortStaffing })
//     clock      a core/Clock (made here when missing)
//     resident   Arthur's saved state (Milestones 2–5), or residents = every resident's saved state (Milestone 6)
//     staff      the run's staff state (src/systems/staffTeam.js; none: a team is built from the Founder)
//     care       the run's care state (tasks, bells, familiarity; none: a fresh one)
//     seed       the run's seed (their daily yes / no answers, the applicants)
//     admissions / ledger   their saved states (none: a fresh board / an opening balance of startCredits)
//     shortStaffing  false: no warnings, float / agency cover, scale-back or care recovery (the older milestones' tests)
//     bus        optional: 'care:band', 'care:step', 'care:task', 'care:bell', 'care:dayEnd', 'care:admit', 'care:joined',
//                'staff:*', 'admissions:change', 'ledger:close'
//   world.update(realDt)   the clock and everyone move at the clock's speed; nothing moves while paused
//   world.hour · world.band · world.people · world.staff · world.placed · world.props · world.residents (people)
//   world.resident (Arthur, the first resident) · world.residentById(id) · world.stateOf(person) · world.whereIs(person)
//   world.assign(stepId, staffId | null, residentId?) → { ok, reason }   the "who helps" picker (pins that step's task)
//   world.chosenFor(stepId, residentId?) · world.helperFor(stepId, residentId?)
//   world.changePlan(domain, optionId, residentId?) → { ok, reason?, text? }   the Care Plan picker
//   world.care · world.tasksToday(residentId?) · world.missedToday() · world.taskOf(person)
//   world.bell (Arthur's ringing bell or null) · world.bellFor(residentId) · world.bells (every ringing bell)
//   world.bellSummary(residentId?) · world.mostFamiliar(residentId?) · world.setKeyWorker(staffId | null, residentId?)
//   world.rooms · world.freeRooms() · world.admissions · world.admitCtx() · world.admit(residentId) → { ok, reason }
//   world.ledger · world.monthRange() → { fromDay, toDay } · world.payers() / world.payroll() (the ledger's lists)
//   world.daySummary(day) → { day, done, missed }
//   world.planCtx(residentId) · world.eligibility(optionId, residentId) → { ok, reason } · world.optionPref(optionId, residentId)
//   world.staleOf(residentId) → [{ key, text }] · world.stalePlans() → [{ resident, reasons }] · world.reviewPlan(residentId)
//   world.coverage (src/systems/coverage.js) · world.team (the staff without agency workers)
//   world.moveStaff(id, shiftId | 'off') · world.setFloat(id, on) · world.setOnCall(on)
//   world.serialize() → { clock, residents, staff, care, admissions, ledger }   (the run save; the page keeps the rest)
import { Grid } from '../../../../core/Grid.js';
import { Agent } from '../../../../core/Agent.js';
import { Clock } from '../../../../core/Clock.js';
import { findPath } from '../../../../core/Pathing.js';
import { AssignmentSystem } from '../../../../core/AssignmentSystem.js';
import { StaffModel } from '../../../../core/StaffModel.js';
import { HOME, WALLS, PLACED, PROPS, RESIDENT, SPOTS, SEATS, HELP_POOLS, helpSpotsFor, ROOM_IDS, ENTRANCE } from '../../data/home.js';
import { residentById, NEEDS, supportLevel } from '../../data/residents.js';
import { DAY, ROUTINE } from '../../data/routine.js';
import { BELL } from '../../data/tasks.js';
import { ECONOMY_START, STAFF_BALANCE } from '../../data/balance.js';
import { AGENCY } from '../../data/shifts.js';
import { ensureResidentState, newResidentState, riseNeeds, driftOutcomes, routineAt, bandAt, clockText, decide, completeStep, refuseStep, addLog } from './residentNeeds.js';
import { ensureCareState, absHour, bandInstance, bandEnd, generateBand, pruneTasks, scorePair, choosePairs, closeTask, decideTask, isOpen, changePlan, maybeRing, openBell, recordResponse, bellState, bellSummary, addFamiliarity, mostFamiliar } from './careTasks.js';
import { ensureStaffState, makeStaffSystem, makeFounderPerks, contribMult, perkPct } from './staffTeam.js';
import { createRoster } from './roster.js';
import { createCoverage } from './coverage.js';
import { eligibilityOf, optionPrefOf, staleReasons, markReviewed, noteDay, admissionPlan } from './carePlanRules.js';
import { optionById, domainById, OPTION_PREF_MOOD } from '../../data/carePlans.js';
import { SHIFT_IDS } from '../../data/shifts.js';
import { createCrew } from './staffCrew.js';
import { createAdmissions } from './admissions.js';
import { createLedger } from './ledger.js';

// Every wall tile (doorways left out).
export function wallTiles() {
  const out = [];
  for (const w of WALLS) {
    for (let i = 0; i < w.len; i++) {
      if (w.gaps.includes(i)) continue;
      out.push(w.dir === 'row' ? { col: w.col + i, row: w.row, wall: w.id } : { col: w.col, row: w.row + i, wall: w.id });
    }
  }
  return out;
}

// The home's grid: inside walls, placed things (a walk-in room only where its furniture stands) and the props.
export function buildGrid() {
  const grid = new Grid({ cols: HOME.cols, rows: HOME.rows, tileSize: HOME.cellSize });
  for (const t of wallTiles()) grid.setBlocked(t.col, t.row, true);
  for (const def of PLACED) {
    if (def.walkIn) for (const b of def.blockedInside ?? []) grid.blockRect(b.col, b.row, b.w, b.h, true);
    else grid.blockRect(def.fp.col, def.fp.row, def.fp.w, def.fp.h, true);
  }
  for (const p of PROPS) grid.setBlocked(p.col, p.row, true);
  return grid;
}

// 'F05.resident' or 'hall.cwPost' → the tile.
export function spotTile(ref) {
  if (SPOTS[ref]) return SPOTS[ref];
  const [id, name] = ref.split('.');
  const t = PLACED.find((p) => p.id === id)?.spots?.[name];
  if (!t) throw new Error(`No spot ${ref}`);
  return t;
}

export function makeClock(bus = null) {
  const clock = new Clock({ bus, secondsPerDay: DAY.secondsPerDay, daysPerMonth: DAY.daysPerMonth, monthsPerYear: DAY.monthsPerYear, speeds: DAY.speeds });
  clock.speedAllowed = (s) => DAY.unlockedSpeeds.includes(s);
  clock.dayProgress = DAY.startHour / 24;
  return clock;
}

const routineStep = (id) => ROUTINE.find((s) => s.id === id) ?? null;
const first = (name) => name.split(' ')[0];
const clamp = (x) => Math.max(0, Math.min(100, x));
const stepWord = (step) => (step.activity ? step.name : step.name.toLowerCase());
const needName = (id) => NEEDS.find((n) => n.id === id)?.name ?? id;
const ARTHUR = RESIDENT.id;
// A resident's pronoun for the card lines (story data: 'his' unless the row is one of these).
const FEMALE = new Set(['RES02', 'RES04', 'RES06', 'RES08', 'RES10', 'RES12']);
export const theirOf = (id) => (FEMALE.has(id) ? 'her' : 'his');

export function createHomeWorld({ founderId = 'RN01', clock = null, resident = null, residents: savedResidents = null, staff = null, care: careSaved = null, seed = 'careworks', bus = null, admissions: admissionsSaved = null, ledger: ledgerSaved = null, startCredits = ECONOMY_START.credits, shortStaffing = true } = {}) {
  clock ??= makeClock();
  const grid = buildGrid();
  const placed = PLACED.map((def) => ({ kind: def.kind, id: def.id, def, fp: def.fp, residentId: null }));
  const props = PROPS.map((def) => ({ kind: 'prop', id: def.id, def, fp: { col: def.col, row: def.row, w: 1, h: 1 } }));
  const rooms = ROOM_IDS.map((id) => placed.find((p) => p.id === id));
  const hourNow = () => clock.dayProgress * 24;
  let band = bandAt(hourNow());

  // --- the staff (Milestone 3) -------------------------------------------------------------------------------
  const staffState = ensureStaffState(staff, founderId);
  const sys = makeStaffSystem(staffState);
  const perks = makeFounderPerks(staffState);
  const absTime = () => clock.totalDays * 24 + hourNow();
  const roster = createRoster(staffState, { abs: absTime });
  // Milestone 7: agency workers hired for a shift still under way come back with the save (their model is kept there)
  for (const a of staffState.roster.agency) if (a.model && !sys.get(a.id)) sys.add(StaffModel.fromJSON(a.model));
  staffState.roster.agency = staffState.roster.agency.filter((a) => sys.get(a.id));
  const crew = createCrew({ grid, state: staffState, sys, perks, roster, spotTile, hourNow, bandNow: () => bandAt(hourNow()), bus });

  // --- the residents ---------------------------------------------------------------------------------------------
  // A resident's person: { kind: 'resident', id, name, art, line, def, state (their saved state), agent }.
  const residents = [];
  const byResident = (id) => residents.find((p) => p.id === id) ?? null;
  const seatOf = (p) => Math.max(0, ROOM_IDS.indexOf(p.state.room));
  // Where a resident goes for a place: their room's inside spot, or their seat at the Dining Room / lounge.
  const placeRef = (p, place) => (place === 'room' ? `${p.state.room}.inside` : SEATS[place][seatOf(p)] ?? SEATS[place][0]);
  const placeTile = (p, place) => spotTile(placeRef(p, place));
  function addResident(st, { atEntrance = false } = {}) {
    const def = residentById(st.id);
    const p = { kind: 'resident', id: def.id, name: def.name, art: def.art, line: `${def.support} · age ${def.age}`, def, state: st };
    p.agent = new Agent({ id: def.id, name: def.name, speed: RESIDENT.speed, noPathTeleportSec: 3 });
    const room = placed.find((r) => r.id === st.room);
    if (room) room.residentId = def.id; // the room knows its resident
    if (st.pos) {
      p.agent.x = st.pos.x;
      p.agent.y = st.pos.y;
    } else if (atEntrance) p.agent.placeAtTile(grid, ENTRANCE.col, ENTRANCE.row);
    else if (room) {
      const t = placeTile(p, 'room');
      p.agent.placeAtTile(grid, t.col, t.row);
    }
    residents.push(p);
    return p;
  }
  const savedList = Array.isArray(savedResidents) && savedResidents.length ? savedResidents : [resident];
  for (const s of savedList) {
    const id = s?.id ?? ARTHUR;
    const def = residentById(id);
    if (!def || byResident(id)) continue;
    addResident(ensureResidentState(s, def, { room: id === ARTHUR ? RESIDENT.room : null }));
  }
  if (!byResident(ARTHUR)) addResident(newResidentState(residentById(ARTHUR), { room: RESIDENT.room }));
  // (a saved resident without a room — never expected — gets the first free one)
  for (const p of residents) {
    if (placed.find((r) => r.id === p.state.room)) continue;
    const free = rooms.find((r) => !r.residentId);
    if (free) {
      p.state.room = free.id;
      free.residentId = p.id;
      const t = placeTile(p, 'room');
      if (!p.state.pos) p.agent.placeAtTile(grid, t.col, t.row);
    }
  }
  const arthur = byResident(ARTHUR);

  // --- care tasks (Milestone 4) --------------------------------------------------------------------------------
  const care = ensureCareState(careSaved);
  const assignSys = new AssignmentSystem({ staff: sys, getJobs: () => care.tasks.filter((t) => t.status === 'claimed' || t.status === 'working') });
  const absNow = () => absHour(clock.totalDays, hourNow());
  const now = () => clockText(hourNow());
  const logDay = () => routineAt(hourNow(), clock.totalDays).day;
  const log = (p, text) => addLog(p.state, logDay(), now(), text);
  const rolesOnShift = (bandId) => new Set(crew.people.filter((q) => roster.coversBand(q.id, bandId)).map((q) => q.role));
  const stepIndex = (id) => ROUTINE.findIndex((s) => s.id === id);
  const joined = (p) => p.state.joinAt == null || absNow() >= p.state.joinAt;
  // The step has already run today (or is under way and past needing help).
  const stepOverFor = (p) => (stepId, day) => {
    const st = p.state;
    if (!st.step) return false;
    if (st.step.day !== day) return st.step.day > day;
    const cur = stepIndex(st.step.id);
    const idx = stepIndex(stepId);
    return cur > idx || (cur === idx && (st.step.status === 'doing' || st.step.status === 'refused' || st.step.status === 'missed'));
  };
  const routineTask = (p, stepId, day) => care.tasks.find((t) => t.source === 'routine' && t.stepId === stepId && t.day === day && t.resident === p.id) ?? null;
  // Where a resident is (or is going): their current step's place, or their room.
  const residentPlace = (p) => {
    const st = p.state;
    const step = st.step && routineStep(st.step.id);
    return !step || !joined(p) || st.step.status === 'refused' || st.step.status === 'missed' ? 'room' : step.place;
  };
  const taskPlace = (t) => {
    const p = byResident(t.resident);
    return t.place === 'room' ? 'room' : t.place === 'step' ? routineStep(t.stepId).place : p ? residentPlace(p) : 'room';
  };
  // The spots a helper may use beside this resident at a place: in their room its two; at a shared place the pool,
  // nearest their seat first.
  function helpPool(p, place) {
    const pool = helpSpotsFor(place, p.state.room);
    if (place === 'room') return pool;
    const seat = placeTile(p, place);
    const d = (ref) => {
      const t = spotTile(ref);
      return Math.abs(t.col - seat.col) + Math.abs(t.row - seat.row);
    };
    return [...pool].sort((a, b) => d(a) - d(b));
  }
  // The helper's spot for a task: the nearest one in the pool nobody else is going to.
  function spotFor(t, staffId) {
    const p = byResident(t.resident) ?? arthur;
    const pool = helpPool(p, taskPlace(t));
    return pool.find((ref) => !crew.people.some((q) => q.id !== staffId && q.task && q.task.spot === ref)) ?? pool[0];
  }
  const label = (t) => (t.source === 'routine' ? stepWord(routineStep(t.stepId)) : t.name.charAt(0).toLowerCase() + t.name.slice(1));
  const taskInfo = (t) => ({ id: t.id, type: t.type, label: label(t), room: t.place === 'room', resident: t.resident, who: first(byResident(t.resident)?.name ?? 'Arthur') });
  // The "who helps" picker's pins: Arthur's keep their Milestone 3 keys (the step id), others are 'RESnn:step'.
  const pinKey = (residentId, stepId) => (residentId === ARTHUR ? stepId : `${residentId}:${stepId}`);
  const pinOf = (t) => {
    const id = t.source === 'routine' ? staffState.assignments[pinKey(t.resident, t.stepId)] : t.pinned;
    const q = id && crew.byId(id);
    return q && roster.onShift(q.id) ? q.id : null;
  };
  const tilesBetween = (q, ref) => {
    const from = grid.worldToTile(q.agent.x, q.agent.y);
    const to = spotTile(ref);
    const path = from && findPath(grid, from, to);
    return path ? path.length : from ? Math.abs(from.col - to.col) + Math.abs(from.row - to.row) : 0;
  };
  const assignedTo = (staffId, p) => {
    const wing = roster.wingOf(staffId);
    return care.keyWorkers[p.id] === staffId || (!!wing && wing === roster.wingOfRoom(p.state.room));
  };
  function scoreFor(t, q) {
    if (!t.roles.includes(q.role)) return null; // (scorePair says so too; this skips the path search)
    const pin = pinOf(t);
    if (pin && pin !== q.id) return null;
    if (!pin && t.type !== 'bell' && crew.tooTired(q)) return null;
    const p = byResident(t.resident) ?? arthur;
    // "Is this resident assigned to me" (bible §15): their key worker, or (Milestone 7) staff on the resident's wing
    const assigned = assignedTo(q.id, p);
    return scorePair({
      task: { ...t, pinned: pin },
      person: { id: q.id, role: q.role, energy: q.model.energy },
      tiles: tilesBetween(q, helpPool(p, taskPlace(t))[0]),
      keyWorker: assigned ? q.id : care.keyWorkers[t.resident] ?? null,
      mostFamiliar: mostFamiliar(care, t.resident, crew.people.map((x) => x.id)),
      doneThisBand: q.bandDone ?? 0,
    });
  }
  function claim(t, q) {
    t.status = 'claimed'; // first, so core/AssignmentSystem counts it as a job when it marks them assigned
    assignSys.assign(t, q.id);
    t.reached = false;
    const p = byResident(t.resident);
    if (p && t.source === 'routine' && isCurrent(p, routineStep(t.stepId), t.day)) p.state.step.helper = q.id;
    crew.startTask(q.id, taskInfo(t), spotFor(t, q.id));
    bus?.emit('care:task', { id: t.id, type: t.type, status: 'claimed', staff: q.id, resident: t.resident });
  }
  function unclaim(t) {
    const id = t.slots[0];
    if (id) assignSys.unassign(t, id);
    t.slots = [null];
    t.reached = false;
    if (id && crew.byId(id)?.task?.id === t.id) crew.releaseTask(id);
    const p = byResident(t.resident);
    if (p && t.source === 'routine' && p.state.step?.helper === id) p.state.step.helper = null;
  }
  // A task is over without being done (missed, refused, they managed on their own): let its helper go.
  function finish(t, status) {
    unclaim(t);
    closeTask(care, t, status);
    if (status === 'missed' && t.essential) coverage?.recordMissed(); // care recovery (Milestone 7)
    bus?.emit('care:task', { id: t.id, type: t.type, status, resident: t.resident });
  }
  const helperName = (id) => first(crew.byId(id)?.name ?? id);
  function applyEffects(p, t, helper) {
    const st = p.state;
    for (const [need, v] of Object.entries(t.drops ?? {})) st.needs[need] = clamp(st.needs[need] - v * contribMult(perks, helper, need));
    for (const [o, v] of Object.entries(t.outcomes ?? {})) st.outcomes[o] = clamp(st.outcomes[o] + v);
  }
  function completeTask(t, q) {
    const helper = q.id;
    const p = byResident(t.resident);
    if (p) {
      if (t.source === 'routine') completeRoutine(p, { ...routineStep(t.stepId), drops: t.drops }, t.day, helper);
      else {
        applyEffects(p, t, helper);
        if (t.type === 'bell') bellState(care, t.resident).cooldownUntil = absNow() + BELL.cooldownHours;
        else log(p, `${t.name} (with ${helperName(helper)})`);
      }
    }
    assignSys.unassign(t, helper);
    closeTask(care, t, 'done');
    t.slots = [helper];
    if (!q.agency) addFamiliarity(care, t.resident, helper); // agency workers build no Familiar Care (bible §14)
    crew.finishTask(helper);
    bus?.emit('care:task', { id: t.id, type: t.type, status: 'done', staff: helper, resident: t.resident });
  }

  // --- the routine ---------------------------------------------------------------------------------------------
  // st.step = { id, day, status: 'walking' | 'waiting' | 'doing' | 'refused' | 'missed', helper, arthurThere (the
  // resident is there — the Milestone 2 name kept for saves) }
  const isCurrent = (p, step, day) => !!step && p.state.step?.id === step.id && p.state.step.day === day;
  function completeRoutine(p, step, day, helper, note = null) {
    const st = p.state;
    const dropped = completeStep(st, step, day, now(), {
      needMult: helper ? (need) => contribMult(perks, helper, need) : null,
      activityMult: 1 + perkPct(perks, helper, 'activityWellbeingPct') / 100,
      mealMult: 1 + perkPct(perks, helper, 'mealSatisfactionPct') / 100,
      note: helper ? `with ${helperName(helper)}` : note,
    });
    if (isCurrent(p, step, day)) {
      st.step.status = 'doing';
      st.step.dropped = dropped;
      st.step.helper = helper;
    }
    bus?.emit('care:step', { resident: st.id, step: step.id, status: 'done', helper });
  }
  // Help can come if the step has a task that someone on shift now could take (or someone is already on it).
  const helpCanCome = (t) => !!t && isOpen(t) && (t.status !== 'open' || crew.people.some((q) => t.roles.includes(q.role) && roster.onShift(q.id)));
  function arrived(p, step, day) {
    if (!isCurrent(p, step, day)) return;
    const st = p.state;
    st.step.arthurThere = true;
    if (st.step.status === 'doing') return;
    const t = routineTask(p, step.id, day);
    if (helpCanCome(t)) {
      st.step.status = 'waiting';
      return;
    }
    // No one on shift who could help (or no task for this step): they manage on their own, as before Milestone 4.
    if (t && isOpen(t)) finish(t, 'self');
    completeRoutine(p, step, day, null);
  }
  function walkResident(p, step, day) {
    const t = placeTile(p, step.place);
    const here = grid.worldToTile(p.agent.x, p.agent.y);
    if (here && here.col === t.col && here.row === t.row && p.agent.state !== 'walking') return arrived(p, step, day);
    p.agent.walkTo(grid, t.col, t.row, () => arrived(p, step, day));
  }
  // The step before is over. Help under way finishes now; help that never came is a missed task (no drops: their need
  // keeps rising) when someone could have come, else they managed on their own.
  function closePrevious(p) {
    const s = p.state.step;
    if (!s || s.status === 'doing' || s.status === 'refused' || s.status === 'missed') return;
    const step = routineStep(s.id);
    const t = routineTask(p, s.id, s.day);
    if (t?.status === 'working') {
      const q = crew.byId(t.slots[0]);
      if (q) return completeTask(t, q);
    }
    if (t && isOpen(t) && t.staffable) {
      finish(t, 'missed');
      s.status = 'missed';
      s.helper = null;
      log(p, `Missed: ${step.name} (no help came)`);
      return;
    }
    if (t && isOpen(t)) finish(t, 'self');
    if (s.arthurThere && step) completeRoutine(p, step, s.day, null, p.id === ARTHUR ? 'on his own' : 'on their own');
  }
  function startStep(p, step, day) {
    const st = p.state;
    closePrevious(p);
    const t = routineTask(p, step.id, day);
    // Milestone 7, fallback step 4: short-staffed, so the day's activity is scaled back (never held against them)
    if (step.activity && coverage.skipsActivity(day)) {
      st.step = { id: step.id, day, status: 'refused', scaled: true, helper: null };
      if (t && isOpen(t)) finish(t, 'scaled');
      addLog(st, day, now(), 'Activities scaled back — short-staffed');
      const r = placeTile(p, 'room');
      p.agent.walkTo(grid, r.col, r.row);
      bus?.emit('care:step', { resident: st.id, step: step.id, status: 'scaled' });
      return;
    }
    const answer = decide(st, step, day, seed);
    if (answer === 'refuse') {
      st.step = { id: step.id, day, status: 'refused', helper: null };
      if (t && isOpen(t)) finish(t, 'refused'); // a refused task ends here: logged, never retried this band
      refuseStep(st, step, day, now());
      const r = placeTile(p, 'room'); // they stay in (or go back to) their room
      p.agent.walkTo(grid, r.col, r.row);
      bus?.emit('care:step', { resident: st.id, step: step.id, status: 'refused' });
      return;
    }
    st.step = { id: step.id, day, status: 'walking', helper: t?.slots[0] ?? null, arthurThere: false };
    bus?.emit('care:step', { resident: st.id, step: step.id, status: 'started' });
    walkResident(p, step, day);
  }
  // After a load: carry on with the step they were in the middle of (or the walk in), and send everyone back to their
  // tasks.
  for (const p of residents) {
    const st = p.state;
    if (!joined(p)) {
      const r = placeTile(p, 'room');
      p.agent.walkTo(grid, r.col, r.row);
    } else if (st.step && (st.step.status === 'walking' || st.step.status === 'waiting')) {
      const step = routineStep(st.step.id);
      if (step && !st.step.arthurThere) walkResident(p, step, st.step.day);
    }
  }
  for (const t of care.tasks) {
    if (t.status !== 'claimed' && t.status !== 'working') continue;
    const q = crew.byId(t.slots[0]);
    if (!q || !byResident(t.resident)) {
      t.status = 'open';
      t.slots = [null];
      continue;
    }
    crew.resumeTask(q.id, taskInfo(t), t.spot ?? spotFor(t, q.id), !!t.arrived);
  }
  assignSys.refresh();

  // Milestone 8: a task from an option they refuse is refused the moment it comes up — logged on their card.
  function logRefused(p, tasks) {
    for (const t of tasks ?? []) {
      if (!t.optionRefused) continue;
      log(p, `Refused: ${label(t)} (${optionById(t.optionId)?.name ?? 'plan option'})`);
      bus?.emit('care:task', { id: t.id, type: t.type, status: 'refused', resident: t.resident });
    }
  }
  // Each frame: plan the band's tasks, ring bells, close what is overdue, move the work on, and let free staff pick.
  const REACH = 1.6 * HOME.cellSize; // "at their side" while they are walking
  function tickTasks(hours) {
    const at = absNow();
    const inst = bandInstance(hourNow(), clock.totalDays);
    if (!care.gen[inst.key]) {
      care.gen[inst.key] = true;
      pruneTasks(care, clock.totalDays);
      for (const p of residents) if (joined(p)) logRefused(p, generateBand({ care, st: p.state, band: inst.band, day: inst.day, now: at, rolesOnShift, stepOver: stepOverFor(p) }));
    }
    for (const p of residents) {
      if (!joined(p)) continue;
      const bell = maybeRing(care, p.state, at, clock.totalDays);
      if (bell) {
        log(p, `Rang the call bell (${needName(bell.need)})`);
        bus?.emit('care:bell', { resident: p.id, need: bell.need, status: 'ring' });
      }
    }
    const current = new Set(residents.map((p) => (p.state.step ? routineTask(p, p.state.step.id, p.state.step.day) : null)).filter(Boolean));
    for (const t of care.tasks) {
      if (current.has(t) || t.type === 'bell' || !(t.status === 'open' || t.status === 'claimed') || t.due > at) continue;
      const missed = t.staffable;
      finish(t, missed ? 'missed' : 'unstaffed');
      const p = byResident(t.resident);
      if (missed && p) log(p, `Missed: ${t.name}`);
    }
    // work under way
    for (const t of care.tasks) {
      if (t.status !== 'claimed' && t.status !== 'working') continue;
      const q = crew.byId(t.slots[0]);
      const p = byResident(t.resident);
      if (!q || q.task?.id !== t.id || !p) {
        // their shift ended (or they were sent elsewhere): back on the board
        if (q) assignSys.unassign(t, q.id);
        t.status = 'open';
        t.slots = [null];
        t.reached = false;
        continue;
      }
      if (t.place === 'resident') {
        const pool = helpPool(p, residentPlace(p));
        if (!pool.includes(q.task.spot)) crew.retarget(q.id, spotFor(t, q.id));
      }
      if (!t.reached) {
        let reached;
        if (t.place === 'room') reached = q.task.arrived;
        else if (t.place === 'step') reached = q.task.arrived && isCurrent(p, routineStep(t.stepId), t.day) && !!p.state.step.arthurThere;
        else reached = (q.task.arrived && p.agent.state !== 'walking') || Math.hypot(q.agent.x - p.agent.x, q.agent.y - p.agent.y) <= REACH;
        if (!reached) continue;
        t.reached = true;
        if (t.type === 'bell') {
          const minutes = Math.round((at - t.ringAt) * 60);
          recordResponse(care, t.resident, { day: clock.totalDays, t: now(), minutes, staffId: q.id, need: t.need });
          log(p, `Call bell answered by ${helperName(q.id)} (${minutes} min)`);
          bus?.emit('care:bell', { resident: p.id, status: 'answered', staff: q.id, minutes });
        }
        if (decideTask(p.state, t, seed) === 'refuse') {
          finish(t, 'refused'); // they said no: it ends cleanly and is not tried again this band
          log(p, `Said no to ${label(t)}`);
          continue;
        }
        t.status = 'working';
      }
      t.workLeft -= hours;
      if (t.workLeft <= 1e-9) completeTask(t, q);
    }
    // free staff pick their next task (bible §15 order: src/systems/careTasks.js scorePair)
    const bandId = bandAt(hourNow()).id;
    const shiftRoles = new Set(crew.people.filter((q) => roster.onShift(q.id)).map((q) => q.role));
    const avail = care.tasks.filter((t) => t.status === 'open' && t.opens <= at && byResident(t.resident));
    for (const t of avail) if (t.roles.some((r) => shiftRoles.has(r))) t.staffable = true;
    const free = crew.people.filter((q) => crew.isFree(q));
    if (!avail.length || !free.length) return;
    for (const { task, person } of choosePairs(avail, free, scoreFor)) claim(task, person);
  }

  // --- admissions and money (Milestone 6) -----------------------------------------------------------------------
  const admissions = createAdmissions({ saved: admissionsSaved, seed });
  const ledger = createLedger({ saved: ledgerSaved, bus, now: () => clock.totalDays, startCredits });
  const inHome = () => new Set(residents.map((p) => p.id));
  const freeRooms = () => rooms.filter((r) => !r.residentId);
  const team = () => crew.people.filter((q) => !q.agency);
  const teamRoles = () => new Set(team().map((q) => q.role));
  const admitCtx = () => ({ roles: teamRoles(), freeRooms: freeRooms().map((r) => r.id), day: clock.totalDays, placeable: new Set(['RM01']), paused: coverage.admissionsPaused() });
  const monthRange = (endDay = null) => {
    const len = clock.daysPerMonth;
    const toDay = endDay ?? (Math.floor(clock.totalDays / len) + 1) * len;
    return { fromDay: toDay - len, toDay };
  };
  const payers = () => residents.map((p) => ({ id: p.id, name: p.name, level: supportLevel(p.def), admittedDay: p.state.admittedDay ?? 0 }));
  const payroll = () => team().map((q) => ({ id: q.id, name: q.name, salary: q.model.salary })); // agency is paid per shift
  // --- care-plan rules (Milestone 8) -------------------------------------------------------------------------------
  const PLACEABLE_ROOMS = new Set(['RM01']); // room templates the home can place (Build Mode, Milestone 10)
  const facilityIds = () => new Set(placed.filter((x) => x.kind !== 'room').map((x) => x.id));
  // What an option's eligibility rule reads: the resident, the team and roster, the rooms / facilities / programs.
  function planCtx(p) {
    const shiftRoles = Object.fromEntries(SHIFT_IDS.map((sid) => [sid, new Set()]));
    const shiftCounts = Object.fromEntries(SHIFT_IDS.map((sid) => [sid, 0]));
    for (const q of team()) {
      const sid = roster.shiftOf(q.id)?.id;
      if (!shiftRoles[sid]) continue;
      shiftRoles[sid].add(q.role);
      shiftCounts[sid]++;
    }
    return { name: p.name, needs: p.state.needs, level: supportLevel(p.def), support: p.def.support, stay: p.def.stay, visitors: p.def.visitors, teamRoles: teamRoles(), shiftRoles, shiftCounts, rooms: PLACEABLE_ROOMS, facilities: facilityIds(), programs: new Set() };
  }
  // End of a day: who had essential care missed (a run of such days makes their plan stale).
  function noteMissed(day) {
    for (const p of residents) {
      if (!joined(p)) continue;
      noteDay(p.state, day, care.tasks.some((t) => t.resident === p.id && t.day === day && t.status === 'missed' && t.essential));
    }
  }
  // A plan never reviewed on this save (a new game, or an M7-era save): reviewed as of now, not stale.
  for (const p of residents) if (p.state.review == null) markReviewed(p.state, clock.totalDays);
  const tickAdmissions = (day) => {
    const r = admissions.tick(day, { inHome: inHome() });
    if (r.left.length || r.arrived.length) bus?.emit('admissions:change', { day, left: r.left.map((a) => a.id), arrived: r.arrived.map((a) => a.id) });
    return r;
  };
  tickAdmissions(clock.totalDays); // a new home (or an older save) gets its first board
  // A new day: the day's beat, the Founder's days, the board; a new month: the ledger's close for the month just ended.
  function newDay(day) {
    staffState.founder.history.daysEmployed += 1;
    bus?.emit('care:dayEnd', world.daySummary(day - 1));
    if (shortStaffing) coverage.dayEnd(day - 1); // care recovery for yesterday's missed essential tasks (Milestone 7)
    noteMissed(day - 1); // Milestone 8: the missed-essential streak (plan review)
    tickAdmissions(day);
    if (day % clock.daysPerMonth === 0) {
      const d = clock.dateOf(day - 1);
      ledger.closeMonth({ month: `Month ${d.month}, Year ${d.year}`, ...monthRange(day), residents: payers(), staff: payroll() });
    }
  }

  // --- rostering and Safe Coverage (Milestone 7) -----------------------------------------------------------------
  // An agency worker for one shift instance: generic art, tagged AGENCY, walks in from the front entrance.
  function hire(role, inst) {
    const cs = staffState.coverage;
    const def = AGENCY[role];
    const id = `AGY${cs.nextAgency++}`;
    const model = new StaffModel({ id, name: def.name, role, tier: 'standard', level: 1, stats: { ...def.stats }, salary: 0, art: def.art, energy: STAFF_BALANCE.startEnergy, morale: STAFF_BALANCE.startMorale, traits: [], counters: { tasks: 0, agency: true } });
    sys.add(model);
    staffState.roster.agency.push({ id, name: def.name, role, art: def.art, shift: inst.shift, key: inst.key, start: inst.start, end: inst.end, model: null });
    const q = crew.addPerson(model, { agency: true });
    world.people.push(q);
    return q;
  }
  // They walked out: gone from the team, the roster and the home.
  function dropGone() {
    for (const q of crew.people.filter((x) => x.gone)) {
      for (const t of care.tasks) if ((t.status === 'claimed' || t.status === 'working') && t.slots[0] === q.id) unclaim(t);
      crew.remove(q.id);
      sys.remove(q.id);
      const i = world.people.indexOf(q);
      if (i >= 0) world.people.splice(i, 1);
      staffState.roster.agency = staffState.roster.agency.filter((a) => a.id !== q.id);
      delete staffState.pos[q.id];
      delete staffState.modes[q.id];
      bus?.emit('staff:agencyLeft', { id: q.id });
    }
  }
  const coverage = createCoverage({
    state: staffState,
    roster,
    team: () => crew.people,
    levels: () => residents.map((p) => supportLevel(p.def)),
    ledger,
    abs: absTime,
    hire,
    bus,
  });

  let lastDay = clock.totalDays;
  const world = {
    grid,
    placed,
    props,
    rooms,
    residents,
    people: [...residents, ...crew.people],
    staff: crew.people,
    get team() {
      return team();
    },
    coverage,
    get resident() {
      return arthur;
    },
    worker: crew.people[0], // the Founder (Milestones 1–2 had one worker)
    founder: { id: staffState.founder.id, name: crew.byId(staffState.founder.id)?.name },
    staffState,
    staffSystem: sys,
    perks,
    roster,
    crew,
    clock,
    admissions,
    ledger,
    get hour() {
      return hourNow();
    },
    get band() {
      return band;
    },
    // Asleep: settled for the night (Arthur, or anyone given).
    get asleep() {
      return world.isAsleep(arthur);
    },
    isAsleep: (p) => p.state.step?.id === 'settle' && p.state.step.status === 'doing',
    joined,
    residentById: byResident,
    update(dt) {
      if (clock.paused) return;
      const g = dt * clock.speed; // game-seconds at 1×
      clock.update(dt);
      const hours = (g / clock.secondsPerDay) * 24;
      while (lastDay < clock.totalDays) newDay(++lastDay);
      for (const p of residents) {
        riseNeeds(p.state, hours, world.isAsleep(p));
        driftOutcomes(p.state, hours);
      }
      const b = bandAt(hourNow());
      if (b !== band) {
        band = b;
        crew.newBand();
        bus?.emit('care:band', { band: b.id });
      }
      if (shortStaffing) coverage.tick(); // Milestone 7: warnings, float / agency cover, scale-back — before anyone moves
      crew.update(g, hours);
      dropGone();
      for (const p of residents) {
        if (p.state.joinAt != null) {
          if (!joined(p)) continue;
          delete p.state.joinAt; // settled in: from this band they live the routine
          bus?.emit('care:joined', { resident: p.id });
        }
        const r = routineAt(hourNow(), clock.totalDays);
        if (!p.state.step || p.state.step.id !== r.step.id || p.state.step.day !== r.day) startStep(p, r.step, r.day);
      }
      tickTasks(hours);
      for (const p of residents) p.agent.update(g, grid);
    },
    // Resident card's picker: choose who helps with a step (null = automatic). A role that doesn't fit is refused.
    assign(stepId, staffId, residentId = ARTHUR) {
      const step = routineStep(stepId);
      if (!step) return { ok: false, reason: 'No such step.' };
      const key = pinKey(residentId, stepId);
      if (staffId == null) {
        delete staffState.assignments[key];
        return { ok: true, reason: null };
      }
      const r = crew.canHelp(staffId, step);
      if (r.ok) staffState.assignments[key] = staffId;
      return r;
    },
    chosenFor: (stepId, residentId = ARTHUR) => staffState.assignments[pinKey(residentId, stepId)] ?? null,
    // Who helps with a step today: whoever has its task, else who would pick it by score if it were open now.
    helperFor(stepId, residentId = ARTHUR) {
      const step = routineStep(stepId);
      const p = byResident(residentId);
      if (!step || !p) return null;
      const day = routineAt(hourNow(), clock.totalDays).day;
      const t = routineTask(p, stepId, day);
      if (t && (t.status === 'claimed' || t.status === 'working' || t.status === 'done')) return t.slots[0];
      const probe = t ?? { id: 'probe', source: 'routine', stepId, type: 'meal', urgency: 3, roles: step.roles, place: 'step', opens: 0, resident: p.id };
      const onShift = crew.people.filter((q) => roster.onShift(q.id, hourNow(), bandAt(hourNow()).id));
      return choosePairs([probe], onShift, scoreFor)[0]?.person.id ?? null;
    },
    // --- Milestone 4 -------------------------------------------------------------------------------------------
    care,
    changePlan(domain, optionId, residentId = ARTHUR) {
      const p = byResident(residentId);
      if (!p) return { ok: false, reason: 'No such resident.' };
      // Milestone 8: only an eligible option (the current one may stay even if its rule no longer passes)
      if (p.state.plan?.[domain] !== optionId) {
        const el = eligibilityOf(optionId, planCtx(p));
        if (!el.ok) return { ok: false, reason: el.reason };
      }
      const inst = bandInstance(hourNow(), clock.totalDays);
      const r = changePlan(care, p.state, domain, optionId, { day: inst.day, band: inst.band, now: absNow(), rolesOnShift, stepOver: stepOverFor(p), roleOf: (id) => crew.byId(id)?.role });
      // anyone whose task was taken away or no longer fits goes back to their post
      for (const q of crew.people) {
        const t = q.task && care.tasks.find((x) => x.id === q.task.id);
        if (q.task && (!t || t.slots[0] !== q.id)) crew.releaseTask(q.id);
      }
      assignSys.refresh();
      if (r.ok && r.changed) {
        log(p, r.text);
        logRefused(p, care.tasks.filter((t) => t.resident === p.id && t.optionId === optionId && t.optionRefused && t.day === inst.day));
        // Milestone 8: choosing an option they dislike costs a little Mood (a preferred one lifts it)
        const pref = optionPrefOf(p.state, optionId);
        const mood = OPTION_PREF_MOOD[pref] ?? 0;
        if (mood) {
          p.state.outcomes.mood = clamp(p.state.outcomes.mood + mood);
          log(p, pref === 'dislike' ? `Unhappy with ${optionById(optionId).name} (Mood ${mood})` : `Pleased with ${optionById(optionId).name} (Mood +${mood})`);
        }
        r.mood = mood;
        bus?.emit('care:plan', { resident: p.id, domain, option: optionId });
      }
      return r;
    },
    // --- Milestone 8 ------------------------------------------------------------------------------------------
    planCtx: (residentId = ARTHUR) => (byResident(residentId) ? planCtx(byResident(residentId)) : null),
    eligibility(optionId, residentId = ARTHUR) {
      const p = byResident(residentId);
      return p ? eligibilityOf(optionId, planCtx(p)) : { ok: false, reason: 'No such resident.' };
    },
    optionPref: (optionId, residentId = ARTHUR) => optionPrefOf(byResident(residentId)?.state, optionId),
    staleOf: (residentId = ARTHUR) => (byResident(residentId) ? staleReasons(byResident(residentId).state, clock.totalDays) : []),
    stalePlans: () => residents.map((p) => ({ resident: p.id, reasons: staleReasons(p.state, clock.totalDays) })).filter((x) => x.reasons.length),
    // Review: confirm (or change) the options, then tap Reviewed. The Founder's history counts it when they are on
    // shift to take part (the RN on shift leads the review).
    reviewPlan(residentId = ARTHUR) {
      const p = byResident(residentId);
      if (!p) return { ok: false, reason: 'No such resident.' };
      markReviewed(p.state, clock.totalDays);
      const f = staffState.founder;
      const founderOn = roster.onShift(f.id);
      if (founderOn) f.history.carePlanReviews = (f.history.carePlanReviews ?? 0) + 1;
      log(p, founderOn ? `Care plan reviewed (with ${helperName(f.id)})` : 'Care plan reviewed');
      bus?.emit('care:review', { resident: p.id, founder: founderOn });
      return { ok: true, reason: null, founder: founderOn };
    },
    // Today's tasks for a resident (Arthur by default), in the order they open (the card's list).
    tasksToday(residentId = ARTHUR) {
      const day = clock.totalDays;
      return care.tasks.filter((t) => t.resident === residentId && t.day === day).sort((a, b) => a.opens - b.opens);
    },
    // Every resident's missed tasks today (the Care badge).
    missedToday() {
      const day = clock.totalDays;
      return care.tasks.filter((t) => t.day === day && t.status === 'missed' && byResident(t.resident));
    },
    taskOf: (q) => (q.task ? care.tasks.find((t) => t.id === q.task.id) ?? null : null),
    get bell() {
      return openBell(care, ARTHUR);
    },
    bellFor: (residentId) => openBell(care, residentId),
    get bells() {
      return residents.map((p) => openBell(care, p.id)).filter(Boolean);
    },
    bellSummary: (residentId = ARTHUR) => bellSummary(care, residentId),
    mostFamiliar: (residentId = ARTHUR) => mostFamiliar(care, residentId, crew.people.map((q) => q.id)),
    setKeyWorker(staffId, residentId = ARTHUR) {
      if (staffId == null) delete care.keyWorkers[residentId];
      else care.keyWorkers[residentId] = staffId;
    },
    // What they are doing, for their card.
    stateOf(p) {
      if (p.kind === 'staff') return crew.stateOf(p);
      const st = p.state;
      const who = theirOf(p.id);
      if (!joined(p)) return p.agent.state === 'walking' ? `Arriving: walking to ${who} room` : `Settling in to ${who} room`;
      const step = st.step && routineStep(st.step.id);
      if (!step) return `In ${who} room`;
      if (st.step.scaled) return `In ${who} room: activities scaled back today (short-staffed)`;
      if (st.step.status === 'refused') return `Chose to stay in ${who} room (said no to ${step.activity ? step.name : step.name.toLowerCase()})`;
      if (st.step.status === 'missed') return `No help came for ${stepWord(step)}`;
      const helper = st.step.helper ? first(crew.byId(st.step.helper)?.name ?? '') : null;
      const t = routineTask(p, step.id, st.step.day);
      const going = step.going.replace(/\bhis\b/g, who);
      const doing = step.doing.replace(/\bhis\b/g, who);
      if (st.step.status === 'waiting' && helper && t?.status === 'working') return `${doing} · ${helper} is helping`;
      if (st.step.status === 'waiting') return helper ? `Waiting for ${helper} (${stepWord(step)})` : `Waiting for help (${stepWord(step)})`;
      if (st.step.status === 'walking') return helper ? `${going} · ${helper} is coming` : going;
      return helper ? `${doing} · with ${helper}` : doing;
    },
    // Which place a person is at right now (its id), or null while walking.
    whereIs(p) {
      if (p.agent.state === 'walking') return null;
      const t = grid.worldToTile(p.agent.x, p.agent.y);
      if (p.kind === 'staff') {
        const hit = placed.find((s) => Object.values(s.def.spots ?? {}).some((x) => x.col === t?.col && x.row === t?.row));
        if (hit && hit.kind !== 'room') return hit.id;
        if (p.mode === 'resting') return 'F08'; // the Staff Room's rest spots
        const ref = p.task?.spot;
        if (ref && HELP_POOLS.dining.includes(ref)) return 'F03';
        if (ref && HELP_POOLS.lounge.includes(ref)) return 'F05';
        if (hit) return hit.id;
        return t && t.row >= 11 && t.col <= 11 ? 'F05' : null; // anywhere in the lounge
      }
      const place = residentPlace(p);
      if (place === 'room') return p.state.room;
      return SEATS[place][0].split('.')[0];
    },
    byId: (id) => world.people.find((p) => p.id === id) ?? placed.find((s) => s.id === id) ?? null,
    // How a day went (Milestone 5's end-of-day beat): care tasks done and missed that day, every resident (bells not
    // counted; a task no one on shift could do is not a miss).
    daySummary(day) {
      const tasks = care.tasks.filter((t) => t.day === day && t.type !== 'bell');
      return { day, done: tasks.filter((t) => t.status === 'done').length, missed: tasks.filter((t) => t.status === 'missed').length };
    },
    // --- Milestone 7 ------------------------------------------------------------------------------------------
    // Move someone to a shift (or 'off'); a float toggle; the Night on-call flag. → { ok, reason }
    moveStaff(id, shiftId) {
      if (roster.isAgency(id)) return { ok: false, reason: 'Agency cover is booked for this shift only.' };
      return roster.move(id, shiftId) ? { ok: true, reason: null } : { ok: false, reason: 'No such shift.' };
    },
    setFloat: (id, on) => ({ ok: roster.setFloat(id, on), reason: null }),
    setOnCall: (on) => roster.setOnCall(on),
    // The task AI's second rule: their key worker, or staff on the resident's wing (not floats, not agency).
    assignedTo: (staffId, residentId) => !!byResident(residentId) && assignedTo(staffId, byResident(residentId)),
    // --- Milestone 6 ------------------------------------------------------------------------------------------
    freeRooms,
    admitCtx,
    monthRange: () => monthRange(),
    payers,
    payroll,
    // Admit an applicant: the first free room, a state from their (varied) assessment, the walk in from the entrance.
    // They join the routine and the task planning from the next band.
    admit(residentId) {
      const r = admissions.admit(residentId, admitCtx());
      if (!r.ok) return r;
      const app = r.applicant;
      const def = residentById(app.id);
      const room = freeRooms()[0];
      const st = newResidentState(def, { room: room.id });
      st.needs = { ...app.needs };
      st.outcomes = { ...app.outcomes };
      st.admittedDay = clock.totalDays;
      // Milestone 8: a first plan from their primary support, and a first review due (the plan starts stale)
      st.plan = admissionPlan(def, st, planCtx({ name: def.name, def, state: st }));
      st.review = { day: null, needs: null, reasons: [] };
      const inst = bandInstance(hourNow(), clock.totalDays);
      st.joinAt = bandEnd(inst.band, inst.day); // from the next band
      const p = addResident(st, { atEntrance: true });
      world.people.splice(residents.length - 1, 0, p); // residents first, then the staff
      const t = placeTile(p, 'room');
      p.agent.walkTo(grid, t.col, t.row);
      addLog(st, logDay(), now(), `Moved in to room ${ROOM_IDS.indexOf(room.id) + 1}`);
      bus?.emit('care:admit', { resident: p.id, name: p.name, room: room.id });
      return { ok: true, reason: null, resident: p };
    },
    serialize() {
      for (const p of residents) {
        p.state.pos = { x: p.agent.x, y: p.agent.y };
        if (p.state.review) p.state.review.reasons = staleReasons(p.state, clock.totalDays).map((r) => r.text); // (Milestone 8)
      }
      for (const a of staffState.roster.agency) a.model = sys.get(a.id)?.toJSON() ?? null;
      const agencyIds = new Set(staffState.roster.agency.map((a) => a.id));
      staffState.staff = sys.serialize().filter((m) => !agencyIds.has(m.id));
      staffState.pos = crew.positions();
      staffState.modes = crew.modes();
      staffState.bandDone = Object.fromEntries(crew.people.map((q) => [q.id, q.bandDone ?? 0]));
      for (const t of care.tasks) {
        const q = (t.status === 'claimed' || t.status === 'working') && crew.byId(t.slots[0]);
        if (q?.task?.id === t.id) {
          t.spot = q.task.spot;
          t.arrived = q.task.arrived;
        }
      }
      const copy = (x) => JSON.parse(JSON.stringify(x));
      return { clock: clock.serialize(), residents: residents.map((p) => copy(p.state)), staff: copy(staffState), care: copy(care), admissions: admissions.serialize(), ledger: ledger.serialize() };
    },
  };
  return world;
}
