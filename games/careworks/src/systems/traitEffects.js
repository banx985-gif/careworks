// Trait effects (Milestone 12, bible §11 / §12). Each trait in data/staff.js TRAITS either has small live effects on
// hooks the game already has, or waits for a later milestone's system (pendingSystem: a no-op here). Pure functions on a
// person's trait ids, so the task AI, the crew's Energy / Morale and Familiar Care read them the same way.
//   taskPct(traits, type)      % more of the needs a task of this type eases when they help ('task')
//   matchesTask(traits, type)  a specialty-like tip in the task AI ('match')
//   energyPct(traits, shift)   % change to the Energy they use on shift ('energy'; only on its shift, if it names one)
//   moralePerHour(traits)      Morale they gain an hour while working ('morale')
//   familiarPct(traits)        % faster Familiar Care ('familiar')
//   shiftPct(traits)           % more Morale from working their preferred shift ('shift')
//   isLive(id) · pendingOf(id) → 'Mnn' | null
import { TRAITS } from '../../data/staff.js';

const effectsOf = (traits, kind) => (traits ?? []).flatMap((id) => (TRAITS[id]?.live ?? []).filter((fx) => fx.kind === kind));
const sum = (list, key) => list.reduce((a, fx) => a + (fx[key] ?? 0), 0);

export const taskPct = (traits, type) => sum(effectsOf(traits, 'task').filter((fx) => fx.types.includes(type)), 'pct');
export const matchesTask = (traits, type) => effectsOf(traits, 'match').some((fx) => fx.types.includes(type));
export const energyPct = (traits, shift) => sum(effectsOf(traits, 'energy').filter((fx) => !fx.shift || fx.shift === shift), 'pct');
export const moralePerHour = (traits) => sum(effectsOf(traits, 'morale'), 'perHour');
export const familiarPct = (traits) => sum(effectsOf(traits, 'familiar'), 'pct');
export const shiftPct = (traits) => sum(effectsOf(traits, 'shift'), 'pct');
export const isLive = (id) => !!TRAITS[id]?.live;
export const pendingOf = (id) => TRAITS[id]?.pendingSystem ?? null;
