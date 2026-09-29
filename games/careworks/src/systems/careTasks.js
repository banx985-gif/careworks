// Daily care tasks and the staff AI's scoring (Milestone 4, bible §9, §15, §6 Familiar Care). Pure rules on plain
// state, so the Node tests use them as they are; the home world (src/systems/homeWorld.js) walks people to the tasks.
//
// The run's care state (in the run save):
//   { tasks: [task], nextId, gen: { 'day:band': true }, bells: { residentId: { log, count, totalMin, cooldownUntil } },
//     familiarity: { 'RES01|CW01': n }, keyWorkers: { residentId: staffId }, counts: { done, missed, essentialMissed,
//     refused, self, unstaffed } }
// A task:
//   { id, type, name, resident, source: 'routine' | 'plan' | 'need' | 'bell', stepId?, optionId?, domain?, place:
//     'step' | 'resident' | 'room', at (the hour it is for: his step's time, or the plan's), roles, minutes, urgency, essential, drops, outcomes, pref?, day, band, opens, due
//     (absolute game hours: day × 24 + hour), status: 'open' | 'claimed' | 'working' | 'done' | 'missed' | 'refused' |
//     'self' | 'unstaffed', slots: [staffId | null] (core/AssignmentSystem), pinned, staffable, reached, workLeft,
//     ringAt?, need? }
//   open → claimed (someone is on the way) → working (at his side) → done. Not done by `due`: missed if someone who
//   could do it was on shift (his need keeps rising, the log says so), else unstaffed. refused: he said no (bible §6):
//   final, never retried in that band. self: a routine step he managed on his own (no one on shift).
//
//   ensureCareState(saved) · bandInstance(hour, totalDays) → { band, day, key } · bandEnd(band, day)
//   generateBand({ care, st, band, day, now, rolesOnShift, stepOver, only }) → new tasks
//   scorePair({ task, person, tiles, keyWorker, mostFamiliar, doneThisBand }) → number | null (null = may not)
//   choosePairs(tasks, people, score) → [{ task, person }]   the best pair first, each person and task once
//   changePlan(care, st, domain, optionId, ctx) → { from, to }   · closeDue(care, now) → closed tasks
//   maybeRing(care, st, now) → bell task | null · recordResponse(care, residentId, rec) · bellSummary(care, residentId)
//   addFamiliarity(care, residentId, staffId) · familiarityOf · mostFamiliar(care, residentId, staffIds)
// Milestone 8: a plan option the resident refuses (st.optionPrefs) still makes its tasks, but each is refused the
// moment it comes up (status 'refused', optionRefused: true — the home world logs it) and its routine-step changes
// don't apply; no score, pin or shortage can take a refused task. A disliked option's tasks are said no to at the
// dislike chance, decided when the helper arrives (like the M4 group activity). An option's removes take the staff help
// off those routine steps (they manage them on their own).
import { Rng } from '../../../../core/Rng.js';
import { TASK_TYPES, ROUTINE_TASKS, NEED_TASKS, BELL, FAMILIARITY, SCORING, PLAN_CHANGE } from '../../data/tasks.js';
import { SPECIALTY_SCORE } from '../../data/training.js';
import { DOMAINS, optionById, domainById, ensurePlan } from '../../data/carePlans.js';
import { ROUTINE, BANDS, PREF_RULES } from '../../data/routine.js';
import { NEEDS } from '../../data/residents.js';

const KEEP_DAYS = 2; // tasks kept in the save: today and yesterday (the card shows today's)
export const OPEN = ['open', 'claimed', 'working'];
export const isOpen = (t) => OPEN.includes(t.status);
export const absHour = (day, hour) => day * 24 + hour;

