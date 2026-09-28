// Care plans (Milestone 4, bible §9): the six fixed domains and, for now, the first two options of each §9 table
// (PC01/02, CL01/02, MO01/02, NU01/02, SO01/02, EN01/02). The other 36 drop into CARE_OPTIONS unchanged at Milestone 8,
// with their eligibility rules and review / stale flags. Plain data only; the rules that read it are in
// src/systems/careTasks.js, and validateCarePlans() runs it through core/DataValidator.
//
// An option row:
//   id, domain, name, text (one plain line), roles (who is eligible to carry it out — bible §11 role ids),
//   minutesPerDay (rough staff time it costs a day; checked against its tasks)
//   tasks:   the tasks it adds each day — { type (data/tasks.js), name, at (hour it opens), band (its deadline band),
//            roles, minutes (time with him), place: 'resident' (wherever he is) | 'room' (his room),
//            drops (need points it takes off), outcomes (small outcome nudges), pref (optional: a preference key he may
//            say no to — bible §6) }
//   changes: how it changes a routine step's task — { step, minutes?, roles?, dropsAdd? }
//   eligibility / review: Milestone 8 (null until then)

export const DOMAINS = [
  { id: 'PC', name: 'Personal Care', need: 'personal' },
  { id: 'CL', name: 'Clinical/Nursing', need: 'clinical' },
  { id: 'MO', name: 'Mobility', need: 'mobility' },
  { id: 'NU', name: 'Nutrition', need: 'nutrition' },
  { id: 'SO', name: 'Social/Lifestyle', need: 'social' },
  { id: 'EN', name: 'Environment/Safety', need: null },
];
export const DOMAIN_IDS = DOMAINS.map((d) => d.id);
export const domainById = (id) => DOMAINS.find((d) => d.id === id) ?? null;

const ANY = ['RN', 'CW', 'LC', 'AH', 'HN'];

