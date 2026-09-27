// Residents (bible §6–7). Milestone 2: RES01 Arthur Lane only; the other 59 rows drop into RESIDENTS unchanged in
// Milestone 9. Profiles are story seeds, not diagnoses: no clinical detail anywhere. Plain data only — the rules are in
// src/systems/residentNeeds.js; validateResidents() runs the list through core/DataValidator.
//
// A resident row:
//   id, name, age, support (primary support), personality, interest, visitors, stay (stay type), art (portrait key)
//   needs:    the six care-need domains, 0–100 (higher = more support needed right now)
//   outcomes: the five displayed outcomes, 0–100 (higher = better)
//   prefs:    each routine step and activity → 'accept' | 'prefer' | 'dislike' | 'refuse' (bible §6: a refusal is a
//             normal choice, never a failure). Anything not listed is 'accept'.

export const NEEDS = [
  { id: 'personal', name: 'Personal Support' },
  { id: 'clinical', name: 'Clinical/Nursing' },
  { id: 'mobility', name: 'Mobility' },
  { id: 'nutrition', name: 'Nutrition' },
  { id: 'memory', name: 'Memory/Cognition' },
  { id: 'social', name: 'Social Support' },
];
export const OUTCOMES = [
  { id: 'comfort', name: 'Comfort' },
  { id: 'independence', name: 'Independence' },
  { id: 'mood', name: 'Mood' },
  { id: 'connection', name: 'Social Connection' },
  { id: 'safety', name: 'Safety' },
];
export const PREFS = ['accept', 'prefer', 'dislike', 'refuse'];
export const SUPPORT_LEVELS = ['Light Support', 'Mobility Support', 'Memory Support', 'Clinical Support', 'Complex Support'];
export const STAY_TYPES = ['Respite', 'Long Term', 'Rehabilitation', 'Palliative'];

export const RESIDENTS = [
  {
    id: 'RES01',
    name: 'Arthur Lane',
    age: 68,
    support: 'Light Support',
    personality: 'Warm',
    interest: 'Cards',
    visitors: 'Frequent family',
    stay: 'Respite',
    art: 'resident_res01',
    needs: { personal: 20, clinical: 12, mobility: 18, nutrition: 30, memory: 10, social: 28 },
    outcomes: { comfort: 70, independence: 78, mood: 72, connection: 60, safety: 80 },
    // Warm and sociable: loves his Cards and a good breakfast, would rather not sit in his room mid-morning.
    prefs: { wake: 'accept', breakfast: 'prefer', rest: 'dislike', cards: 'prefer', dinner: 'accept', settle: 'accept' },
  },
];
export const residentById = (id) => RESIDENTS.find((r) => r.id === id) ?? null;

// Check the list (debug builds at start-up, and the Node tests). v = a core/DataValidator.
export function validateResidents(v, list = RESIDENTS, stepIds = []) {
  const steps = new Set(stepIds);
  v.uniqueIds('residents', list);
  for (const r of list) {
    const who = `resident ${r.id}`;
    v.check(/^RES\d{2}$/.test(r.id), `${who}: id must be RESnn`);
    for (const k of ['name', 'personality', 'interest', 'visitors', 'art']) v.check(typeof r[k] === 'string' && r[k].length > 0, `${who}: ${k} missing`);
    v.check(Number.isInteger(r.age) && r.age >= 50 && r.age <= 110, `${who}: age out of range`);
    v.check(SUPPORT_LEVELS.includes(r.support), `${who}: unknown support "${r.support}"`);
    v.check(STAY_TYPES.includes(r.stay), `${who}: unknown stay type "${r.stay}"`);
    for (const n of NEEDS) v.check(inRange(r.needs?.[n.id]), `${who}: need ${n.id} must be 0–100`);
    v.check(Object.keys(r.needs ?? {}).length === NEEDS.length, `${who}: exactly the six needs`);
    for (const o of OUTCOMES) v.check(inRange(r.outcomes?.[o.id]), `${who}: outcome ${o.id} must be 0–100`);
    v.check(Object.keys(r.outcomes ?? {}).length === OUTCOMES.length, `${who}: exactly the five outcomes`);
    for (const [step, p] of Object.entries(r.prefs ?? {})) {
      v.check(PREFS.includes(p), `${who}: preference "${p}" for ${step}`);
      if (steps.size) v.ref(who, 'routine step', step, steps);
    }
  }
  return v;
}
const inRange = (x) => typeof x === 'number' && x >= 0 && x <= 100;
