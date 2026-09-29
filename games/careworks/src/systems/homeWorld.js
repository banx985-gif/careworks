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
// Milestone 10: the home's layout is live (src/systems/homeLayout.js on core/FacilitySystem): rooms and facilities
// can be placed, moved and sold in Build Mode (world.build), each piece's seats, posts and walls move with it, and the
// home can grow to Stage 2. After any change the grid is rebuilt, people standing where a piece now stands step to
// the nearest open tile, residents in a moved room move with it, and everyone walking finds a new way. Admissions give
// a free room of the right kind (Memory Support / High-Care residents need theirs) up to the stage's capacity.
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
//   world.layout (src/systems/homeLayout.js) · world.floor · world.stage · world.roomNumber(id) · world.spotTile(ref)
//   world.build.place(defId, col, row) / move(uid, col, row) / sell(uid) / upgrade() / check(…) → { ok, reason, … }
//   world.serialize() → { clock, residents, staff, care, admissions, ledger, layout }   (the run save; the page keeps the rest)
import { Grid } from '../../../../core/Grid.js';
import { Agent } from '../../../../core/Agent.js';
import { Clock } from '../../../../core/Clock.js';
import { findPath } from '../../../../core/Pathing.js';
import { AssignmentSystem } from '../../../../core/AssignmentSystem.js';
import { StaffModel } from '../../../../core/StaffModel.js';
import { HOME, RESIDENT, ENTRANCE, MAX_FLOOR } from '../../data/home.js';
import { createLayout } from './homeLayout.js';
import { roomById } from '../../data/rooms.js';
import { facilityById } from '../../data/facilities.js';
import { residentById, NEEDS, supportLevel, RESIDENTS, STAY_LEAVE_HOUR } from '../../data/residents.js';
import { Rng } from '../../../../core/Rng.js';
import { DAY, ROUTINE } from '../../data/routine.js';
import { BELL } from '../../data/tasks.js';
import { ECONOMY_START, STAFF_BALANCE, ON_CALL } from '../../data/balance.js';
import { AGENCY } from '../../data/shifts.js';
import { ensureResidentState, newResidentState, newStay, stayDaysLeft, riseNeeds, driftOutcomes, routineAt, bandAt, clockText, decide, completeStep, refuseStep, addLog } from './residentNeeds.js';
import { ensureCareState, absHour, bandInstance, bandEnd, generateBand, pruneTasks, scorePair, choosePairs, closeTask, decideTask, isOpen, changePlan, maybeRing, openBell, recordResponse, bellState, bellSummary, addFamiliarity, mostFamiliar } from './careTasks.js';
import { ensureStaffState, makeStaffSystem, makeFounderPerks, contribMult, perkPct } from './staffTeam.js';
import { createRoster } from './roster.js';
import { createCoverage } from './coverage.js';
import { eligibilityOf, optionPrefOf, staleReasons, markReviewed, noteDay, admissionPlan } from './carePlanRules.js';
import { optionById, domainById, OPTION_PREF_MOOD } from '../../data/carePlans.js';
import { SHIFT_IDS } from '../../data/shifts.js';
import { createCrew } from './staffCrew.js';
import { createAdmissions, stayLengthFor, varied } from './admissions.js';
import { createLedger } from './ledger.js';
import { createStaffing } from './staffing.js';
import { SPECIALTIES, TRAINING } from '../../data/training.js';
import { staffById } from '../../data/staff.js';
import { FOUNDER_FLAG } from '../../data/setup.js';

// The default layout (Milestones 1–9, and a new home): its wall tiles, its grid and its spots. The home world uses its
// own live layout; these are for older saves' upgrades and the tests.
let defaultLayout = null;
const DEFAULT = () => (defaultLayout ??= createLayout());
// Every wall tile (doorways left out).
export const wallTiles = () => DEFAULT().wallTiles().map((t) => ({ col: t.col, row: t.row, wall: t.wall }));
// The home's grid (MAX_FLOOR in size; the floor beyond the stage is blocked): walls, pieces (a room only where its
// furniture and walls stand) and the props.
export const makeGrid = () => new Grid({ cols: MAX_FLOOR.cols, rows: MAX_FLOOR.rows, tileSize: HOME.cellSize });
export const buildGrid = () => DEFAULT().buildGrid(makeGrid());
// 'F05.resident' or 'hall.cwPost' → the tile.
export const spotTile = (ref) => DEFAULT().spotTile(ref);

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
// A resident's pronoun for the card lines (Milestone 9: story data on each row, data/lifeStories.js).
export const theirOf = (id) => (residentById(id)?.pronoun === 'she' ? 'her' : 'his');

