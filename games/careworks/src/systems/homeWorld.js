// The small home's world (Milestones 1–4): the hidden grid with its inside walls, the placed station / lounge / room,
// the game clock (core/Clock on data/routine.js DAY), Arthur living his daily routine, and (Milestone 3) the opening
// team on the Morning shift: they stand their posts and stand down in the lounge off shift. Milestone 4: each band his
// care plan, routine and needs make care tasks (src/systems/careTasks.js); free staff on shift pick their next task
// themselves by the bible §15 score, walk to him (or his room), spend the task's minutes there and finish it; a need
// over the bell line rings his call bell. A routine step with a helper happens when the help is done. People walk on
// core/Agent (A* on core/Grid), so they only pass through doorways. No drawing here — the home screen draws it — so the
// Node tests run it as it is.
//   createHomeWorld({ founderId, clock, resident, staff, care, seed, bus })
//     clock     a core/Clock (made here when missing)       resident  Arthur's saved state (or none: a fresh one)
//     staff     the run's staff state (src/systems/staffTeam.js; none: a team is built from the Founder)
//     care      the run's care state (tasks, bells, familiarity; none: a fresh one)
//     seed      the run's seed (his daily yes / no answers)  bus       optional: 'care:band', 'care:step', 'care:task',
//                                                                     'care:bell', 'staff:*'
//   world.update(realDt)   the clock and everyone move at the clock's speed; nothing moves while paused
//   world.hour · world.band · world.people · world.staff · world.placed · world.resident (Arthur) · world.stateOf(person)
//   world.assign(stepId, staffId | null) → { ok, reason }   the "who helps" picker: pins that step's task (null = Auto)
//   world.helperFor(stepId) → the staff id helping (or who would, by score, if it were now), or null
//   world.changePlan(domain, optionId) → { ok, reason?, text? }   the Care Plan picker (logged on his card)
//   world.care · world.tasksToday() · world.taskOf(person) · world.bell (the ringing bell or null) · world.bellSummary()
//   world.mostFamiliar() → staff id | null · world.setKeyWorker(staffId | null)
//   world.serialize() → { clock, residents, staff, care }   (the run save; the page keeps the rest)
import { Grid } from '../../../../core/Grid.js';
import { Agent } from '../../../../core/Agent.js';
import { Clock } from '../../../../core/Clock.js';
import { findPath } from '../../../../core/Pathing.js';
import { AssignmentSystem } from '../../../../core/AssignmentSystem.js';
import { HOME, WALLS, PLACED, RESIDENT, SPOTS, HELP_SPOTS, HELP_SPOTS_2 } from '../../data/home.js';
import { residentById, NEEDS } from '../../data/residents.js';
import { DAY, PLACES, ROUTINE } from '../../data/routine.js';
import { BELL } from '../../data/tasks.js';
import { ensureResidentState, riseNeeds, driftOutcomes, routineAt, bandAt, clockText, decide, completeStep, refuseStep, addLog } from './residentNeeds.js';
import { ensureCareState, absHour, bandInstance, generateBand, pruneTasks, scorePair, choosePairs, closeTask, decideTask, isOpen, changePlan, maybeRing, openBell, recordResponse, bellState, bellSummary, addFamiliarity, mostFamiliar } from './careTasks.js';
import { ensureStaffState, makeStaffSystem, makeFounderPerks, contribMult, perkPct } from './staffTeam.js';
import { createRoster } from './roster.js';
import { createCrew } from './staffCrew.js';

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

