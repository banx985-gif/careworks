// Safe capacity (Milestone 40b, data/balance.js SAFE_CAPACITY): how many residents the team can look after with every
// essential task done on time. On each day shift the lowest of its hands-on care, its meals and its medicine rounds, at night the night's
// checks; the team's number is its weakest shift. Pure: the Admissions sheet, the Care page, Rosie's hint and the Node
// tests read it as it is.
//   safeCapacityOf(people: [{ role, shift, skill? }], { stage }) → { n, byShift: { morning, afternoon, night }, weakest, need }
//     need: what the weakest shift is short of — 'care' | 'meals' | 'meds' | 'night'
//   skillRate(points) → the work speed of someone with these stat points (data/balance.js SKILL_SPEED)
import { SAFE_CAPACITY as S, SKILL_SPEED as K } from '../../data/balance.js';

export const skillRate = (points) => Math.min(K.max, 1 + K.k * Math.max(0, points / K.basePoints - 1));

export function safeCapacityOf(people, { stage = 1 } = {}) {
  const k = S.stageFactor?.[stage - 1] ?? 1; // (Part D: the longer walks in a bigger home)
  const weight = (q) => 1 + S.skillShare * ((q.skill ?? 1) - 1);
  const handsOf = (kind, sh) => people.filter((q) => q.shift === sh).reduce((t, q) => t + (S[kind].hands[q.role] ?? 0) * weight(q), 0);
  const byShift = {};
  const needOf = {};
  for (const sh of ['morning', 'afternoon']) {
    const care = Math.floor(handsOf('care', sh) * S.care.perHand[sh] * k + 1e-9);
    const meals = Math.floor(handsOf('meals', sh) * S.meals.perHand[sh] * k + 1e-9);
    const km = S.meds.stageFactor?.[stage - 1] ?? k; // (Milestone 40d: the round's own stage factor)
    const meds = Math.floor(handsOf('meds', sh) * S.meds.perHand[sh] * km + 1e-9); // (Milestone 40b Part D: the medicine rounds)
    byShift[sh] = Math.min(care, meals, meds);
    needOf[sh] = meds < Math.min(care, meals) ? 'meds' : care <= meals ? 'care' : 'meals';
  }
  const night = people.filter((q) => q.shift === 'night').reduce((t, q) => t + weight(q), 0);
  byShift.night = Math.floor(S.night.base + night * S.night.perHand * k + 1e-9);
  needOf.night = 'night';
  const weakest = Object.keys(byShift).sort((a, b) => byShift[a] - byShift[b])[0];
  return { n: Math.max(S.minimum, byShift[weakest]), byShift, weakest, need: needOf[weakest] };
}
