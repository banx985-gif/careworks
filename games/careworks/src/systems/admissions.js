// Admissions / waiting list (Milestone 6, bible §8): the applicant board, the waiting list and the hard prerequisites.
// Pure rules on plain state (no drawing, no walking), so the Node tests use it as it is; the home world admits the
// resident (a room, the walk in, the routine) and main draws the sheets.
// (core/ContractSystem's offers come once a month and are "delivered"; applicants arrive every few days, wait on a list
// and are admitted into a room, so this is its own small board.)
//
//   createAdmissions({ saved, seed, residents }) → board
//   board.tick(day, ctx)            new day: expiries, arrivals, the board topped up (ctx = { inHome: Set of ids })
//   board.board · board.waiting      the applicants on the board / the waiting list (newest last)
//   board.get(id) · board.defOf(app)
//   board.prereq(app, ctx) → { ok, text, reason }   the hard prerequisites (ctx.roles = Set of roles on the team)
//   board.canAdmit(app, ctx) → { ok, reason }       prerequisites, then a free room, then a pending assessment
//                                                   (ctx = { roles, freeRooms: [room ids], day, paused (Milestone 7: the reason admissions are paused, or null) })
//   board.admit(id, ctx) → { ok, reason, applicant }   takes them off the board (the world gives them the room)
//   board.waitlist(id, day) · board.decline(id, day) · board.requestAssessment(id, day) → { ok, reason }
//   board.serialize()
// An applicant: { id (resident id), status 'board' | 'wait', arrived (day), leaveDay, needs, outcomes, assessed (bool),
// assessReady (day or null), rolls (variation rolls so far) }.
import { Rng } from '../../../../core/Rng.js';
import { ADMISSION as A } from '../../data/admissions.js';
import { RESIDENTS, NEEDS, OUTCOMES, ROOM_TEMPLATES } from '../../data/residents.js';
import { ROLES } from '../../data/roles.js';

const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));

// The need / outcome variation for one roll (bounded; the same every time for that roll).
export function varied(def, seed, roll) {
  const rng = new Rng(`${seed}:adm:${def.id}:${roll}`);
  const needs = Object.fromEntries(NEEDS.map((n) => [n.id, clamp(def.needs[n.id] + rng.int(-A.needVariation, A.needVariation))]));
  const outcomes = Object.fromEntries(OUTCOMES.map((o) => [o.id, clamp(def.outcomes[o.id] + rng.int(-A.outcomeVariation, A.outcomeVariation))]));
  return { needs, outcomes };
}

// What a resident's hard prerequisites say, against the home: { ok, text ('Ready' / 'Needs: …'), reason (plain words) }.
//   ctx.roles = Set of the roles on the team; ctx.placeable = Set of room templates the home can have (Standard only
//   until Milestone 10)
export function prereqOf(def, ctx) {
  const need = def.requires ?? {};
  if (need.room) {
    const room = ROOM_TEMPLATES[need.room];
    const has = ctx.placeable?.has(need.room) ?? room.placeable;
    if (!has) return { ok: false, text: `Needs: ${room.name}`, reason: `${first(def)} needs a ${room.name}. The home has none yet (it arrives with ${room.unlock}).` };
  }
  if (need.role && !ctx.roles?.has(need.role)) {
    const name = ROLES[need.role].name;
    return { ok: false, text: `Needs: a ${name} on staff`, reason: `${first(def)} needs a ${name} on staff. The team has none.` };
  }
  return { ok: true, text: 'Ready', reason: null };
}
const first = (def) => def.name.split(' ')[0];