export function newCareState() {
  return { tasks: [], nextId: 1, gen: {}, bells: {}, familiarity: {}, keyWorkers: {}, counts: { done: 0, missed: 0, essentialMissed: 0, refused: 0, self: 0, unstaffed: 0 } };
}
export function ensureCareState(saved) {
  const fresh = newCareState();
  if (!saved || typeof saved !== 'object') return fresh;
  return {
    ...fresh,
    ...saved,
    tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
    gen: { ...(saved.gen ?? {}) },
    bells: { ...(saved.bells ?? {}) },
    familiarity: { ...(saved.familiarity ?? {}) },
    keyWorkers: { ...(saved.keyWorkers ?? {}) },
    counts: { ...fresh.counts, ...(saved.counts ?? {}) },
  };
}
export { ensurePlan };

// --- bands ------------------------------------------------------------------------------------------------------
const bandById = (id) => BANDS.find((b) => b.id === id);
const inBand = (b, hour) => (b.from < b.to ? hour >= b.from && hour < b.to : hour >= b.from || hour < b.to);
export const bandOfHour = (hour) => BANDS.find((b) => inBand(b, hour));
// The band on now and the day it started (the night band starts at 22:00 and runs past midnight).
export function bandInstance(hour, totalDays) {
  const band = bandOfHour(hour);
  const day = band.from > band.to && hour < band.to ? totalDays - 1 : totalDays;
  return { band, day, key: `${day}:${band.id}` };
}
export const bandStart = (band, day) => absHour(day, band.from);
export const bandEnd = (band, day) => absHour(band.from < band.to ? day : day + 1, band.to);
// The end of a named deadline band, for a task that opens at `at` on `day`.
function dueOf(bandId, day, at) {
  const b = bandById(bandId);
  let end = bandEnd(b, day);
  if (end <= absHour(day, at)) end += 24; // (never with the data as it is)
  return end;
}

// --- generation ---------------------------------------------------------------------------------------------------
function makeTask(care, fields) {
  const type = TASK_TYPES[fields.type];
  const t = {
    id: `t${care.nextId++}`,
    urgency: type.urgency,
    essential: type.essential,
    drops: {},
    outcomes: {},
    status: 'open',
    slots: [null],
    pinned: null,
    staffable: false,
    reached: false,
    workLeft: null,
    ...fields,
  };
  t.workLeft ??= t.minutes / 60;
  return t;
}

// What a routine step's task looks like under a plan: its roles, time and extra drops (an option's `changes`).
const refuses = (optionPrefs, id) => optionPrefs?.[id] === 'refuse';
export function routineTemplate(step, plan, optionPrefs = null) {
  const base = ROUTINE_TASKS[step.id];
  const out = { type: base.type, band: base.band, minutes: base.minutes, roles: [...step.roles], drops: { ...step.drops }, changedBy: [] };
  for (const d of DOMAINS) {
    const o = optionById(plan[d.id]);
    if (refuses(optionPrefs, o?.id)) continue; // (Milestone 8) they refuse it: the step stays as it was
    for (const c of o?.changes ?? []) {
      if (c.step !== step.id) continue;
      if (c.minutes) out.minutes = c.minutes;
      if (c.roles) out.roles = [...c.roles];
      for (const [n, v] of Object.entries(c.dropsAdd ?? {})) out.drops[n] = (out.drops[n] ?? 0) + v;
      out.changedBy.push(o.id);
    }
  }
  return out;
}

