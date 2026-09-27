// A new facility's campaign save and its slot summary (Milestones 0–2, bible §3.5 / §42). Pure data in, data out, so
// the Node tests can use it.
//   newCampaign(setup, now)   the run save START FACILITY writes: the facility, the clock (Milestone 2) and the
//                             residents' state (Arthur only for now)
//   slotSummary(data)         the small record the Campaign Slots screen reads without loading the campaign
//   SAVE_MIGRATIONS           older saves → this version: v1 (Milestones 0–1) had no clock and no resident state
import { founderById, paletteById, ROLES, FOUNDER_FLAG } from '../../data/setup.js';
import { residentById } from '../../data/residents.js';
import { RESIDENT } from '../../data/home.js';
import { makeClock } from './homeWorld.js';
import { newResidentState } from './residentNeeds.js';

const freshResidents = () => [newResidentState(residentById(RESIDENT.id), { room: RESIDENT.room })];
const dateOf = (clock) => ({ year: clock.year, month: clock.month, day: clock.day });

// The campaign save written by START FACILITY. setup = { facility, director, palette, founder }.
export function newCampaign(setup, now = Date.now()) {
  const founder = founderById(setup.founder);
  if (!founder) throw new Error(`Unknown founder ${setup.founder}`);
  const clock = makeClock().serialize();
  return {
    facility: {
      name: setup.facility,
      director: setup.director,
      palette: paletteById(setup.palette).id,
      founder: { id: founder.id, [FOUNDER_FLAG]: true }, // history counters (bible §3.5.5) join in later milestones
      createdAt: now,
    },
    seed: `careworks-${now}`, // the run's seed: the residents' daily yes / no answers (a reload never rerolls them)
    clock,
    date: dateOf(clock),
    residents: freshResidents(),
    playSec: 0,
    ngPlus: 0,
  };
}

// The small record the Campaign Slots screen reads (bible §3.5.9: readable without loading the full simulation).
// Rank, grade and resident count stay out until those systems exist (card: zero or hidden).
export function slotSummary(data) {
  const f = data.facility;
  const founder = founderById(f.founder.id);
  const when = data.clock ?? data.date;
  return {
    facility: f.name,
    director: f.director,
    palette: f.palette,
    founderId: founder?.id ?? f.founder.id,
    founderName: founder?.name ?? f.founder.id,
    founderRole: founder ? ROLES[founder.role].name : '',
    year: when.year,
    month: when.month,
    ngPlus: data.ngPlus ?? 0,
    playSec: data.playSec ?? 0,
  };
}

// Version 1 → 2 (Milestone 2): a clock from the saved date, starting just before Arthur wakes; Arthur on his defaults.
export function upgradeV1(data) {
  const clock = makeClock();
  const d = data.date ?? { year: 1, month: 1, day: 1 };
  clock.year = d.year;
  clock.month = d.month;
  clock.day = d.day;
  clock.totalDays = ((d.year - 1) * clock.monthsPerYear + (d.month - 1)) * clock.daysPerMonth + (d.day - 1);
  return {
    ...data,
    seed: data.seed ?? `careworks-${data.facility?.createdAt ?? 0}`,
    clock: data.clock ?? clock.serialize(),
    residents: Array.isArray(data.residents) ? data.residents : freshResidents(),
  };
}
export const SAVE_MIGRATIONS = {
  1: (record) => ({ ...record, data: upgradeV1(record.data) }),
};

// "Facility Director Aaron — Banks Care" (bible §3.5.2).
export const directorLine = (director, facility) => `Facility Director ${director || '…'} — ${facility || '…'}`;