export function createAdmissions({ saved = null, seed = 'careworks', residents = RESIDENTS } = {}) {
  const defs = new Map(residents.map((r) => [r.id, r]));
  const s = {
    applicants: [],
    away: {}, // resident id → the day they may apply again
    nextArrival: null, // the day the next applicant arrives (set on the first tick)
    arrivals: 0,
    ...(saved ?? {}),
  };
  s.applicants = (s.applicants ?? []).filter((a) => defs.has(a.id)).map((a) => ({ ...a }));
  s.away = { ...(s.away ?? {}) };

  const defOf = (app) => defs.get(app.id);
  const get = (id) => s.applicants.find((a) => a.id === id) ?? null;
  const onBoard = () => s.applicants.filter((a) => a.status === 'board');
  const waiting = () => s.applicants.filter((a) => a.status === 'wait');

  // Someone not in the home, not already applying and not away: picked by the run's seed (a reload never changes it).
  function arrive(day, ctx) {
    const pool = residents.filter((r) => !ctx.inHome.has(r.id) && !get(r.id) && !(s.away[r.id] > day));
    if (!pool.length) return null;
    const rng = new Rng(`${seed}:arrive:${s.arrivals}`);
    const def = pool[rng.int(0, pool.length - 1)];
    const roll = s.arrivals;
    s.arrivals++;
    const app = { id: def.id, status: 'board', arrived: day, leaveDay: day + A.boardDays, ...varied(def, seed, roll), assessed: false, assessReady: null, rolls: [roll] };
    s.applicants.push(app);
    return app;
  }
  function leave(app, day) {
    s.applicants = s.applicants.filter((a) => a !== app);
    s.away[app.id] = day + A.reapplyAfterDays;
  }

  const board = {
    get board() {
      return onBoard();
    },
    get waiting() {
      return waiting();
    },
    get state() {
      return s;
    },
    get,
    defOf,
    // A new day (and the first look at a new home): who leaves, who arrives, and the board topped up to its minimum.
    tick(day, ctx) {
      const out = { left: [], arrived: [] };
      for (const a of [...s.applicants]) {
        if (day >= a.leaveDay && !(a.assessReady != null && day < a.assessReady)) {
          leave(a, day);
          out.left.push(a);
        }
      }
      for (const [id, until] of Object.entries(s.away)) if (until <= day) delete s.away[id];
      if (s.nextArrival == null) {
        s.nextArrival = day + A.arriveEveryDays;
        for (let i = 0; i < A.firstBoard; i++) {
          const a = arrive(day, ctx);
          if (a) out.arrived.push(a);
        }
      }
      while (day >= s.nextArrival) {
        s.nextArrival += A.arriveEveryDays;
        if (onBoard().length < A.board.max) {
          const a = arrive(day, ctx);
          if (a) out.arrived.push(a);
        }
      }
      while (onBoard().length < A.board.min) {
        const a = arrive(day, ctx);
        if (!a) break;
        out.arrived.push(a);
      }
      return out;
    },
    prereq: (app, ctx) => prereqOf(defOf(app), ctx),
    // Why they can or can't come in now, in plain words.
    canAdmit(app, ctx) {
      if (!app) return { ok: false, reason: 'They are no longer applying.' };
      if (ctx.paused) return { ok: false, reason: ctx.paused }; // Milestone 7: a shift is running short-staffed
      const p = prereqOf(defOf(app), ctx);
      if (!p.ok) return { ok: false, reason: p.reason };
      if (app.assessReady != null && ctx.day < app.assessReady) return { ok: false, reason: `Their assessment update is under way: ready on day ${app.assessReady + 1}.` };
      const room = defOf(app).room;
      if (!ctx.freeRooms?.length) return { ok: false, reason: `No free ${ROOM_TEMPLATES[room].name}: every room has a resident.` };
      return { ok: true, reason: null };
    },
    admit(id, ctx) {
      const app = get(id);
      const r = board.canAdmit(app, ctx);
      if (!r.ok) return { ...r, applicant: null };
      s.applicants = s.applicants.filter((a) => a !== app);
      return { ok: true, reason: null, applicant: app };
    },
    waitlist(id, day) {
      const app = get(id);
      if (!app) return { ok: false, reason: 'They are no longer applying.' };
      if (app.status === 'wait') return { ok: false, reason: 'Already on the waiting list.' };
      if (waiting().length >= A.waitMax) return { ok: false, reason: `The waiting list is full (${A.waitMax}).` };
      app.status = 'wait';
      app.leaveDay = day + A.waitDays;
      return { ok: true, reason: null };
    },
    decline(id, day) {
      const app = get(id);
      if (!app) return { ok: false, reason: 'They are no longer applying.' };
      leave(app, day);
      return { ok: true, reason: null };
    },
    // Once per applicant: a fresh look at their needs (the variation re-rolled), back after assessmentDays.
    requestAssessment(id, day) {
      const app = get(id);
      if (!app) return { ok: false, reason: 'They are no longer applying.' };
      if (app.assessed) return { ok: false, reason: 'Their assessment has already been updated.' };
      const roll = s.arrivals++;
      Object.assign(app, varied(defOf(app), seed, roll), { assessed: true, assessReady: day + A.assessmentDays, rolls: [...app.rolls, roll] });
      app.leaveDay = Math.max(app.leaveDay, day + A.assessmentDays + 1); // never leaves while being assessed
      return { ok: true, reason: null };
    },
    daysLeft: (app, day) => Math.max(0, app.leaveDay - day),
    serialize: () => JSON.parse(JSON.stringify(s)),
  };
  return board;
}