// The tasks one band makes for one resident: his routine steps that start in it, his plan's tasks that open in it, and
// a task for any need at or over the line. Nothing is planned for a band with no one on shift (he manages on his own,
// as in Milestone 3). rolesOnShift(bandId) → Set of the roles rostered in that band; stepOver(stepId, day) → true when
// that step has already run today; only = { domain } (a care-plan change: that domain's tasks only).
export function generateBand({ care, st, band, day, now = -Infinity, rolesOnShift, stepOver = () => false, only = null }) {
  const roles = rolesOnShift(band.id);
  if (!roles || roles.size === 0) return [];
  const plan = ensurePlan(st.plan);
  const out = [];
  const add = (fields) => {
    if (fields.due <= now) return;
    const t = makeTask(care, { resident: st.id, day, band: band.id, ...fields });
    care.tasks.push(t);
    out.push(t);
    if (t.optionId && refuses(st.optionPrefs, t.optionId)) {
      closeTask(care, t, 'refused'); // refused the moment it comes up: never on the board
      t.optionRefused = true;
    }
  };
  const removed = new Set(DOMAINS.flatMap((d) => {
    const o = optionById(plan[d.id]);
    return o && !refuses(st.optionPrefs, o.id) ? o.removes ?? [] : [];
  }));
  if (!only) {
    for (const step of ROUTINE) {
      if (!ROUTINE_TASKS[step.id] || bandOfHour(step.at) !== band || stepOver(step.id, day) || removed.has(step.id)) continue;
      const tpl = routineTemplate(step, plan, st.optionPrefs);
      const opens = Math.max(absHour(day, step.at) - (ROUTINE_TASKS[step.id].lead ?? 0), bandStart(band, day));
      add({ type: tpl.type, name: step.name, source: 'routine', stepId: step.id, at: step.at, place: 'step', roles: tpl.roles, minutes: tpl.minutes, drops: tpl.drops, opens, due: dueOf(tpl.band, day, step.at), changedBy: tpl.changedBy });
    }
  }
  for (const d of DOMAINS) {
    if (only && only.domain !== d.id) continue;
    const o = optionById(plan[d.id]);
    for (const t of o?.tasks ?? []) {
      if (bandOfHour(t.at) !== band) continue;
      add({ type: t.type, name: t.name, source: 'plan', optionId: o.id, domain: d.id, at: t.at, place: t.place, roles: [...t.roles], minutes: t.minutes, drops: { ...(t.drops ?? {}) }, outcomes: { ...(t.outcomes ?? {}) }, pref: t.pref ?? null, opens: absHour(day, t.at), due: dueOf(t.band, day, t.at) });
    }
  }
  if (!only) {
    const bandTasks = care.tasks.filter((t) => t.resident === st.id && t.day === day && t.band === band.id);
    for (const n of NEEDS) {
      const def = NEED_TASKS.byNeed[n.id];
      if (!def || st.needs[n.id] < NEED_TASKS.line) continue;
      if (bandTasks.some((t) => t.drops?.[n.id] > 0 && isOpen(t))) continue;
      const opens = Math.max(bandStart(band, day) + NEED_TASKS.opensAfter, now);
      add({ type: def.type, name: def.name, source: 'need', need: n.id, at: opens % 24, place: 'resident', roles: [...def.roles], minutes: def.minutes, drops: { ...def.drops }, outcomes: {}, opens, due: bandEnd(band, day) });
    }
  }
  return out;
}

// Keep today's and yesterday's tasks (and anything still open).
export function pruneTasks(care, today) {
  care.tasks = care.tasks.filter((t) => isOpen(t) || t.day > today - KEEP_DAYS);
  for (const k of Object.keys(care.gen)) if (Number(k.split(':')[0]) < today - KEEP_DAYS) delete care.gen[k];
}

// --- scoring (bible §15) -------------------------------------------------------------------------------------------
// person = { id, role, energy }. Returns null when they may not take it: the role doesn't fit (a hard rule, never
// outscored), or it is pinned to someone else.
export function scorePair({ task, person, tiles = 0, keyWorker = null, mostFamiliar = null, doneThisBand = 0, specialty = false }) {
  if (task.status === 'refused' || task.optionRefused) return null; // a refusal is never overridden (Milestone 8)
  if (!task.roles.includes(person.role)) return null;
  if (task.pinned && task.pinned !== person.id) return null;
  const W = SCORING;
  let s = task.urgency * W.urgency;
  if (keyWorker && keyWorker === person.id) s += W.assigned;
  if (task.urgency < TASK_TYPES.bell.urgency && mostFamiliar === person.id) s += W.familiar;
  if (specialty) s += SPECIALTY_SCORE; // Milestone 11: their specialty fits the task (a small tip, like Familiar Care)
  s -= tiles * W.perTile + doneThisBand * W.perTaskDone + (100 - (person.energy ?? 100)) * W.perEnergyUsed;
  return s;
}
// Greedy: the best-scoring (person, task) pair first, then the best of what is left, so two people never set off for
// the same task and the most urgent work goes to whoever suits it best. score(task, person) → number | null.
export function choosePairs(tasks, people, score) {
  const pairs = [];
  for (const task of tasks) {
    for (const person of people) {
      const s = score(task, person);
      if (s != null) pairs.push({ task, person, s });
    }
  }
  pairs.sort((a, b) => b.s - a.s || (a.task.opens - b.task.opens) || (a.task.id < b.task.id ? -1 : 1));
  const usedT = new Set();
  const usedP = new Set();
  const out = [];
  for (const p of pairs) {
    if (usedT.has(p.task) || usedP.has(p.person)) continue;
    usedT.add(p.task);
    usedP.add(p.person);
    out.push(p);
  }
  return out;
}

