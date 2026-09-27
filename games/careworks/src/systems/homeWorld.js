// The small home's world (Milestones 1–2): the hidden grid with its inside walls, the placed station / lounge / room,
// the game clock (core/Clock on data/routine.js DAY), Arthur living his daily routine, and the worker walking her M1
// loop (no tasks until Milestone 4). People walk on core/Agent (A* on core/Grid), so they only pass through doorways.
// No drawing here — the home screen draws it — so the Node tests run it as it is.
//   createHomeWorld({ founderId, clock, resident, seed, bus })
//     clock    a core/Clock (made here when missing)       resident  Arthur's saved state (or none: a fresh one)
//     seed     the run's seed (his daily yes / no answers)   bus      optional: 'care:band' and 'care:step' events
//   world.update(realDt)   the clock and everyone move at the clock's speed; nothing moves while paused
//   world.hour · world.band · world.people · world.placed · world.resident (Arthur) · world.stateOf(person)
//   world.serialize() → { clock, residents }   (the run save; the page keeps the rest)
import { Grid } from '../../../../core/Grid.js';
import { Agent } from '../../../../core/Agent.js';
import { Clock } from '../../../../core/Clock.js';
import { HOME, WALLS, PLACED, PERSON, RESIDENT, WORKER_LOOP } from '../../data/home.js';
import { founderById, ROLES } from '../../data/setup.js';
import { residentById } from '../../data/residents.js';
import { DAY, PLACES, ROUTINE } from '../../data/routine.js';
import { ensureResidentState, riseNeeds, driftOutcomes, routineAt, bandAt, clockText, decide, completeStep, refuseStep } from './residentNeeds.js';

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

// 'F05.resident' → the tile.
export function spotTile(ref) {
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

export function createHomeWorld({ founderId = 'RN01', clock = null, resident = null, seed = 'careworks', bus = null } = {}) {
  clock ??= makeClock();
  const grid = new Grid({ cols: HOME.cols, rows: HOME.rows, tileSize: HOME.cellSize });
  for (const t of wallTiles()) grid.setBlocked(t.col, t.row, true);
  const placed = PLACED.map((def) => ({ kind: def.kind, id: def.id, def, fp: def.fp, residentId: null }));
  for (const p of placed) {
    if (p.def.walkIn) for (const b of p.def.blockedInside ?? []) grid.blockRect(b.col, b.row, b.w, b.h, true);
    else grid.blockRect(p.fp.col, p.fp.row, p.fp.w, p.fp.h, true);
  }

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

  // --- the worker (the run's Founder): the M1 loop -------------------------------------------------------------
  const founder = founderById(founderId) ?? founderById('RN01');
  const worker = { kind: 'staff', id: founder.id, name: founder.name, art: founder.art, line: ROLES[founder.role].name, loop: WORKER_LOOP, stop: 0, rest: 1.5, visits: 0, log: [] };
  worker.agent = new Agent({ id: founder.id, name: founder.name, speed: PERSON.speed, noPathTeleportSec: 2 });
  const w0 = spotTile(WORKER_LOOP[0].at);
  worker.agent.placeAtTile(grid, w0.col, w0.row);
  function nextStop(p) {
    p.stop = (p.stop + 1) % p.loop.length;
    const t = spotTile(p.loop[p.stop].at);
    p.agent.walkTo(grid, t.col, t.row, () => {
      p.rest = p.loop[p.stop].rest;
      p.visits++;
      p.log.push(p.loop[p.stop].at);
      if (p.log.length > 20) p.log.shift();
    });
  }

  // --- the routine ---------------------------------------------------------------------------------------------
  const hourNow = () => clock.dayProgress * 24;
  const stepDef = (id) => routineStep(id);
  function arrive(step, day) {
    if (st.step?.id !== step.id || st.step.day !== day) return; // a newer step took over on the way
    completeStep(st, step, day, clockText(hourNow()));
    st.step.status = 'doing';
    bus?.emit('care:step', { resident: st.id, step: step.id, status: 'done' });
  }
  function walkTo(step, day, place) {
    const t = placeTile(place);
    const here = grid.worldToTile(arthur.agent.x, arthur.agent.y);
    if (here && here.col === t.col && here.row === t.row && arthur.agent.state !== 'walking') return true;
    arthur.agent.walkTo(grid, t.col, t.row, () => arrive(step, day));
    return false;
  }
  function startStep(step, day) {
    const answer = decide(st, step, day, seed);
    st.step = { id: step.id, day, status: answer === 'refuse' ? 'refused' : 'walking' };
    if (answer === 'refuse') {
      refuseStep(st, step, day, clockText(hourNow()));
      const t = placeTile('room'); // he stays in (or goes back to) his room
      arthur.agent.walkTo(grid, t.col, t.row);
      bus?.emit('care:step', { resident: st.id, step: step.id, status: 'refused' });
      return;
    }
    bus?.emit('care:step', { resident: st.id, step: step.id, status: 'started' });
    if (walkTo(step, day, step.place)) arrive(step, day);
  }
  // After a load: walking on to where he was going.
  if (st.step?.status === 'walking') {
    const step = stepDef(st.step.id);
    if (step) walkTo(step, st.step.day, step.place);
  }

  let band = bandAt(hourNow());
  const world = {
    grid,
    placed,
    people: [arthur, worker],
    resident: arthur,
    worker,
    founder,
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
      riseNeeds(st, hours, world.asleep);
      driftOutcomes(st, hours);
      const now = routineAt(hourNow(), clock.totalDays);
      if (!st.step || st.step.id !== now.step.id || st.step.day !== now.day) startStep(now.step, now.day);
      const b = bandAt(hourNow());
      if (b !== band) {
        band = b;
        bus?.emit('care:band', { band: b.id });
      }
      arthur.agent.update(g, grid);
      if (worker.agent.state === 'walking') worker.agent.update(g, grid);
      else if ((worker.rest -= g) <= 0) nextStop(worker);
    },
    // What they are doing, for their card: "Walking to breakfast", "Asleep in his room" …
    stateOf(p) {
      if (p.kind === 'staff') {
        const stop = p.loop[p.stop];
        return p.agent.state === 'walking' ? stop.walking : stop.here;
      }
      const step = st.step && stepDef(st.step.id);
      if (!step) return 'In his room';
      if (st.step.status === 'refused') return `Chose to stay in his room (said no to ${step.activity ? step.name : step.name.toLowerCase()})`;
      return st.step.status === 'walking' ? step.going : step.doing;
    },
    // Which place a person is at right now (its id), or null while walking.
    whereIs(p) {
      if (p.agent.state === 'walking') return null;
      if (p.kind === 'staff') return p.loop[p.stop].at.split('.')[0];
      const step = st.step && stepDef(st.step.id);
      if (!step || st.step.status === 'refused' || step.place === 'room') return st.room;
      return PLACES[step.place].spot.split('.')[0];
    },
    byId: (id) => [arthur, worker].find((p) => p.id === id) ?? placed.find((s) => s.id === id) ?? null,
    serialize() {
      st.pos = { x: arthur.agent.x, y: arthur.agent.y };
      return { clock: clock.serialize(), residents: [JSON.parse(JSON.stringify(st))] };
    },
  };
  return world;
}

const routineStep = (id) => ROUTINE.find((s) => s.id === id) ?? null;