export function createHomeWorld({ founderId = 'RN01', clock = null, resident = null, staff = null, care: careSaved = null, seed = 'careworks', bus = null } = {}) {
  clock ??= makeClock();
  const grid = new Grid({ cols: HOME.cols, rows: HOME.rows, tileSize: HOME.cellSize });
  for (const t of wallTiles()) grid.setBlocked(t.col, t.row, true);
  const placed = PLACED.map((def) => ({ kind: def.kind, id: def.id, def, fp: def.fp, residentId: null }));
  for (const p of placed) {
    if (p.def.walkIn) for (const b of p.def.blockedInside ?? []) grid.blockRect(b.col, b.row, b.w, b.h, true);
    else grid.blockRect(p.fp.col, p.fp.row, p.fp.w, p.fp.h, true);
  }
  const hourNow = () => clock.dayProgress * 24;
  let band = bandAt(hourNow());

  // --- the staff (Milestone 3) -------------------------------------------------------------------------------
  const staffState = ensureStaffState(staff, founderId);
  const sys = makeStaffSystem(staffState);
  const perks = makeFounderPerks(staffState);
  const roster = createRoster(staffState);
  const crew = createCrew({ grid, state: staffState, sys, perks, roster, spotTile, hourNow, bandNow: () => bandAt(hourNow()), bus });

  // --- Arthur: his profile, his state, his room --------------------------------------------------------------
  const def = residentById(RESIDENT.id);
  const st = ensureResidentState(resident, def, { room: RESIDENT.room });
  const room = placed.find((p) => p.id === st.room);
  if (room) room.residentId = def.id; // the room knows its resident
  const placeTile = (place) => spotTile(place === 'room' ? `${st.room}.inside` : PLACES[place].spot);
  const arthur = { kind: 'resident', id: def.id, name: def.name, art: def.art, line: `${def.support} · age ${def.age}`, def, state: st };
  arthur.agent = new Agent({ id: def.id, name: def.name, speed: RESIDENT.speed, noPathTeleportSec: 3 });
  if (st.pos) {
    arthur.agent.x = st.pos.x;
    arthur.agent.y = st.pos.y;
  } else {
    const t = placeTile('room');
    arthur.agent.placeAtTile(grid, t.col, t.row);
  }

  // --- care tasks (Milestone 4) --------------------------------------------------------------------------------
  const care = ensureCareState(careSaved);
  const assignSys = new AssignmentSystem({ staff: sys, getJobs: () => care.tasks.filter((t) => t.status === 'claimed' || t.status === 'working') });
  const absNow = () => absHour(clock.totalDays, hourNow());
  const now = () => clockText(hourNow());
  const logDay = () => routineAt(hourNow(), clock.totalDays).day;
  const log = (text) => addLog(st, logDay(), now(), text);
  const rolesOnShift = (bandId) => new Set(crew.people.filter((p) => roster.onShift(p.id, 0, bandId)).map((p) => p.role));
  const stepIndex = (id) => ROUTINE.findIndex((s) => s.id === id);
  // The step has already run today (or is under way and past needing help).
  const stepOver = (stepId, day) => {
    if (!st.step) return false;
    if (st.step.day !== day) return st.step.day > day;
    const cur = stepIndex(st.step.id);
    const idx = stepIndex(stepId);
    return cur > idx || (cur === idx && (st.step.status === 'doing' || st.step.status === 'refused' || st.step.status === 'missed'));
  };
  const routineTask = (stepId, day) => care.tasks.find((t) => t.source === 'routine' && t.stepId === stepId && t.day === day && t.resident === st.id) ?? null;
  // Where he is (or is going): his current step's place, or his room.
  const arthurPlace = () => {
    const step = st.step && routineStep(st.step.id);
    return !step || st.step.status === 'refused' || st.step.status === 'missed' ? 'room' : step.place;
  };
  const taskPlace = (t) => (t.place === 'room' ? 'room' : t.place === 'step' ? routineStep(t.stepId).place : arthurPlace());
  // The helper's spot at a place: the first one, or the second when someone else is already going to the first.
  function spotFor(t, staffId) {
    const place = taskPlace(t);
    const first = HELP_SPOTS[place];
    const taken = crew.people.some((q) => q.id !== staffId && q.task && q.task.spot === first);
    return taken ? HELP_SPOTS_2[place] : first;
  }
  const label = (t) => (t.source === 'routine' ? stepWord(routineStep(t.stepId)) : t.name.charAt(0).toLowerCase() + t.name.slice(1));
  const taskInfo = (t) => ({ id: t.id, type: t.type, label: label(t), room: t.place === 'room' });
  // The Milestone 3 "who helps" picker pins a routine step's task to that person while they are on shift.
  const pinOf = (t) => {
    const id = t.source === 'routine' ? staffState.assignments[t.stepId] : t.pinned;
    const p = id && crew.byId(id);
    return p && roster.onShift(p.id, hourNow(), bandAt(hourNow()).id) ? p.id : null;
  };
  const tilesBetween = (p, ref) => {
    const from = grid.worldToTile(p.agent.x, p.agent.y);
    const to = spotTile(ref);
    const path = from && findPath(grid, from, to);
    return path ? path.length : from ? Math.abs(from.col - to.col) + Math.abs(from.row - to.row) : 0;
  };
  function scoreFor(t, p) {
    if (!t.roles.includes(p.role)) return null; // (scorePair says so too; this skips the path search)
    const pin = pinOf(t);
    if (pin && pin !== p.id) return null;
    if (!pin && t.type !== 'bell' && crew.tooTired(p)) return null;
    return scorePair({
      task: { ...t, pinned: pin },
      person: { id: p.id, role: p.role, energy: p.model.energy },
      tiles: tilesBetween(p, HELP_SPOTS[taskPlace(t)]),
      keyWorker: care.keyWorkers[t.resident] ?? null,
      mostFamiliar: mostFamiliar(care, t.resident, crew.people.map((q) => q.id)),
      doneThisBand: p.bandDone ?? 0,
    });
  }
  function claim(t, p) {
    t.status = 'claimed'; // first, so core/AssignmentSystem counts it as a job when it marks them assigned
    assignSys.assign(t, p.id);
    t.reached = false;
    if (t.source === 'routine' && isCurrent(routineStep(t.stepId), t.day)) st.step.helper = p.id;
    crew.startTask(p.id, taskInfo(t), spotFor(t, p.id));
    bus?.emit('care:task', { id: t.id, type: t.type, status: 'claimed', staff: p.id });
  }
  function unclaim(t) {
    const id = t.slots[0];
    if (id) assignSys.unassign(t, id);
    t.slots = [null];
    t.reached = false;
    if (id && crew.byId(id)?.task?.id === t.id) crew.releaseTask(id);
    if (t.source === 'routine' && st.step?.helper === id) st.step.helper = null;
  }
  // A task is over without being done (missed, refused, he managed on his own): let its helper go.
  function finish(t, status) {
    unclaim(t);
    closeTask(care, t, status);
    bus?.emit('care:task', { id: t.id, type: t.type, status });
  }
  const helperName = (id) => first(crew.byId(id)?.name ?? id);
  function applyEffects(t, helper) {
    for (const [need, v] of Object.entries(t.drops ?? {})) st.needs[need] = clamp(st.needs[need] - v * contribMult(perks, helper, need));
    for (const [o, v] of Object.entries(t.outcomes ?? {})) st.outcomes[o] = clamp(st.outcomes[o] + v);
  }
  function completeTask(t, p) {
    const helper = p.id;
    if (t.source === 'routine') completeRoutine({ ...routineStep(t.stepId), drops: t.drops }, t.day, helper);
    else {
      applyEffects(t, helper);
      if (t.type === 'bell') bellState(care, t.resident).cooldownUntil = absNow() + BELL.cooldownHours;
      else log(`${t.name} (with ${helperName(helper)})`);
    }
    assignSys.unassign(t, helper);
    closeTask(care, t, 'done');
    t.slots = [helper];
    addFamiliarity(care, t.resident, helper);
    crew.finishTask(helper);
    bus?.emit('care:task', { id: t.id, type: t.type, status: 'done', staff: helper });
  }

  // --- the routine ---------------------------------------------------------------------------------------------
  // st.step = { id, day, status: 'walking' | 'waiting' | 'doing' | 'refused' | 'missed', helper, arthurThere }
  const isCurrent = (step, day) => !!step && st.step?.id === step.id && st.step.day === day;
  function completeRoutine(step, day, helper, note = null) {
    const dropped = completeStep(st, step, day, now(), {
      needMult: helper ? (need) => contribMult(perks, helper, need) : null,
      activityMult: 1 + perkPct(perks, helper, 'activityWellbeingPct') / 100,
      mealMult: 1 + perkPct(perks, helper, 'mealSatisfactionPct') / 100,
      note: helper ? `with ${helperName(helper)}` : note,
    });
    if (isCurrent(step, day)) {
      st.step.status = 'doing';
      st.step.dropped = dropped;
      st.step.helper = helper;
    }
    bus?.emit('care:step', { resident: st.id, step: step.id, status: 'done', helper });
  }
  // Help can come if the step has a task that someone on shift now could take (or someone is already on it).
  const helpCanCome = (t) => !!t && isOpen(t) && (t.status !== 'open' || crew.people.some((p) => t.roles.includes(p.role) && roster.onShift(p.id, hourNow(), bandAt(hourNow()).id)));
  function arthurArrived(step, day) {
    if (!isCurrent(step, day)) return;
    st.step.arthurThere = true;
    if (st.step.status === 'doing') return;
    const t = routineTask(step.id, day);
    if (helpCanCome(t)) {
      st.step.status = 'waiting';
      return;
    }
    // No one on shift who could help (or no task for this step): he manages on his own, as before Milestone 4.
    if (t && isOpen(t)) finish(t, 'self');
    completeRoutine(step, day, null);
  }
  function walkArthur(step, day) {
    const t = placeTile(step.place);
    const here = grid.worldToTile(arthur.agent.x, arthur.agent.y);
    if (here && here.col === t.col && here.row === t.row && arthur.agent.state !== 'walking') return arthurArrived(step, day);
    arthur.agent.walkTo(grid, t.col, t.row, () => arthurArrived(step, day));
  }
  // The step before is over. Help under way finishes now; help that never came is a missed task (no drops: his need
  // keeps rising) when someone could have come, else he managed on his own.
  function closePrevious() {
    const s = st.step;
    if (!s || s.status === 'doing' || s.status === 'refused' || s.status === 'missed') return;
    const step = routineStep(s.id);
    const t = routineTask(s.id, s.day);
    if (t?.status === 'working') {
      const p = crew.byId(t.slots[0]);
      if (p) return completeTask(t, p);
    }
    if (t && isOpen(t) && t.staffable) {
      finish(t, 'missed');
      s.status = 'missed';
      s.helper = null;
      log(`Missed: ${step.name} (no help came)`);
      return;
    }
    if (t && isOpen(t)) finish(t, 'self');
    if (s.arthurThere && step) completeRoutine(step, s.day, null, 'on his own');
  }
  function startStep(step, day) {
    closePrevious();
    const answer = decide(st, step, day, seed);
    const t = routineTask(step.id, day);
    if (answer === 'refuse') {
      st.step = { id: step.id, day, status: 'refused', helper: null };
      if (t && isOpen(t)) finish(t, 'refused'); // a refused task ends here: logged, never retried this band
      refuseStep(st, step, day, now());
      const r = placeTile('room'); // he stays in (or goes back to) his room
      arthur.agent.walkTo(grid, r.col, r.row);
      bus?.emit('care:step', { resident: st.id, step: step.id, status: 'refused' });
      return;
    }
    st.step = { id: step.id, day, status: 'walking', helper: t?.slots[0] ?? null, arthurThere: false };
    bus?.emit('care:step', { resident: st.id, step: step.id, status: 'started' });
    walkArthur(step, day);
  }
  // After a load: carry on with the step he was in the middle of, and send everyone back to their tasks.
  if (st.step && (st.step.status === 'walking' || st.step.status === 'waiting')) {
    const step = routineStep(st.step.id);
    if (step && !st.step.arthurThere) walkArthur(step, st.step.day);
  }
  for (const t of care.tasks) {
    if (t.status !== 'claimed' && t.status !== 'working') continue;
    const p = crew.byId(t.slots[0]);
    if (!p) {
      t.status = 'open';
      t.slots = [null];
      continue;
    }
    crew.resumeTask(p.id, taskInfo(t), t.spot ?? spotFor(t, p.id), !!t.arrived);
  }
  assignSys.refresh();

  // Each frame: plan the band's tasks, ring the bell, close what is overdue, move the work on, and let free staff pick.
  const REACH = 1.6 * HOME.cellSize; // "at his side" while he is walking
  function tickTasks(hours) {
    const at = absNow();
    const inst = bandInstance(hourNow(), clock.totalDays);
    if (!care.gen[inst.key]) {
      care.gen[inst.key] = true;
      pruneTasks(care, clock.totalDays);
      generateBand({ care, st, band: inst.band, day: inst.day, now: at, rolesOnShift, stepOver });
    }
    const bell = maybeRing(care, st, at, clock.totalDays);
    if (bell) {
      log(`Rang the call bell (${needName(bell.need)})`);
      bus?.emit('care:bell', { resident: st.id, need: bell.need, status: 'ring' });
    }
    const current = st.step ? routineTask(st.step.id, st.step.day) : null;
    for (const t of care.tasks) {
      if (t === current || t.type === 'bell' || !(t.status === 'open' || t.status === 'claimed') || t.due > at) continue;
      const missed = t.staffable;
      finish(t, missed ? 'missed' : 'unstaffed');
      if (missed) log(`Missed: ${t.name}`);
    }
    // work under way
    for (const t of care.tasks) {
      if (t.status !== 'claimed' && t.status !== 'working') continue;
      const p = crew.byId(t.slots[0]);
      if (!p || p.task?.id !== t.id) {
        // their shift ended (or they were sent elsewhere): back on the board
        if (p) assignSys.unassign(t, p.id);
        t.status = 'open';
        t.slots = [null];
        t.reached = false;
        continue;
      }
      if (t.place === 'resident') {
        const place = arthurPlace();
        if (p.task.spot !== HELP_SPOTS[place] && p.task.spot !== HELP_SPOTS_2[place]) crew.retarget(p.id, spotFor(t, p.id));
      }
      if (!t.reached) {
        let reached;
        if (t.place === 'room') reached = p.task.arrived;
        else if (t.place === 'step') reached = p.task.arrived && isCurrent(routineStep(t.stepId), t.day) && !!st.step.arthurThere;
        else reached = (p.task.arrived && arthur.agent.state !== 'walking') || Math.hypot(p.agent.x - arthur.agent.x, p.agent.y - arthur.agent.y) <= REACH;
        if (!reached) continue;
        t.reached = true;
        if (t.type === 'bell') {
          const minutes = Math.round((at - t.ringAt) * 60);
          recordResponse(care, t.resident, { day: clock.totalDays, t: now(), minutes, staffId: p.id, need: t.need });
          log(`Call bell answered by ${helperName(p.id)} (${minutes} min)`);
          bus?.emit('care:bell', { resident: st.id, status: 'answered', staff: p.id, minutes });
        }
        if (decideTask(st, t, seed) === 'refuse') {
          finish(t, 'refused'); // he said no: it ends cleanly and is not tried again this band
          log(`Said no to ${label(t)}`);
          continue;
        }
        t.status = 'working';
      }
      t.workLeft -= hours;
      if (t.workLeft <= 1e-9) completeTask(t, p);
    }
    // free staff pick their next task (bible §15 order: src/systems/careTasks.js scorePair)
    const bandId = bandAt(hourNow()).id;
    const shiftRoles = new Set(crew.people.filter((p) => roster.onShift(p.id, hourNow(), bandId)).map((p) => p.role));
    const avail = care.tasks.filter((t) => t.status === 'open' && t.opens <= at);
    for (const t of avail) if (t.roles.some((r) => shiftRoles.has(r))) t.staffable = true;
    const free = crew.people.filter((p) => crew.isFree(p));
    if (!avail.length || !free.length) return;
    for (const { task, person } of choosePairs(avail, free, scoreFor)) claim(task, person);
  }

  let lastDay = clock.totalDays;
  const world = {
    grid,
    placed,
    people: [arthur, ...crew.people],
    staff: crew.people,
    resident: arthur,
    worker: crew.people[0], // the Founder (Milestones 1–2 had one worker)
    founder: { id: staffState.founder.id, name: crew.byId(staffState.founder.id)?.name },
    staffState,
    staffSystem: sys,
    perks,
    roster,
    crew,
    clock,
    get hour() {
      return hourNow();
    },
    get band() {
      return band;
    },
    get asleep() {
      return st.step?.id === 'settle' && st.step.status === 'doing';
    },
    update(dt) {
      if (clock.paused) return;
      const g = dt * clock.speed; // game-seconds at 1×
      clock.update(dt);
      const hours = (g / clock.secondsPerDay) * 24;
      if (clock.totalDays !== lastDay) {
        staffState.founder.history.daysEmployed += clock.totalDays - lastDay;
        lastDay = clock.totalDays;
      }
      riseNeeds(st, hours, world.asleep);
      driftOutcomes(st, hours);
      const b = bandAt(hourNow());
      if (b !== band) {
        band = b;
        crew.newBand();
        bus?.emit('care:band', { band: b.id });
      }
      crew.update(g, hours);
      const r = routineAt(hourNow(), clock.totalDays);
      if (!st.step || st.step.id !== r.step.id || st.step.day !== r.day) startStep(r.step, r.day);
      tickTasks(hours);
      arthur.agent.update(g, grid);
    },
    // Resident card's picker: choose who helps with a step (null = automatic). A role that doesn't fit is refused.
    assign(stepId, staffId) {
      const step = routineStep(stepId);
      if (!step) return { ok: false, reason: 'No such step.' };
      if (staffId == null) {
        delete staffState.assignments[stepId];
        return { ok: true, reason: null };
      }
      const r = crew.canHelp(staffId, step);
      if (r.ok) staffState.assignments[stepId] = staffId;
      return r;
    },
    chosenFor: (stepId) => staffState.assignments[stepId] ?? null,
    // Who helps with a step today: whoever has its task, else who would pick it by score if it were open now.
    helperFor(stepId) {
      const step = routineStep(stepId);
      if (!step) return null;
      const day = routineAt(hourNow(), clock.totalDays).day;
      const t = routineTask(stepId, day);
      if (t && (t.status === 'claimed' || t.status === 'working' || t.status === 'done')) return t.slots[0];
      const probe = t ?? { id: 'probe', source: 'routine', stepId, type: 'meal', urgency: 3, roles: step.roles, place: 'step', opens: 0, resident: st.id };
      const onShift = crew.people.filter((p) => roster.onShift(p.id, hourNow(), bandAt(hourNow()).id));
      return choosePairs([probe], onShift, scoreFor)[0]?.person.id ?? null;
    },
    // --- Milestone 4 -------------------------------------------------------------------------------------------
    care,
    changePlan(domain, optionId) {
      const inst = bandInstance(hourNow(), clock.totalDays);
      const r = changePlan(care, st, domain, optionId, { day: inst.day, band: inst.band, now: absNow(), rolesOnShift, stepOver, roleOf: (id) => crew.byId(id)?.role });
      // anyone whose task was taken away or no longer fits goes back to their post
      for (const p of crew.people) {
        const t = p.task && care.tasks.find((x) => x.id === p.task.id);
        if (p.task && (!t || t.slots[0] !== p.id)) crew.releaseTask(p.id);
      }
      assignSys.refresh();
      if (r.ok && r.changed) {
        log(r.text);
        bus?.emit('care:plan', { resident: st.id, domain, option: optionId });
      }
      return r;
    },
    // Today's tasks for Arthur, in the order they open (the card's list).
    tasksToday() {
      const day = clock.totalDays;
      return care.tasks.filter((t) => t.resident === st.id && t.day === day).sort((a, b) => a.opens - b.opens);
    },
    taskOf: (p) => (p.task ? care.tasks.find((t) => t.id === p.task.id) ?? null : null),
    get bell() {
      return openBell(care, st.id);
    },
    bellSummary: () => bellSummary(care, st.id),
    mostFamiliar: () => mostFamiliar(care, st.id, crew.people.map((p) => p.id)),
    setKeyWorker(staffId) {
      if (staffId == null) delete care.keyWorkers[st.id];
      else care.keyWorkers[st.id] = staffId;
    },
    // What they are doing, for their card.
    stateOf(p) {
      if (p.kind === 'staff') return crew.stateOf(p);
      const step = st.step && routineStep(st.step.id);
      if (!step) return 'In his room';
      if (st.step.status === 'refused') return `Chose to stay in his room (said no to ${step.activity ? step.name : step.name.toLowerCase()})`;
      if (st.step.status === 'missed') return `No help came for ${stepWord(step)}`;
      const helper = st.step.helper ? first(crew.byId(st.step.helper)?.name ?? '') : null;
      const t = routineTask(step.id, st.step.day);
      if (st.step.status === 'waiting' && helper && t?.status === 'working') return `${step.doing} · ${helper} is helping`;
      if (st.step.status === 'waiting') return helper ? `Waiting for ${helper} (${stepWord(step)})` : `Waiting for help (${stepWord(step)})`;
      if (st.step.status === 'walking') return helper ? `${step.going} · ${helper} is coming` : step.going;
      return helper ? `${step.doing} · with ${helper}` : step.doing;
    },
    // Which place a person is at right now (its id), or null while walking.
    whereIs(p) {
      if (p.agent.state === 'walking') return null;
      const t = grid.worldToTile(p.agent.x, p.agent.y);
      if (p.kind === 'staff') {
        const hit = placed.find((s) => Object.values(s.def.spots ?? {}).some((x) => x.col === t?.col && x.row === t?.row));
        if (hit) return hit.id;
        return t && t.row >= 11 ? 'F05' : null; // anywhere in the lounge (resting, the Cards table)
      }
      const step = st.step && routineStep(st.step.id);
      if (!step || st.step.status === 'refused' || step.place === 'room') return st.room;
      return PLACES[step.place].spot.split('.')[0];
    },
    byId: (id) => world.people.find((p) => p.id === id) ?? placed.find((s) => s.id === id) ?? null,
    serialize() {
      st.pos = { x: arthur.agent.x, y: arthur.agent.y };
      staffState.staff = sys.serialize();
      staffState.pos = crew.positions();
      staffState.modes = crew.modes();
      staffState.bandDone = Object.fromEntries(crew.people.map((p) => [p.id, p.bandDone ?? 0]));
      for (const t of care.tasks) {
        const p = (t.status === 'claimed' || t.status === 'working') && crew.byId(t.slots[0]);
        if (p?.task?.id === t.id) {
          t.spot = p.task.spot;
          t.arrived = p.task.arrived;
        }
      }
      return { clock: clock.serialize(), residents: [JSON.parse(JSON.stringify(st))], staff: JSON.parse(JSON.stringify(staffState)), care: JSON.parse(JSON.stringify(care)) };
    },
  };
  return world;
}
