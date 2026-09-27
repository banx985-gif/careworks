// The small home's world (Milestone 1): the hidden grid with its inside walls, the placed station / room, and the two
// people walking their loops on core/Agent (A* paths on core/Grid, so they only ever pass through doorways).
// No drawing here — the home screen draws it through an IsoProjection — so the Node tests can run it as it is.
//   createHomeWorld({ founderId })   founderId = the run's Founder (the worker); unknown → Maya Finch (RN01)
//   world.update(dt)                 everyone walks / rests
//   world.people · world.placed · world.grid · world.stateOf(person) → "Walking to the lounge" …
import { Grid } from '../../../../core/Grid.js';
import { Agent } from '../../../../core/Agent.js';
import { HOME, WALLS, PLACED, PERSON, RESIDENT, WORKER_LOOP } from '../../data/home.js';
import { founderById, ROLES } from '../../data/setup.js';

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

export function createHomeWorld({ founderId = 'RN01' } = {}) {
  const grid = new Grid({ cols: HOME.cols, rows: HOME.rows, tileSize: HOME.cellSize });
  for (const t of wallTiles()) grid.setBlocked(t.col, t.row, true);
  const placed = PLACED.map((def) => ({ kind: def.kind, id: def.id, def, fp: def.fp }));
  for (const p of placed) {
    if (p.def.walkIn) for (const b of p.def.blockedInside ?? []) grid.blockRect(b.col, b.row, b.w, b.h, true);
    else grid.blockRect(p.fp.col, p.fp.row, p.fp.w, p.fp.h, true);
  }

  const founder = founderById(founderId) ?? founderById('RN01');
  const makePerson = (kind, id, name, art, line, loop) => {
    const agent = new Agent({ id, name, speed: PERSON.speed, noPathTeleportSec: 2 });
    const first = spotTile(loop[0].at);
    agent.placeAtTile(grid, first.col, first.row);
    return { kind, id, name, art, line, loop, agent, stop: 0, rest: loop[0].rest, visits: 0, log: [] };
  };
  const people = [
    makePerson('resident', RESIDENT.id, RESIDENT.name, RESIDENT.art, `${RESIDENT.support} · age ${RESIDENT.age}`, RESIDENT.loop),
    makePerson('staff', founder.id, founder.name, founder.art, ROLES[founder.role].name, WORKER_LOOP),
  ];
  // Start them apart: the worker first heads off from the nurse station, Arthur rests in his room.
  people[1].rest = 1.5;

  function next(p) {
    p.stop = (p.stop + 1) % p.loop.length;
    const t = spotTile(p.loop[p.stop].at);
    p.agent.walkTo(grid, t.col, t.row, () => {
      p.rest = p.loop[p.stop].rest;
      p.visits++;
      p.log.push(p.loop[p.stop].at);
      if (p.log.length > 20) p.log.shift();
    });
  }

  const world = {
    grid,
    placed,
    people,
    founder,
    time: 0,
    update(dt) {
      world.time += dt;
      for (const p of people) {
        if (p.agent.state === 'walking') p.agent.update(dt, grid);
        else if ((p.rest -= dt) <= 0) next(p);
      }
    },
    // What they are doing, for their sheet: "Walking to the lounge", "Resting in his room" …
    stateOf(p) {
      const stop = p.loop[p.stop];
      return p.agent.state === 'walking' ? stop.walking : stop.here;
    },
    byId: (id) => people.find((p) => p.id === id) ?? placed.find((s) => s.id === id) ?? null,
  };
  return world;
}
