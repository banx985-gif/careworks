// Residents (bible §6–7). Milestone 2: RES01 Arthur Lane; Milestone 6 adds RES02–RES12 (they arrive as applicants, see
// src/systems/admissions.js); the other 48 rows drop into RESIDENTS unchanged in Milestone 9. Profiles are story seeds, not diagnoses: no clinical detail anywhere. Plain data only — the rules are in
// src/systems/residentNeeds.js; validateResidents() runs the list through core/DataValidator.
//
// A resident row:
//   id, name, age, support (primary support), personality, interest, visitors, stay (stay type), art (portrait key)
//   needs:    the six care-need domains, 0–100 (higher = more support needed right now)
//   outcomes: the five displayed outcomes, 0–100 (higher = better)
//   prefs:    each routine step and activity → 'accept' | 'prefer' | 'dislike' | 'refuse' (bible §6: a refusal is a
//             normal choice, never a failure). Anything not listed is 'accept'. Keys: routine step ids, and the
//             preference keys of care-plan tasks (Milestone 4, e.g. groupActivity).
//   plan:     the starting care plan, one option id per domain (Milestone 4, data/carePlans.js)
//   Milestone 6 (admissions, bible §8): room = the room template they want (data/rooms: RM01 Standard, RM04 High-Care,
//   RM05 Memory Support); needs = hard prerequisites the home must meet before they can be admitted — { room } a room
//   template the home must have free, { role } a role someone on the team must have; urgency 'Low' | 'Medium' | 'High'.
//   Their needs vary a little at admission (ADMISSION.needVariation), inside 0–100.

import { DOMAINS, optionById, PLAN_PREF_KEYS, OPTION_PREFS_BY_PERSONALITY } from './carePlans.js';

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
// Primary support (bible §7) → Support Level 1–5 (Milestone 6: Care Support Funding by level, data/balance.js).
export const SUPPORT_LEVELS = {
  'Light Support': 1,
  'Social Support': 2,
  'Nutrition Support': 2,
  'Mobility Support': 3,
  Rehabilitation: 3,
  'Memory Support': 4,
  'Clinical Support': 4,
  'High Care': 5,
};
export const STAY_TYPES = ['Respite', 'Long Term', 'Rehab/Short Stay', 'Palliative'];
export const URGENCY = ['Low', 'Medium', 'High'];
// Room templates (bible §10). Only the Standard Room can be placed until Milestone 10.
export const ROOM_TEMPLATES = {
  RM01: { name: 'Standard Room', placeable: true },
  RM04: { name: 'High-Care Room', placeable: false, unlock: 'Rank B' },
  RM05: { name: 'Memory Support Room', placeable: false, unlock: 'the Memory Wing' },
};
export const supportLevel = (def) => SUPPORT_LEVELS[def.support] ?? 1;