export const CARE_OPTIONS = [
  {
    id: 'PC01', domain: 'PC', name: 'Independent Prompt', roles: ['CW', 'RN'], minutesPerDay: 15,
    text: 'He washes and dresses himself; a carer prompts and checks in.',
    tasks: [{ type: 'personal', name: 'Personal care prompt', at: 7.5, band: 'morning', roles: ['CW', 'RN'], minutes: 15, place: 'resident', drops: { personal: 12 } }],
    changes: [],
  },
  {
    id: 'PC02', domain: 'PC', name: 'Standby Assist', roles: ['CW'], minutesPerDay: 40,
    text: 'A carer stands by while he washes and dresses, ready to help.',
    tasks: [{ type: 'personal', name: 'Standby personal care', at: 7.5, band: 'morning', roles: ['CW'], minutes: 30, place: 'resident', drops: { personal: 22 }, outcomes: { comfort: 1 } }],
    changes: [{ step: 'wake', minutes: 30, roles: ['CW'] }],
  },
  {
    id: 'CL01', domain: 'CL', name: 'Routine Observation', roles: ['RN'], minutesPerDay: 25,
    text: 'The nurse gives his morning medicines and checks on him each afternoon.',
    tasks: [
      { type: 'meds', name: 'Morning medication round', at: 9.5, band: 'morning', roles: ['RN'], minutes: 15, place: 'resident', drops: { clinical: 12 } },
      { type: 'observation', name: 'Afternoon check', at: 15, band: 'afternoon', roles: ['RN'], minutes: 10, place: 'resident', drops: { clinical: 8 } },
    ],
    changes: [],
  },
  {
    id: 'CL02', domain: 'CL', name: 'Medication Support', roles: ['RN'], minutesPerDay: 40,
    text: 'The nurse supports each medicine round, morning and midday.',
    tasks: [
      { type: 'meds', name: 'Morning medication round', at: 9.5, band: 'morning', roles: ['RN'], minutes: 25, place: 'resident', drops: { clinical: 15 } },
      { type: 'meds', name: 'Midday medication round', at: 12.5, band: 'afternoon', roles: ['RN'], minutes: 15, place: 'resident', drops: { clinical: 10 } },
    ],
    changes: [],
  },
  {
    id: 'MO01', domain: 'MO', name: 'Independent Mobility', roles: ['RN', 'AH'], minutesPerDay: 0,
    text: 'He walks on his own; the morning rest includes a quick mobility check.',
    tasks: [],
    changes: [],
  },
  {
    id: 'MO02', domain: 'MO', name: 'Walking Aid Support', roles: ['AH', 'CW', 'RN'], minutesPerDay: 50,
    text: 'He walks with his frame, and staff walk alongside him twice a day.',
    tasks: [
      { type: 'mobility', name: 'Walk with his frame', at: 10, band: 'morning', roles: ['AH', 'CW', 'RN'], minutes: 25, place: 'resident', drops: { mobility: 15 }, outcomes: { independence: 1 } },
      { type: 'mobility', name: 'Afternoon walk with his frame', at: 15.5, band: 'afternoon', roles: ['AH', 'CW', 'RN'], minutes: 25, place: 'resident', drops: { mobility: 12 }, outcomes: { independence: 1 } },
    ],
    changes: [],
  },
  {
    id: 'NU01', domain: 'NU', name: 'Standard Menu', roles: ['HN', 'CW'], minutesPerDay: 10,
    text: 'Meals from the standard menu, with an afternoon drinks round.',
    tasks: [{ type: 'hydration', name: 'Afternoon drinks round', at: 15, band: 'afternoon', roles: ['HN', 'CW'], minutes: 10, place: 'resident', drops: { nutrition: 10 } }],
    changes: [],
  },
  {
    id: 'NU02', domain: 'NU', name: 'High-Protein Plan', roles: ['HN', 'CW'], minutesPerDay: 20,
    text: 'Protein-rich meals and an afternoon protein snack.',
    tasks: [{ type: 'hydration', name: 'Protein snack', at: 15, band: 'afternoon', roles: ['HN', 'CW'], minutes: 20, place: 'resident', drops: { nutrition: 15 } }],
    changes: [
      { step: 'breakfast', dropsAdd: { nutrition: 5 } },
      { step: 'dinner', dropsAdd: { nutrition: 5 } },
    ],
  },
  {
    id: 'SO01', domain: 'SO', name: 'Independent Choice', roles: ['LC'], minutesPerDay: 0,
    text: 'He picks his own pastimes; Cards in the lounge is his choice.',
    tasks: [],
    changes: [],
  },
  {
    id: 'SO02', domain: 'SO', name: 'Small Group Activities', roles: ['LC'], minutesPerDay: 30,
    text: 'A small group activity in the lounge each afternoon, as well as Cards.',
    tasks: [{ type: 'activity', name: 'Small group activity', at: 15.5, band: 'afternoon', roles: ['LC'], minutes: 30, place: 'resident', drops: { social: 15, memory: 5 }, outcomes: { connection: 2 }, pref: 'groupActivity' }],
    changes: [],
  },
  {
    id: 'EN01', domain: 'EN', name: 'Standard Room', roles: ANY, minutesPerDay: 10,
    text: 'A tidy, safe room with a daily room check.',
    tasks: [{ type: 'roomCheck', name: 'Room check', at: 9.5, band: 'morning', roles: ANY, minutes: 10, place: 'room', outcomes: { comfort: 1, safety: 1 } }], // Milestone 6: 10:30 → 09:30 (longer walks in the bigger home)
    changes: [],
  },
  {
    id: 'EN02', domain: 'EN', name: 'Near Nurse Station', roles: ['RN', 'CW'], minutesPerDay: 20,
    text: 'Checked on whenever the nurse passes: room checks morning and afternoon.',
    tasks: [
      { type: 'roomCheck', name: 'Morning room check', at: 10, band: 'morning', roles: ['RN', 'CW'], minutes: 10, place: 'room', outcomes: { safety: 1.5 } },
      { type: 'roomCheck', name: 'Afternoon room check', at: 14.5, band: 'afternoon', roles: ['RN', 'CW'], minutes: 10, place: 'room', outcomes: { safety: 1.5 } },
    ],
    changes: [],
  },
].map((o) => ({ eligibility: null, review: null, ...o }));