// --- deadlines, refusals ----------------------------------------------------------------------------------------------
// Close every open task (not a bell) whose deadline has passed. A task already being worked on is let finish.
export function closeDue(care, now) {
  const closed = [];
  for (const t of care.tasks) {
    if (t.type === 'bell' || !(t.status === 'open' || t.status === 'claimed') || t.due > now) continue;
    closeTask(care, t, t.staffable ? 'missed' : 'unstaffed');
    closed.push(t);
  }
  return closed;
}
export function closeTask(care, t, status) {
  t.status = status;
  t.slots = [null];
  care.counts[status] = (care.counts[status] ?? 0) + 1;
  if (status === 'missed' && t.essential) care.counts.essentialMissed++;
}
// A task he may say no to (a plan task with a preference key): 'go' or 'refuse', fixed for that band (reloads never
// reroll).
// Milestone 8: a plan task also answers to the resident's preference for its option (the stronger of the two counts).
export function decideTask(st, task, seed = 'careworks') {
  const byKey = task.pref ? PREF_RULES[st.prefs?.[task.pref] ?? 'accept'].refuseChance : 0;
  const op = task.optionId ? st.optionPrefs?.[task.optionId] : null;
  const byOption = op === 'dislike' || op === 'refuse' ? PREF_RULES[op].refuseChance : 0; // (an accepted option: as M4)
  if (!task.pref && !byOption) return 'go';
  const chance = Math.max(byKey, byOption);
  if (chance >= 1) return 'refuse';
  if (chance <= 0) return 'go';
  return new Rng(`${seed}:${st.id}:${task.day}:${task.band}:${task.pref ?? task.optionId}`).next() < chance ? 'refuse' : 'go';
}

// --- the care plan ---------------------------------------------------------------------------------------------------
// Change one domain's option. It shapes tomorrow's tasks, and today's too where that part hasn't happened yet: that
// domain's open (unclaimed) tasks of the band on now are taken away and the new option's are added (but not one whose
// kind has already been done today), and routine steps not yet under way take the new option's changes.
//   ctx = { day, band, now, rolesOnShift, stepOver, roleOf(staffId) → role }
export function changePlan(care, st, domain, optionId, ctx) {
  const o = optionById(optionId);
  if (!o || o.domain !== domain) return { ok: false, reason: 'That option is not in this domain.' };
  st.plan = ensurePlan(st.plan);
  const from = st.plan[domain];
  if (from === optionId) return { ok: true, from, to: optionId, changed: false };
  st.plan[domain] = optionId;
  const today = care.tasks.filter((t) => t.resident === st.id && t.day === ctx.day);
  const done = today.filter((t) => t.domain === domain && t.status !== 'open'); // already under way or over today
  care.tasks = care.tasks.filter((t) => !(t.resident === st.id && t.day === ctx.day && t.domain === domain && t.status === 'open'));
  if (care.gen[`${ctx.day}:${ctx.band.id}`]) {
    const added = generateBand({ care, st, band: ctx.band, day: ctx.day, now: ctx.now + PLAN_CHANGE.minHoursLeft, rolesOnShift: ctx.rolesOnShift, only: { domain } });
    for (const t of added) {
      if (done.some((d) => d.type === t.type && d.band === t.band)) care.tasks.splice(care.tasks.indexOf(t), 1);
    }
  }
  const plan = st.plan;
  for (const t of care.tasks) {
    // a step no one has started helping with yet (open, or someone on the way) takes the new option's changes
    if (t.resident !== st.id || t.source !== 'routine' || !(t.status === 'open' || t.status === 'claimed') || t.day !== ctx.day) continue;
    const tpl = routineTemplate(ROUTINE.find((x) => x.id === t.stepId), plan, st.optionPrefs);
    Object.assign(t, { roles: tpl.roles, minutes: tpl.minutes, drops: tpl.drops, workLeft: tpl.minutes / 60, changedBy: tpl.changedBy });
    if (t.status === 'claimed' && !ctx.roleOf?.(t.slots[0])?.split(',').some((r) => t.roles.includes(r))) {
      t.status = 'open'; // the person on the way no longer fits: back on the board (the home world lets them go)
      t.slots = [null];
    }
  }
  return { ok: true, from, to: optionId, changed: true, text: `Care plan changed: ${domainById(domain).name} → ${o.name}` };
}

