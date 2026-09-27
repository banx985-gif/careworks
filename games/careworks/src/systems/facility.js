// A new facility's campaign save and its slot summary (Milestone 0, bible §3.5). Pure data in, data out, so the
// Node tests can use it. The simulation arrives milestone by milestone; for now a campaign is its identity and date.
import { founderById, paletteById, ROLES, FOUNDER_FLAG } from '../../data/setup.js';

// The campaign save written by START FACILITY. setup = { facility, director, palette, founder }.
export function newCampaign(setup, now = Date.now()) {
  const founder = founderById(setup.founder);
  if (!founder) throw new Error(`Unknown founder ${setup.founder}`);
  return {
    facility: {
      name: setup.facility,
      director: setup.director,
      palette: paletteById(setup.palette).id,
      founder: { id: founder.id, [FOUNDER_FLAG]: true }, // history counters (bible §3.5.5) join in later milestones
      createdAt: now,
    },
    date: { year: 1, month: 1, day: 1 },
    playSec: 0,
    ngPlus: 0,
  };
}

// The small record the Campaign Slots screen reads (bible §3.5.9: readable without loading the full simulation).
// Rank, grade and resident count stay out until those systems exist (card: zero or hidden).
export function slotSummary(data) {
  const f = data.facility;
  const founder = founderById(f.founder.id);
  return {
    facility: f.name,
    director: f.director,
    palette: f.palette,
    founderId: founder?.id ?? f.founder.id,
    founderName: founder?.name ?? f.founder.id,
    founderRole: founder ? ROLES[founder.role].name : '',
    year: data.date.year,
    month: data.date.month,
    ngPlus: data.ngPlus ?? 0,
    playSec: data.playSec ?? 0,
  };
}

// "Facility Director Aaron — Banks Care" (bible §3.5.2).
export const directorLine = (director, facility) => `Facility Director ${director || '…'} — ${facility || '…'}`;