export function createHomeWorld({ founderId = 'RN01', clock = null, resident = null, residents: savedResidents = null, staff = null, care: careSaved = null, seed = 'careworks', bus = null, admissions: admissionsSaved = null, ledger: ledgerSaved = null, layout: layoutSaved = null, startCredits = ECONOMY_START.credits, shortStaffing = true } = {}) {
  clock ??= makeClock();
  // --- the layout (Milestone 10) --------------------------------------------------------------------------------
  const layout = createLayout({ saved: layoutSaved, bus });
  // An older save's layout that fails the access check gets a one-time fix-up (each piece in the way moves to the
  // nearest spot where everything passes). A Milestone 1–9 save has the default layout, which passes.
  const fixedUp = layoutSaved && layout.problems().length ? layout.fixUp() : [];
  const grid = layout.buildGrid(makeGrid());
  const spot = (ref) => layout.spotTile(ref);
  // The placed things as the home screen and the sheets see them: { kind 'room' | 'station', id, uid, def (name, art,
  // text, …), fp (its picture), box (its whole footprint), residentId (a room's resident) }. Kept object for object
  // across layout changes (the selection holds them).
  const placed = [];
  const props = [];
  function syncPlaced() {
    const keep = new Map(placed.map((x) => [x.id, x]));
    const next = layout.pieces.map((pc) => {
      const d = roomById(pc.defId) ?? facilityById(pc.defId);
      const it = keep.get(pc.id) ?? { kind: pc.kind, id: pc.id, residentId: null };
      Object.assign(it, { uid: pc.uid, defId: pc.defId, def: { ...pc, ...d, name: d.name, art: d.art, text: pc.kind === 'room' ? d.bestFor : d.text, template: pc.kind === 'room' ? pc.defId : undefined }, fp: pc.fp, box: pc.box });
      return it;
    });
    placed.splice(0, placed.length, ...next);
    props.splice(0, props.length, ...layout.props().map((def) => ({ kind: 'prop', id: def.id, def, fp: { col: def.col, row: def.row, w: 1, h: 1 } })));
  }
  syncPlaced();
  const roomList = () => placed.filter((x) => x.kind === 'room');
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
  // Milestone 11: trainees sit at a Training Room (the two places of the first one; their rest spot without one)
  const trainingSpot = (p) => {
    const rooms = layout.ofDef('F11');
    if (!rooms.length) return p.restSpot;
    const i = Object.keys(staffState.roster.training ?? {}).indexOf(p.id);
    const room = rooms[Math.floor(Math.max(0, i) / 2) % rooms.length];
    return `${room.id}.trainee${(Math.max(0, i) % 2) + 1}`;
  };
  const crew = createCrew({ grid, state: staffState, sys, perks, roster, spotTile: spot, hourNow, bandNow: () => bandAt(hourNow()), bus, trainingSpot, trainingLabel: (id) => staffing?.trainingOf(id) ? staffing.training.course(staffing.trainingOf(id).courseId)?.name ?? 'a course' : 'a course' });
  let staffing = null; // (Milestone 11: made with the ledger, below)

  // --- the residents ---------------------------------------------------------------------------------------------
  // A resident's person: { kind: 'resident', id, name, art, line, def, state (their saved state), agent }.
  const residents = [];
  const byResident = (id) => residents.find((p) => p.id === id) ?? null;
  // Milestone 10: a resident's seat follows their room number (room 1 → seat 1 …): four seats a Dining Room / Activity
  // Lounge, the next four at the next one built, and round again when there are more residents than seats.
  const PLACE_DEF = { dining: 'F03', lounge: 'F05' };
  const seatOf = (p) => Math.max(0, layout.roomNumber(p.state.room) - 1);
  const seatPiece = (p, place) => {
    const list = layout.ofDef(PLACE_DEF[place]);
    if (!list.length) return null;
    return list[Math.floor(seatOf(p) / 4) % list.length];
  };
  // Where a resident goes for a place: their room's inside spot, or their seat at the Dining Room / lounge.
  const placeRef = (p, place) => {
    if (place === 'room') return `${p.state.room}.inside`;
    const pc = seatPiece(p, place);
    const seats = facilityById(PLACE_DEF[place]).seats;
    return `${pc?.id ?? PLACE_DEF[place]}.${seats[seatOf(p) % seats.length]}`;
  };
  const placeTile = (p, place) => spot(placeRef(p, place));
  function addResident(st, { atEntrance = false } = {}) {
    const def = residentById(st.id);
    const p = { kind: 'resident', id: def.id, name: def.name, art: def.art, line: `${def.support} · age ${def.age}`, def, state: st };
    p.agent = new Agent({ id: def.id, name: def.name, speed: RESIDENT.speed, noPathTeleportSec: 3 });
    const room = roomList().find((r) => r.id === st.room);
    if (room && !st.leaving && !st.guest) room.residentId = def.id; // the room knows its resident (not one going home)
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
  // Milestone 6+: the saved list as it is (Milestone 9: it may be empty — everyone went home). Milestones 1–5 saved
  // Arthur alone; a new home starts with Arthur on his respite stay (Milestone 9).
  const listSaved = Array.isArray(savedResidents);
  const savedList = listSaved ? savedResidents : resident ? [resident] : [];
  for (const s of savedList) {
    const id = s?.id ?? ARTHUR;
    const def = residentById(id);
    if (!def || byResident(id)) continue;
    addResident(ensureResidentState(s, def, { room: id === ARTHUR ? RESIDENT.room : null }));
  }
  if (!listSaved && !resident) {
    const st = newResidentState(residentById(ARTHUR), { room: RESIDENT.room });
    st.stay = { ...newStay(residentById(ARTHUR), stayLengthFor(residentById(ARTHUR), seed, 0), clock.totalDays), opening: true, paused: 0 };
    addResident(st);
  } else if (!listSaved && !byResident(ARTHUR)) addResident(newResidentState(residentById(ARTHUR), { room: RESIDENT.room }));
  // (a saved resident without a room — never expected — gets the first free one)
  for (const p of residents) {
    if (p.state.leaving || roomList().find((r) => r.id === p.state.room)) continue;
    const free = roomList().find((r) => !r.residentId);
    if (free) {
      p.state.room = free.id;
      free.residentId = p.id;
      const t = placeTile(p, 'room');
      if (!p.state.pos) p.agent.placeAtTile(grid, t.col, t.row);
    }
  }
  // Arthur (the first resident) where one is still needed as a fallback; null once he has gone home.
  let arthur = byResident(ARTHUR);

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
  // Milestone 9: living the routine and planned for — not someone heading home, not a spawn-check guest.
  const inCare = (p) => joined(p) && !p.state.leaving && !p.state.guest;
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
    if (place === 'room') return [`${p.state.room}.help`, `${p.state.room}.help2`];
    const pc = seatPiece(p, place);
    const pool = [1, 2, 3, 4, 5, 6].map((n) => `${pc?.id ?? PLACE_DEF[place]}.help${n}`);
    const seat = placeTile(p, place);
    const d = (ref) => {
      const t = spot(ref);
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
    const to = spot(ref);
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
      specialty: (staffing?.specialtiesOf(q.id) ?? []).some((sp) => SPECIALTIES[sp]?.tasks.includes(t.type)), // (Milestone 11)
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
      for (const p of residents) if (inCare(p)) logRefused(p, generateBand({ care, st: p.state, band: inst.band, day: inst.day, now: at, rolesOnShift, stepOver: stepOverFor(p) }));
    }
    for (const p of residents) {
      if (!inCare(p)) continue;
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

  // --- going home (Milestone 9) -------------------------------------------------------------------------------------
  // A set stay (Respite, Rehab / Short Stay) ends on its leaveDay at STAY_LEAVE_HOUR (or at once when that has passed,
  // e.g. after a load): their open tasks end, the room frees up, they say goodbye and walk out of the front entrance.
  // It is a good outcome, never a failure; they may apply again later as Returning (their Familiar Care is kept).
  // The opening resident (a new home's Arthur) never goes home while he is the only resident: each day he is alone
  // moves his go-home day back one (the countdown pauses), and it carries on once someone else has been admitted.
  const othersHere = (p) => residents.some((q) => q !== p && !q.state.leaving && !q.state.guest);
  const aloneOpening = (p) => !!p.state.stay?.opening && !othersHere(p);
  const due = (p) => !aloneOpening(p) && (clock.totalDays > p.state.stay.leaveDay || (clock.totalDays === p.state.stay.leaveDay && hourNow() >= STAY_LEAVE_HOUR));
  function startLeaving(p) {
    const st = p.state;
    for (const t of care.tasks) if (t.resident === p.id && isOpen(t)) finish(t, 'gone');
    st.leaving = true;
    st.step = null;
    delete st.joinAt;
    const room = placed.find((r) => r.id === st.room);
    if (room?.residentId === p.id) room.residentId = null;
    st.leftDay = clock.totalDays;
    admissions.wentHome({ id: p.id, name: p.name, level: supportLevel(p.def), admittedDay: st.admittedDay ?? 0, leftDay: clock.totalDays, stay: st.stay?.type ?? p.def.stay });
    addLog(st, logDay(), now(), 'Heading home: the stay is over');
    bus?.emit('care:leaving', { resident: p.id, name: p.name, stay: st.stay?.type ?? p.def.stay });
    walkOut(p);
  }
  function walkOut(p) {
    if (p.agent.state === 'walking') return;
    const here = grid.worldToTile(p.agent.x, p.agent.y);
    if (here && here.col === ENTRANCE.col && here.row === ENTRANCE.row) return removeResident(p);
    p.agent.walkTo(grid, ENTRANCE.col, ENTRANCE.row);
  }
  // Out of the home: off every list (their Familiar Care, bells record and key worker stay in the care state).
  function removeResident(p) {
    const i = residents.indexOf(p);
    if (i >= 0) residents.splice(i, 1);
    const j = world.people.indexOf(p);
    if (j >= 0) world.people.splice(j, 1);
    const room = placed.find((r) => r.residentId === p.id);
    if (room) room.residentId = null;
    if (p.id === ARTHUR) arthur = null;
    if (!p.state.guest) bus?.emit('care:left', { resident: p.id, name: p.name });
  }

  // --- admissions and money (Milestone 6) -----------------------------------------------------------------------
  const admissions = createAdmissions({ saved: admissionsSaved, seed });
  const ledger = createLedger({ saved: ledgerSaved, bus, now: () => clock.totalDays, startCredits });
  // --- recruitment and training (Milestone 11) -------------------------------------------------------------------------
  staffing = createStaffing({ state: staffState, sys, ledger, seed, bus, today: () => clock.totalDays, year: () => clock.year, teamSize: () => crew.people.filter((q) => !q.agency && !q.leftTeam).length, trainingPlaces: () => layout.ofDef('F11').length * TRAINING.placesPerRoom });
  staffing.onTrained((s, c, gains, specialty) => {
    roster.setTraining(s.id, false);
    bus?.emit('staff:trained', { id: s.id, name: s.name, course: c.name, gains, specialty });
  });
  const inHome = () => new Set(residents.map((p) => p.id));
  const freeRooms = () => roomList().filter((r) => !r.residentId);
  // Milestone 10: the free rooms a resident may have, best first — one of the template they need (Memory Support,
  // High-Care), else a general room, the kind they would like first.
  function roomsFor(def) {
    const need = def.requires?.room;
    const free = freeRooms();
    if (need) return free.filter((r) => r.defId === need);
    const general = free.filter((r) => roomById(r.defId)?.general);
    return [...general.filter((r) => r.defId === def.room), ...general.filter((r) => r.defId !== def.room)];
  }
  const roomTemplatesHere = () => new Set(roomList().map((r) => r.defId));
  const team = () => crew.people.filter((q) => !q.agency && !q.leftTeam);
  const teamRoles = () => new Set(team().map((q) => q.role));
  const admitCtx = () => ({ roles: teamRoles(), freeRooms: freeRooms().map((r) => r.id), freeRoomsFor: (def) => roomsFor(def).map((r) => r.id), day: clock.totalDays, placeable: roomTemplatesHere(), buildable: (id) => layout.unlock(id).ok, paused: coverage.admissionsPaused() });
  const monthRange = (endDay = null) => {
    const len = clock.daysPerMonth;
    const toDay = endDay ?? (Math.floor(clock.totalDays / len) + 1) * len;
    return { fromDay: toDay - len, toDay };
  };
  // Milestone 9: plus who went home (they pay for their days here: admittedDay → leftDay)
  const payers = () => [
    ...residents.filter((p) => !p.state.leaving && !p.state.guest).map((p) => ({ id: p.id, name: p.name, level: supportLevel(p.def), admittedDay: p.state.admittedDay ?? 0 })),
    ...admissions.homeGoings.map((h) => ({ id: h.id, name: h.name, level: h.level, admittedDay: h.admittedDay ?? 0, leftDay: h.leftDay })),
  ];
  const payroll = () => team().map((q) => ({ id: q.id, name: q.name, salary: q.model.salary })); // agency is paid per shift
  // --- care-plan rules (Milestone 8) -------------------------------------------------------------------------------
  const facilityIds = () => new Set(placed.filter((x) => x.kind !== 'room').map((x) => x.defId)); // (Milestone 10: by facility, F01 …)
  // What an option's eligibility rule reads: the resident, the team and roster, the rooms / facilities / programs.
  function planCtx(p) {
    const shiftRoles = Object.fromEntries(SHIFT_IDS.map((sid) => [sid, new Set()]));
    const shiftCounts = Object.fromEntries(SHIFT_IDS.map((sid) => [sid, 0]));
    // Milestone 11: a specialty stands in for a role in these rules (the Falls specialty for "an Allied Health …")
    const standIns = (q) => (staffing?.specialtiesOf(q.id) ?? []).map((sp) => SPECIALTIES[sp]?.standsInFor).filter(Boolean);
    const roles = teamRoles();
    for (const q of team()) {
      for (const r of standIns(q)) roles.add(r);
      const sid = roster.shiftOf(q.id)?.id;
      if (!shiftRoles[sid]) continue;
      shiftRoles[sid].add(q.role);
      for (const r of standIns(q)) shiftRoles[sid].add(r);
      shiftCounts[sid]++;
    }
    return { name: p.name, needs: p.state.needs, level: supportLevel(p.def), support: p.def.support, stay: p.def.stay, visitors: p.def.visitors, teamRoles: roles, shiftRoles, shiftCounts, rooms: roomTemplatesHere(), facilities: facilityIds(), programs: new Set() };
  }
  // End of a day: who had essential care missed (a run of such days makes their plan stale).
  function noteMissed(day) {
    for (const p of residents) {
      if (!inCare(p)) continue;
      noteDay(p.state, day, care.tasks.some((t) => t.resident === p.id && t.day === day && t.status === 'missed' && t.essential));
    }
  }
  // A plan never reviewed on this save (a new game, or an M7-era save): reviewed as of now, not stale.
  for (const p of residents) if (p.state.review == null) markReviewed(p.state, clock.totalDays);
  const tickAdmissions = (day) => {
    const r = admissions.tick(day, { inHome: inHome(), roles: teamRoles(), placeable: roomTemplatesHere() });
    if (r.left.length || r.arrived.length) bus?.emit('admissions:change', { day, left: r.left.map((a) => a.id), arrived: r.arrived.map((a) => a.id) });
    return r;
  };
  tickAdmissions(clock.totalDays); // a new home (or an older save) gets its first board
  // A new day: the day's beat, the Founder's days, the board; a new month: the ledger's close for the month just ended.
  function newDay(day) {
    // Milestone 9: the opening resident's countdown pauses for each day he spent as the only resident
    for (const p of residents) {
      if (!aloneOpening(p) || p.state.leaving) continue;
      p.state.stay.leaveDay += 1;
      p.state.stay.paused = (p.state.stay.paused ?? 0) + 1;
    }
    staffState.founder.history.daysEmployed += 1;
    bus?.emit('care:dayEnd', world.daySummary(day - 1));
    if (shortStaffing) coverage.dayEnd(day - 1); // care recovery for yesterday's missed essential tasks (Milestone 7)
    noteMissed(day - 1); // Milestone 8: the missed-essential streak (plan review)
    tickAdmissions(day);
    staffing.tick(day); // Milestone 11: the free board refresh every 56 days, training days
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
      if (q.leftTeam) delete staffState.assignments[q.id];
      for (const t of care.tasks) if ((t.status === 'claimed' || t.status === 'working') && t.slots[0] === q.id) unclaim(t);
      crew.remove(q.id);
      sys.remove(q.id);
      const i = world.people.indexOf(q);
      if (i >= 0) world.people.splice(i, 1);
      staffState.roster.agency = staffState.roster.agency.filter((a) => a.id !== q.id);
      delete staffState.pos[q.id];
      delete staffState.modes[q.id];
      bus?.emit(q.leftTeam ? 'staff:left' : 'staff:agencyLeft', { id: q.id });
    }
  }
  const coverage = createCoverage({
    state: staffState,
    roster,
    team: () => crew.people,
    levels: () => residents.filter((p) => !p.state.leaving && !p.state.guest).map((p) => supportLevel(p.def)),
    // Milestone 10 fix: anyone here whose assessed clinical need is above the line needs a real RN on shift
    clinicalHigh: () => residents.some((p) => !p.state.leaving && !p.state.guest && (p.def.needs?.clinical ?? 0) > ON_CALL.clinicalNeedAbove),
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
    get rooms() {
      return roomList();
    },
    residents,
    // --- Milestone 11 -----------------------------------------------------------------------------------------
    get staffing() {
      return staffing;
    },
    // Hire a card from the board: they join Off shift and walk in from the front entrance.
    hire(cardId) {
      const r = staffing.take(cardId);
      if (!r.ok) return r;
      const def = r.def;
      const model = StaffModel.fromDefinition({ ...def, startLevel: def.level }, { startEnergy: STAFF_BALANCE.startEnergy, startMorale: STAFF_BALANCE.startMorale });
      model.counters = { tasks: 0 };
      sys.add(model);
      roster.join(model.id);
      const q = crew.addPerson(model);
      world.people.push(q);
      bus?.emit('staff:hired', { id: model.id, name: model.name, role: model.role });
      return { ok: true, reason: null, person: q };
    },
    // Let someone go (the page asks first; the Founder twice). Their Familiar Care stays on record in the care state.
    letGo(staffId) {
      const q = crew.byId(staffId);
      if (!q || q.agency || q.leftTeam) return { ok: false, reason: 'They are not on the team.' };
      if (team().length <= 1) return { ok: false, reason: 'The home needs someone on the team.' };
      const founder = staffState.founder.id === staffId && !staffState.founder.ended;
      for (const t of care.tasks) if ((t.status === 'claimed' || t.status === 'working') && t.slots[0] === staffId) unclaim(t);
      for (const [k, v] of Object.entries(care.keyWorkers)) if (v === staffId) delete care.keyWorkers[k];
      for (const [k, v] of Object.entries(staffState.assignments)) if (v === staffId) delete staffState.assignments[k];
      staffing.departed(q.model, clock.totalDays, founder);
      roster.forget(staffId);
      q.leftTeam = true;
      crew.leave(q);
      if (founder) {
        // bible §3.5.3: the Founding Staff flag ends with them (and they never come back as a candidate)
        staffState.founder.ended = true;
        staffState.founder.history.continuous = false;
        delete q.model.counters[FOUNDER_FLAG];
        perks.set(null);
      }
      bus?.emit('staff:letGo', { id: staffId, name: q.name, founder });
      return { ok: true, reason: null, founder };
    },
    // Start a course: paid, off the roster, off to the Training Room.
    train(courseId, staffId) {
      const r = staffing.startCourse(courseId, staffId);
      if (!r.ok) return r;
      const q = crew.byId(staffId);
      for (const t of care.tasks) if ((t.status === 'claimed' || t.status === 'working') && t.slots[0] === staffId) unclaim(t);
      roster.setTraining(staffId, true);
      bus?.emit('staff:training', { id: staffId, name: q?.name, course: courseId });
      return r;
    },
    specialtiesOf: (staffId) => staffing.specialtiesOf(staffId),
    // --- Milestone 10 -----------------------------------------------------------------------------------------
    layout,
    fixedUp,
    get floor() {
      return layout.floor;
    },
    get stage() {
      return layout.stageDef;
    },
    roomNumber: (id) => layout.roomNumber(id),
    spotTile: spot,
    roomsFor: (residentId) => roomsFor(residentById(residentId)),
    build: null, // (below)
    people: [...residents, ...crew.people],
    staff: crew.people,
    get team() {
      return team();
    },
    coverage,
    get resident() {
      return byResident(ARTHUR); // (null once he has gone home — Milestone 9)
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
      return !!byResident(ARTHUR) && world.isAsleep(byResident(ARTHUR));
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
      for (const p of [...residents]) {
        if (p.state.leaving || p.state.guest) {
          if (p.state.leaving) walkOut(p); // Milestone 9: heading home
          continue;
        }
        if (p.state.stay && due(p)) {
          startLeaving(p);
          continue;
        }
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
    stalePlans: () => residents.filter((p) => !p.state.leaving && !p.state.guest).map((p) => ({ resident: p.id, reasons: staleReasons(p.state, clock.totalDays) })).filter((x) => x.reasons.length),
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
      if (st.guest) return 'Visiting for the spawn check';
      if (st.leaving) return `Going home today: walking out to the front door`;
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
        if (p.mode === 'resting') return layout.ofDef('F08')[0]?.id ?? 'F08'; // the Staff Room's rest spots
        const ref = p.task?.spot;
        const pc = ref && ref.includes('.help') ? layout.byId(ref.split('.')[0]) : null;
        if (pc && (pc.defId === 'F03' || pc.defId === 'F05')) return pc.id;
        if (ref === 'help.dining' || ref?.startsWith('help.dining')) return layout.ofDef('F03')[0]?.id ?? 'F03';
        if (ref === 'help.lounge' || ref?.startsWith('help.lounge')) return layout.ofDef('F05')[0]?.id ?? 'F05';
        if (hit) return hit.id;
        return t && t.row >= 11 && t.col <= 11 ? 'F05' : null; // anywhere in the lounge
      }
      const place = residentPlace(p);
      if (place === 'room') return p.state.room;
      return placeRef(p, place).split('.')[0];
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
    setOnCall: (on, shiftId = 'night') => roster.setOnCall(on, shiftId),
    // The task AI's second rule: their key worker, or staff on the resident's wing (not floats, not agency).
    assignedTo: (staffId, residentId) => !!byResident(residentId) && assignedTo(staffId, byResident(residentId)),
    // --- Milestone 9 ------------------------------------------------------------------------------------------
    inCare,
    stayDaysLeft: (residentId) => (byResident(residentId) ? stayDaysLeft(byResident(residentId).state, clock.totalDays) : null),
    homeGoings: () => admissions.homeGoings,
    // ?debug=1 "Spawn all 60" (a test home only): everyone not here comes in as a guest, ignoring rooms and capacity —
    // placed on an open tile, then walking to another (seeded). Guests live no routine, get no tasks and are never
    // saved. → the guests (people)
    spawnGuests(ids = RESIDENTS.map((r) => r.id)) {
      const rng = new Rng(`${seed}:spawn`);
      const open = [];
      for (let r = 0; r < MAX_FLOOR.rows; r++) for (let c = 0; c < MAX_FLOOR.cols; c++) if (layout.isOpen(c, r)) open.push({ col: c, row: r });
      const out = [];
      ids.forEach((id, i) => {
        const def = residentById(id);
        if (!def || byResident(id)) return;
        const st = newResidentState(def, { room: null });
        Object.assign(st, varied(def, seed, 1000 + i));
        st.guest = true;
        st.stay = newStay(def, stayLengthFor(def, seed, 1000 + i), clock.totalDays);
        const p = addResident(st);
        const a = open[rng.int(0, open.length - 1)];
        const b = open[rng.int(0, open.length - 1)];
        p.agent.placeAtTile(grid, a.col, a.row);
        p.agent.walkTo(grid, b.col, b.row);
        world.people.splice(residents.length - 1, 0, p);
        out.push(p);
      });
      return out;
    },
    clearGuests() {
      for (const p of residents.filter((x) => x.state.guest)) removeResident(p);
    },
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
      const room = roomList().find((r) => r.id === roomsFor(def)[0]?.id);
      const st = newResidentState(def, { room: room.id });
      st.needs = { ...app.needs };
      st.outcomes = { ...app.outcomes };
      st.admittedDay = clock.totalDays;
      // Milestone 9: the stay's length from their application, their tags; a returning resident is marked
      st.stay = newStay(def, app.stayDays ?? stayLengthFor(def, seed, app.rolls?.[0] ?? 0), clock.totalDays);
      st.tags = [...(def.tags ?? [])];
      if (app.returning) st.returning = true;
      // Milestone 8: a first plan from their primary support, and a first review due (the plan starts stale)
      st.plan = admissionPlan(def, st, planCtx({ name: def.name, def, state: st }));
      st.review = { day: null, needs: null, reasons: [] };
      const inst = bandInstance(hourNow(), clock.totalDays);
      st.joinAt = bandEnd(inst.band, inst.day); // from the next band
      const p = addResident(st, { atEntrance: true });
      world.people.splice(residents.length - 1, 0, p); // residents first, then the staff
      const t = placeTile(p, 'room');
      p.agent.walkTo(grid, t.col, t.row);
      addLog(st, logDay(), now(), `Moved in to room ${layout.roomNumber(room.id)}`);
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
      const gone = new Set(crew.people.filter((q) => q.leftTeam).map((q) => q.id)); // (Milestone 11: let go, on their way out)
      staffState.staff = sys.serialize().filter((m) => !agencyIds.has(m.id) && !gone.has(m.id));
      staffing.serialize();
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
      return { clock: clock.serialize(), residents: residents.filter((p) => !p.state.guest).map((p) => copy(p.state)), staff: copy(staffState), care: copy(care), admissions: admissions.serialize(), ledger: ledger.serialize(), layout: layout.serialize() };
    },
  };
  // --- Build Mode (Milestone 10) ------------------------------------------------------------------------------------
  // After any layout change: the grid again, the placed list, who lives where; anyone standing where a piece now
  // stands steps to the nearest open tile; residents in a moved room move with it; everyone walking finds a new way.
  function relayout({ moved = null } = {}) {
    layout.buildGrid(grid);
    syncPlaced();
    for (const r of roomList()) r.residentId = residents.find((p) => p.state.room === r.id && !p.state.leaving && !p.state.guest)?.id ?? null;
    const tileOf = (a) => grid.worldToTile(a.x, a.y);
    for (const q of world.people) {
      const a = q.agent;
      let t = tileOf(a);
      if (moved && t && t.col >= moved.from.col && t.col < moved.from.col + moved.box.w && t.row >= moved.from.row && t.row < moved.from.row + moved.box.h) {
        const dc = moved.to.col - moved.from.col;
        const dr = moved.to.row - moved.from.row;
        a.x += dc * HOME.cellSize;
        a.y += dr * HOME.cellSize;
        t = tileOf(a);
      }
      if (!t || grid.isBlocked(t.col, t.row)) {
        let best = null;
        let bestD = Infinity;
        for (let r = 0; r < MAX_FLOOR.rows; r++) for (let c = 0; c < MAX_FLOOR.cols; c++) {
          if (grid.isBlocked(c, r)) continue;
          const d = Math.abs(c - (t?.col ?? 0)) + Math.abs(r - (t?.row ?? 0));
          if (d < bestD) [best, bestD] = [{ col: c, row: r }, d];
        }
        if (best) a.placeAtTile(grid, best.col, best.row);
      }
      // a walk under way: the same destination by a new path (a spot that moved: its new tile)
      if (a.state === 'walking' && a.goal) a.walkTo(grid, a.goal.col, a.goal.row, a._onArrive);
    }
    for (const q of crew.people) if (q.task?.spot) crew.retarget(q.id, q.task.spot);
    for (const p of residents) {
      const st = p.state;
      if (st.leaving || st.guest || !st.step || !(st.step.status === 'walking' || st.step.status === 'waiting')) continue;
      const step = routineStep(st.step.id);
      if (step) walkResident(p, step, st.step.day);
    }
    bus?.emit('home:layout', { version: layout.version });
  }
  const pay = (amount, reason, category) => ledger.economy.add('credits', amount, reason, category);
  const occupant = (pieceId) => {
    const p = residents.find((x) => x.state.room === pieceId && !x.state.guest && !x.state.leaving);
    return p ? p.name : null;
  };
  world.build = {
    // Can this go here? (plus the money and the lock) → { ok, reason }
    check(defId, col, row, uid = null) {
      if (uid == null) {
        const u = layout.unlock(defId);
        if (!u.ok) return u;
        const cost = layout.costOf(defId);
        if (ledger.balance < cost) return { ok: false, reason: `Not enough Credits: it costs ${cost.toLocaleString('en-GB')}` };
      }
      return layout.check(defId, col, row, uid);
    },
    place(defId, col, row) {
      const c = world.build.check(defId, col, row);
      if (!c.ok) return c;
      const r = layout.place(defId, col, row);
      if (!r.ok) return r;
      const cost = layout.costOf(defId);
      pay(-cost, `Build: ${r.piece.name}`, 'build');
      relayout();
      bus?.emit('home:built', { id: r.piece.id, def: defId, cost });
      return { ...r, cost };
    },
    move(uid, col, row) {
      const r = layout.move(uid, col, row);
      if (!r.ok) return r;
      relayout({ moved: { from: r.from, to: { col, row }, box: r.piece.box } });
      bus?.emit('home:moved', { id: r.piece.id });
      return r;
    },
    canSell: (uid) => layout.canSell(uid, { occupied: occupant }),
    sell(uid) {
      const r = layout.sell(uid, { occupied: occupant, day: clock.totalDays });
      if (!r.ok) return r;
      pay(r.refund, `Sold: ${r.piece.name} (50% back)`, 'sell');
      relayout();
      bus?.emit('home:sold', { id: r.piece.id, refund: r.refund });
      return r;
    },
    // Stage 1 → 2 (Rank D; no Rank yet, so only the debug path calls it). The floor grows forward; nothing moves.
    upgrade() {
      const r = layout.upgrade();
      if (!r.ok) return r;
      relayout();
      bus?.emit('home:stage', { stage: r.stage.n, name: r.stage.name });
      return r;
    },
    findSpot: (defId, near, uid) => layout.findSpot(defId, near, uid),
    setDebugUnlock: (on) => layout.setDebugUnlock(on),
  };
  if (fixedUp.length) relayout();
  return world;
}