// --- call bells --------------------------------------------------------------------------------------------------------
export function bellState(care, residentId) {
  care.bells[residentId] ??= { log: [], count: 0, totalMin: 0, cooldownUntil: -1 };
  return care.bells[residentId];
}
export const openBell = (care, residentId) => care.tasks.find((t) => t.resident === residentId && t.type === 'bell' && isOpen(t)) ?? null;
// He rings when a need reaches the line (the highest one), unless a bell is already ringing or he rang a moment ago.
export function maybeRing(care, st, now, day) {
  if (openBell(care, st.id)) return null;
  const b = bellState(care, st.id);
  if (now < b.cooldownUntil) return null;
  let need = null;
  for (const n of NEEDS) if (st.needs[n.id] >= BELL.line && (!need || st.needs[n.id] > st.needs[need])) need = n.id;
  if (!need) return null;
  const t = makeTask(care, { type: 'bell', name: 'Call bell', resident: st.id, source: 'bell', need, place: 'resident', roles: [...BELL.roles], minutes: BELL.minutes, drops: { [need]: BELL.drop }, outcomes: {}, day, band: bandOfHour(now % 24).id, opens: now, due: 1e9, ringAt: now });
  care.tasks.push(t);
  return t;
}
// rec = { day, t (clock text), minutes, staffId, need }
export function recordResponse(care, residentId, rec) {
  const b = bellState(care, residentId);
  b.log.push(rec);
  if (b.log.length > BELL.keep) b.log.shift();
  b.count++;
  b.totalMin += rec.minutes;
}
export function bellSummary(care, residentId) {
  const b = bellState(care, residentId);
  const last = b.log.slice(-BELL.shown);
  const avg = last.length ? last.reduce((a, r) => a + r.minutes, 0) / last.length : null;
  return { last, avg, count: b.count, allAvg: b.count ? b.totalMin / b.count : null };
}

// --- Familiar Care ----------------------------------------------------------------------------------------------------
const famKey = (residentId, staffId) => `${residentId}|${staffId}`;
export const familiarityOf = (care, residentId, staffId) => care.familiarity[famKey(residentId, staffId)] ?? 0;
export function addFamiliarity(care, residentId, staffId, n = FAMILIARITY.perTask) {
  const k = famKey(residentId, staffId);
  care.familiarity[k] = Math.min(FAMILIARITY.cap, (care.familiarity[k] ?? 0) + n);
  return care.familiarity[k];
}
// The single most familiar of these staff (ties go to the first in team order); null while nobody has any.
export function mostFamiliar(care, residentId, staffIds) {
  let best = null;
  let bestN = 0;
  for (const id of staffIds) {
    const n = familiarityOf(care, residentId, id);
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best;
}