// Starting needs and plan by primary support (story seeds, no clinical detail). Outcomes start in the 60s–70s.
const BY_SUPPORT = {
  'Light Support': { needs: [20, 12, 18, 30, 10, 28], plan: {} },
  'Mobility Support': { needs: [38, 18, 55, 30, 12, 30], plan: { MO: 'MO02', PC: 'PC02' } },
  'Memory Support': { needs: [35, 20, 25, 30, 60, 42], plan: { SO: 'SO02' } },
  'Clinical Support': { needs: [30, 55, 28, 32, 15, 30], plan: { CL: 'CL02', EN: 'EN02' } },
  Rehabilitation: { needs: [30, 30, 50, 30, 10, 25], plan: { MO: 'MO02' } },
  'Nutrition Support': { needs: [25, 18, 22, 55, 12, 30], plan: { NU: 'NU02' } },
  'Social Support': { needs: [22, 12, 20, 30, 18, 55], plan: { SO: 'SO02' } },
  'High Care': { needs: [55, 55, 50, 40, 25, 35], plan: { PC: 'PC02', CL: 'CL02', MO: 'MO02', EN: 'EN02' } },
};
// Preferences by personality: what they enjoy and what they would rather skip (never a failure — bible §6).
const BY_PERSONALITY = {
  Chatty: { breakfast: 'prefer', cards: 'prefer', groupActivity: 'prefer', rest: 'dislike' },
  Curious: { cards: 'prefer', groupActivity: 'prefer' },
  'Stubbornly Independent': { rest: 'dislike', groupActivity: 'dislike', breakfast: 'accept' },
  Quiet: { cards: 'dislike', groupActivity: 'dislike', rest: 'prefer' },
  'Routine-Loving': { breakfast: 'prefer', dinner: 'prefer', rest: 'prefer' },
  Cheerful: { cards: 'prefer', dinner: 'prefer' },
  Independent: { rest: 'dislike', cards: 'accept' },
  Witty: { cards: 'prefer', groupActivity: 'prefer' },
  Reserved: { groupActivity: 'dislike', rest: 'prefer' },
  Warm: { breakfast: 'prefer', cards: 'prefer' },
};
const NEED_IDS = ['personal', 'clinical', 'mobility', 'nutrition', 'memory', 'social'];
const DEFAULT_PLAN = { PC: 'PC01', CL: 'CL01', MO: 'MO01', NU: 'NU01', SO: 'SO01', EN: 'EN01' };
// Hard prerequisites and the room they want, by primary support (the card's rule for now).
const ADMIT_RULES = {
  'Memory Support': { room: 'RM05', needs: { room: 'RM05' } },
  'High Care': { room: 'RM04', needs: { room: 'RM04' } },
  'Clinical Support': { room: 'RM01', needs: { role: 'RN' } },
};
const applicant = (n, name, age, support, personality, interest, visitors, stay, urgency, outcomes) => ({
  id: `RES${String(n).padStart(2, '0')}`,
  name, age, support, personality, interest, visitors, stay,
  art: `resident_res${String(n).padStart(2, '0')}`,
  needs: Object.fromEntries(NEED_IDS.map((id, i) => [id, BY_SUPPORT[support].needs[i]])),
  outcomes: { comfort: outcomes[0], independence: outcomes[1], mood: outcomes[2], connection: outcomes[3], safety: outcomes[4] },
  prefs: { wake: 'accept', breakfast: 'accept', rest: 'accept', cards: 'accept', dinner: 'accept', settle: 'accept', groupActivity: 'accept', ...BY_PERSONALITY[personality] },
  optionPrefs: { ...(OPTION_PREFS_BY_PERSONALITY[personality] ?? {}) }, // Milestone 8: care-plan options (data/carePlans.js)
  plan: { ...DEFAULT_PLAN, ...BY_SUPPORT[support].plan },
  room: ADMIT_RULES[support]?.room ?? 'RM01',
  ...(ADMIT_RULES[support]?.needs ? { requires: { ...ADMIT_RULES[support].needs } } : {}),
  urgency,
});
const ADMISSION_ROWS = [
  applicant(2, 'Betty Finch', 75, 'Mobility Support', 'Chatty', 'Football', 'Occasional family', 'Long Term', 'Medium', [66, 58, 72, 64, 70]),
  applicant(3, 'Colin Webb', 82, 'Memory Support', 'Curious', 'Fishing', 'Community visitor', 'Long Term', 'High', [64, 60, 66, 58, 62]),
  applicant(4, 'Dorothy Vale', 89, 'Clinical Support', 'Stubbornly Independent', 'Cards', 'Frequent family', 'Long Term', 'High', [62, 70, 64, 66, 60]),
  applicant(5, 'Edward Moss', 96, 'Rehabilitation', 'Quiet', 'Football', 'Occasional family', 'Rehab/Short Stay', 'Medium', [64, 56, 62, 58, 66]),
  applicant(6, 'Florence King', 68, 'Nutrition Support', 'Routine-Loving', 'Fishing', 'Community visitor', 'Long Term', 'Low', [66, 72, 68, 62, 74]),
  applicant(7, 'George Hale', 75, 'Social Support', 'Cheerful', 'Cards', 'Frequent family', 'Long Term', 'Low', [70, 74, 62, 52, 76]),
  applicant(8, 'Hazel Quinn', 82, 'High Care', 'Independent', 'Football', 'Occasional family', 'Long Term', 'High', [58, 50, 62, 60, 56]),
  applicant(9, 'Ivan Bell', 89, 'Light Support', 'Witty', 'Fishing', 'Community visitor', 'Long Term', 'Low', [72, 76, 74, 64, 78]),
  applicant(10, 'June Mercer', 96, 'Mobility Support', 'Reserved', 'Cards', 'Frequent family', 'Long Term', 'Medium', [64, 56, 66, 60, 66]),
  applicant(11, 'Ken Foster', 68, 'Memory Support', 'Warm', 'Football', 'Occasional family', 'Long Term', 'Medium', [66, 62, 70, 60, 64]),
  applicant(12, 'Lillian Reed', 75, 'Clinical Support', 'Chatty', 'Fishing', 'Community visitor', 'Long Term', 'Medium', [64, 68, 70, 66, 62]),
];

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
    prefs: { wake: 'accept', breakfast: 'prefer', rest: 'dislike', cards: 'prefer', dinner: 'accept', settle: 'accept', groupActivity: 'accept' },
    // Milestone 8: care-plan options he prefers / dislikes / refuses (the rest: accept) — Warm, like his personality row
    optionPrefs: { ...OPTION_PREFS_BY_PERSONALITY.Warm },
    // Milestone 4: his starting care plan (data/carePlans.js) — light support, so the first option in every domain.
    plan: { PC: 'PC01', CL: 'CL01', MO: 'MO01', NU: 'NU01', SO: 'SO01', EN: 'EN01' },
    room: 'RM01',
    urgency: 'Low',
  },
  // Milestone 6: RES02–RES12 (bible §7 rows). Starting needs follow their primary support; the plan's options suit it.
  ...ADMISSION_ROWS,
];
export const residentById = (id) => RESIDENTS.find((r) => r.id === id) ?? null;

