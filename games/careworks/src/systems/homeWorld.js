// The small home's world (Milestones 1–3): the hidden grid with its inside walls, the placed station / lounge / room,
// the game clock (core/Clock on data/routine.js DAY), Arthur living his daily routine, and (Milestone 3) the opening
// team on the Morning shift: they stand their posts, stand down in the lounge off shift, and help Arthur with the
// routine steps their role fits (a step with a helper happens when both are there). People walk on core/Agent (A* on
// core/Grid), so they only pass through doorways. No drawing here — the home screen draws it — so the Node tests run
// it as it is.
//   createHomeWorld({ founderId, clock, resident, staff, seed, bus })
//     clock     a core/Clock (made here when missing)       resident  Arthur's saved state (or none: a fresh one)
//     staff     the run's staff state (src/systems/staffTeam.js; none: a team is built from the Founder)
//     seed      the run's seed (his daily yes / no answers)  bus       optional: 'care:band', 'care:step', 'staff:*'
//   world.update(realDt)   the clock and everyone move at the clock's speed; nothing moves while paused
//   world.hour · world.band · world.people · world.staff · world.placed · world.resident (Arthur) · world.stateOf(person)
//   world.assign(stepId, staffId | null) → { ok, reason }   the resident card's "who helps" picker (null = automatic)
//   world.helperFor(stepId) → the staff id who would help now (chosen or automatic), or null
//   world.serialize() → { clock, residents, staff }   (the run save; the page keeps the rest)
import { Grid } from '../../../../core/Grid.js';
import { Agent } from '../../../../core/Agent.js';
import { Clock } from '../../../../core/Clock.js';
import { HOME, WALLS, PLACED, RESIDENT, SPOTS } from '../../data/home.js';
import { residentById } from '../../data/residents.js';
import { DAY, PLACES, ROUTINE } from '../../data/routine.js';
import { ensureResidentState, riseNeeds, driftOutcomes, routineAt, bandAt, clockText, decide, completeStep, refuseStep } from './residentNeeds.js';
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

export function createHomeWorld({ founderId = 'RN01', clock = null, resident = null, staff = null, seed = 'careworks', bus = null } = {}) {
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

  // --- the routine, with helpers -------------------------------------------------------------------------------
  // st.step = { id, day, status: 'walking' | 'waiting' | 'doing' | 'refused', helper, arthurThere, helperThere }
  const isCurrent = (step, day) => st.step?.id === step.id && st.step.day === day;
  function complete(step, day, helper) {
    const note = helper ? `with ${first(crew.byId(helper)?.name ?? helper)}` : null;
    const dropped = completeStep(st, step, day, clockText(hourNow()), {
      needMult: helper ? (need) => contribMult(perks, helper, need) : null,
      activityMult: 1 + perkPct(perks, helper, 'activityWellbeingPct') / 100,
      mealMult: 1 + perkPct(perks, helper, 'mealSatisfactionPct') / 100,
      note,
    });
    st.step.status = 'doing';
    st.step.dropped = dropped;
    if (helper) crew.finishHelp(helper);
    bus?.emit('care:step', { resident: st.id, step: step.id, status: 'done', helper });
  }
  function tryComplete(step, day) {
    if (!isCurrent(step, day) || st.step.status === 'doing') return;
    if (!st.step.arthurThere) return;
    if (st.step.helper && !st.step.helperThere) {
      st.step.status = 'waiting';
      return;
    }
    complete(step, day, st.step.helper);
  }
  function arthurArrived(step, day) {
    if (!isCurrent(step, day)) return;
    st.step.arthurThere = true;
    tryComplete(step, day);
  }
  function helperArrived(step, day) {
    if (!isCurrent(step, day)) return;
    st.step.helperThere = true;
    tryComplete(step, day);
  }
  function walkArthur(step, day) {
    const t = placeTile(step.place);
    const here = grid.worldToTile(arthur.agent.x, arthur.agent.y);
    if (here && here.col === t.col && here.row === t.row && arthur.agent.state !== 'walking') return arthurArrived(step, day);
    arthur.agent.walkTo(grid, t.col, t.row, () => arthurArrived(step, day));
  }
  // The step before is over: if he was there waiting for help that never came, it happens on his own.
  function closePrevious() {
    const s = st.step;
    if (!s || s.status === 'doing' || s.status === 'refused') return;
    const step = routineStep(s.id);
    if (s.helper) crew.releaseHelp(s.helper);
    if (s.arthurThere && step) {
      s.helper = null;
      completeStep(st, step, s.day, clockText(hourNow()), { note: 'on his own' });
      s.status = 'doing';
      bus?.emit('care:step', { resident: st.id, step: step.id, status: 'done', helper: null });
    }
  }
  function startStep(step, day) {
    closePrevious();
    const answer = decide(st, step, day, seed);
    if (answer === 'refuse') {
      st.step = { id: step.id, day, status: 'refused', helper: null };
      refuseStep(st, step, day, clockText(hourNow()));
      const t = placeTile('room'); // he stays in (or goes back to) his room
      arthur.agent.walkTo(grid, t.col, t.row);
      bus?.emit('care:step', { resident: st.id, step: step.id, status: 'refused' });
      return;
    }
    const helper = crew.pickHelper(step, staffState.assignments[step.id] ?? null);
    st.step = { id: step.id, day, status: 'walking', helper, arthurThere: false, helperThere: !helper };
    bus?.emit('care:step', { resident: st.id, step: step.id, status: 'started', helper });
    if (helper) crew.startHelp(helper, step, step.place, () => helperArrived(step, day));
    walkArthur(step, day);
  }
  // After a load: carry on with the step he was in the middle of.
  if (st.step && (st.step.status === 'walking' || st.step.status === 'waiting')) {
    const step = routineStep(st.step.id);
    const day = st.step.day;
    if (step) {
      if (st.step.helper) crew.resumeHelp(st.step.helper, step, step.place, st.step.helperThere, () => helperArrived(step, day));
      if (!st.step.arthurThere) walkArthur(step, day);
    }
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
        bus?.emit('care:band', { band: b.id });
      }
      crew.update(g, hours);
      const now = routineAt(hourNow(), clock.totalDays);
      if (!st.step || st.step.id !== now.step.id || st.step.day !== now.day) startStep(now.step, now.day);
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
    helperFor(stepId) {
      const step = routineStep(stepId);
      return step ? crew.pickHelper(step, staffState.assignments[stepId] ?? null) : null;
    },
    // What they are doing, for their card.
    stateOf(p) {
      if (p.kind === 'staff') return crew.stateOf(p);
      const step = st.step && routineStep(st.step.id);
      if (!step) return 'In his room';
      if (st.step.status === 'refused') return `Chose to stay in his room (said no to ${step.activity ? step.name : step.name.toLowerCase()})`;
      const helper = st.step.helper ? first(crew.byId(st.step.helper)?.name ?? '') : null;
      if (st.step.status === 'waiting') return `Waiting for ${helper} (${step.name.toLowerCase()})`;
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
      return { clock: clock.serialize(), residents: [JSON.parse(JSON.stringify(st))], staff: JSON.parse(JSON.stringify(staffState)) };
    },
  };
  return world;
}