// Preference keys a plan task can carry (a resident may say no to it — bible §6); data/residents.js prefs may use them.
export const PLAN_PREF_KEYS = [...new Set(CARE_OPTIONS.flatMap((o) => o.tasks.map((t) => t.pref).filter(Boolean)))];
export const optionById = (id) => CARE_OPTIONS.find((o) => o.id === id) ?? null;
export const optionsFor = (domain) => CARE_OPTIONS.filter((o) => o.domain === domain);
// A plan: { PC: 'PC01', CL: 'CL01', … } — exactly one option per domain.
export const DEFAULT_PLAN = Object.fromEntries(DOMAINS.map((d) => [d.id, optionsFor(d.id)[0].id]));
// A plan with one known option per domain: anything missing or unknown takes the fallback's (else the default).
export function ensurePlan(plan, fallback = DEFAULT_PLAN) {
  const out = {};
  for (const d of DOMAINS) {
    const id = plan?.[d.id];
    out[d.id] = optionById(id)?.domain === d.id ? id : optionById(fallback?.[d.id])?.domain === d.id ? fallback[d.id] : DEFAULT_PLAN[d.id];
  }
  return out;
}

// Check the options (debug builds at start-up, and the Node tests). v = a core/DataValidator.
//   known = { taskTypes: [ids], steps: [routine step ids], bands: [band ids], needs: [ids], outcomes: [ids], roles: [ids] }
export function validateCarePlans(v, known, list = CARE_OPTIONS) {
  v.uniqueIds('care options', list);
  const set = (k) => new Set(known[k] ?? []);
  const [types, steps, bands, needs, outcomes, roles] = ['taskTypes', 'steps', 'bands', 'needs', 'outcomes', 'roles'].map(set);
  for (const d of DOMAINS) v.check(list.some((o) => o.domain === d.id), `domain ${d.id} has no options`);
  for (const o of list) {
    const who = `care option ${o.id}`;
    v.check(/^(PC|CL|MO|NU|SO|EN)\d{2}$/.test(o.id) && o.id.startsWith(o.domain), `${who}: id must be <domain>nn`);
    v.check(!!domainById(o.domain), `${who}: unknown domain ${o.domain}`);
    for (const k of ['name', 'text']) v.check(typeof o[k] === 'string' && o[k].length > 0, `${who}: ${k} missing`);
    v.check(Array.isArray(o.roles) && o.roles.length > 0, `${who}: roles missing`);
    for (const r of o.roles ?? []) v.ref(who, 'role', r, roles);
    v.check(Number.isFinite(o.minutesPerDay) && o.minutesPerDay >= 0, `${who}: minutesPerDay`);
    let minutes = 0;
    for (const t of o.tasks ?? []) {
      const tw = `${who} task ${t.name}`;
      v.ref(tw, 'task type', t.type, types);
      v.ref(tw, 'band', t.band, bands);
      v.check(typeof t.at === 'number' && t.at >= 0 && t.at < 24, `${tw}: at`);
      v.check(['resident', 'room'].includes(t.place), `${tw}: place`);
      v.check(Number.isFinite(t.minutes) && t.minutes > 0, `${tw}: minutes`);
      for (const r of t.roles ?? []) v.ref(tw, 'role', r, roles);
      v.check((t.roles ?? []).length > 0, `${tw}: roles`);
      for (const n of Object.keys(t.drops ?? {})) v.ref(tw, 'need', n, needs);
      for (const n of Object.keys(t.outcomes ?? {})) v.ref(tw, 'outcome', n, outcomes);
      minutes += t.minutes;
    }
    for (const c of o.changes ?? []) {
      v.ref(who, 'routine step', c.step, steps);
      for (const n of Object.keys(c.dropsAdd ?? {})) v.ref(who, 'need', n, needs);
      for (const r of c.roles ?? []) v.ref(who, 'role', r, roles);
      if (c.minutes) minutes += c.minutes - 20; // a routine step's own help is 20 minutes (data/tasks.js)
    }
    v.check(Math.abs(minutes - o.minutesPerDay) <= 15, `${who}: minutesPerDay ${o.minutesPerDay} vs its tasks ${minutes}`);
  }
  return v;
}