// Check the list (debug builds at start-up, and the Node tests). v = a core/DataValidator.
export function validateResidents(v, list = RESIDENTS, stepIds = []) {
  const steps = new Set([...stepIds, ...PLAN_PREF_KEYS]);
  v.uniqueIds('residents', list);
  for (const r of list) {
    const who = `resident ${r.id}`;
    v.check(/^RES\d{2}$/.test(r.id), `${who}: id must be RESnn`);
    for (const k of ['name', 'personality', 'interest', 'visitors', 'art']) v.check(typeof r[k] === 'string' && r[k].length > 0, `${who}: ${k} missing`);
    v.check(Number.isInteger(r.age) && r.age >= 50 && r.age <= 110, `${who}: age out of range`);
    v.check(r.support in SUPPORT_LEVELS, `${who}: unknown support "${r.support}"`);
    v.check(STAY_TYPES.includes(r.stay), `${who}: unknown stay type "${r.stay}"`);
    // Milestone 6: the room they want, their hard prerequisites and urgency
    v.check(r.room in ROOM_TEMPLATES, `${who}: unknown room template "${r.room}"`);
    v.check(URGENCY.includes(r.urgency), `${who}: urgency must be ${URGENCY.join(' / ')}`);
    if (r.requires) {
      const keys = Object.keys(r.requires);
      v.check(keys.length > 0 && keys.every((k) => k === 'room' || k === 'role'), `${who}: requires takes room / role`);
      if (r.requires.room) v.check(r.requires.room in ROOM_TEMPLATES, `${who}: requires an unknown room "${r.requires.room}"`);
      if (r.requires.role) v.check(/^(RN|CW|LC|AH|HN)$/.test(r.requires.role), `${who}: requires an unknown role "${r.requires.role}"`);
    }
    for (const n of NEEDS) v.check(inRange(r.needs?.[n.id]), `${who}: need ${n.id} must be 0–100`);
    v.check(Object.keys(r.needs ?? {}).length === NEEDS.length, `${who}: exactly the six needs`);
    for (const o of OUTCOMES) v.check(inRange(r.outcomes?.[o.id]), `${who}: outcome ${o.id} must be 0–100`);
    v.check(Object.keys(r.outcomes ?? {}).length === OUTCOMES.length, `${who}: exactly the five outcomes`);
    for (const [step, p] of Object.entries(r.prefs ?? {})) {
      v.check(PREFS.includes(p), `${who}: preference "${p}" for ${step}`);
      if (steps.size) v.ref(who, 'routine step', step, steps);
    }
    // Milestone 8: care-plan option preferences
    for (const [id, p] of Object.entries(r.optionPrefs ?? {})) {
      v.check(PREFS.includes(p), `${who}: option preference "${p}" for ${id}`);
      v.check(!!optionById(id), `${who}: option preference for an unknown option ${id}`);
    }
    // the care plan: exactly one known option per domain
    v.check(!!r.plan && Object.keys(r.plan).length === DOMAINS.length, `${who}: plan needs one option per domain`);
    for (const d of DOMAINS) v.check(optionById(r.plan?.[d.id])?.domain === d.id, `${who}: plan ${d.id} is not a ${d.name} option`);
  }
  return v;
}
const inRange = (x) => typeof x === 'number' && x >= 0 && x <= 100;
