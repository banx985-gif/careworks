// Trainee carers, nurses and allied health (Milestone 40e, BIGJOB3 Part A: the fix for growth). Plain data only.
// The bible's 40 named people hold only 24 who give hands-on care, so a home levelled off at ~19 residents. Trainees are an
// endless pool below Standard, in the three hands-on roles only: Recruit always shows 2–3 of them (src/systems/staffing.js),
// they start slow and cheap, and grow through courses up to the Rare stat cap — a Trainee who sticks around becomes a real
// asset (and, after 3 years at the Rare cap, "Home-grown").
//
// A Trainee is made from their id alone (traineeDef), so a reload, the Hall of Fame and every staffById() lookup give the
// same person: id = TR<role><serial>, e.g. TRCW1042. The serial counts up per home from a start picked by the home's seed
// (staffing state .traineeNext), so two homes meet different people.
//   name   FIRST × LAST (64 × 61, coprime: 3,904 serials in a row never repeat a name) — plain everyday names, no public figures
//   look   one of the role's looks (art key trainee_<role>_<nn>: a series chibi base recoloured to the role's uniform colour,
//          data/trainee_chibis.json; card still assets/images/staff/, walking sheet assets/images/walkers/). Looks repeat;
//          names don't.
//   stats  low (a Standard person's primary is 107–134; a Trainee's 88–101), primary still their best
//   trait  about half have one ordinary trait from their role's Standard people (TRAINEE.traits)
import { STAT_IDS } from './roles.js';

export const TRAINEE = {
  roles: ['CW', 'RN', 'AH'],
  looks: { CW: 10, RN: 8, AH: 6 },
  // the role of each new Trainee card, by weight (carers do most of the hands-on work)
  roleWeights: { CW: 5, RN: 3, AH: 2 },
  // Recruit: always this many Trainee cards (short: when the home's safe capacity is at or under the residents here)
  board: { usual: 2, short: 3 },
  // wage: about 70% of a Standard person's 520–560
  salary: { min: 360, step: 10, steps: 4 },
  // a fresh Trainee works at 85% of a Standard person's pace; it rises with their primary stat, reaching full pace at a
  // Standard person's level (primary 120) — past that the usual SKILL_SPEED takes over. Safe capacity counts them the same way.
  speed: { start: 0.85, fromPrimary: 94, fullAt: 120 },
  // Home-grown: 3 years' service and their primary stat at the Rare cap (data/roles.js TIERS.rare.statCap)
  homeGrown: { days: 3 * 336, statCap: 300 },
  traits: { CW: ['gentleHands', 'morningPerson'], RN: ['calmRound', 'carefulChart'], AH: ['steadySteps', 'safeTransfers'] },
  shifts: ['morning', 'morning', 'morning', 'morning', 'afternoon', 'afternoon', 'afternoon', 'night'],
  serialStart: { min: 1000, span: 7000 },
  idPattern: /^TR(CW|RN|AH)(\d+)$/,
  badge: 'Home-grown',
  badgeLine: 'Started here as a Trainee and grew into one of the best',
  cardNote: 'A Trainee: slower at first, grows with courses up to the Rare level',
};

export const FIRST = [
  'Amy', 'Ben', 'Chloe', 'Dan', 'Ella', 'Finn', 'Grace', 'Harry', 'Isla', 'Jack', 'Kate', 'Liam', 'Megan', 'Nathan', 'Olivia', 'Paul',
  'Rosa', 'Sean', 'Tara', 'Umar', 'Vicky', 'Will', 'Yasmin', 'Zac', 'Abby', 'Callum', 'Daisy', 'Ethan', 'Freya', 'Gareth', 'Holly', 'Ian',
  'Jade', 'Kieran', 'Lucy', 'Marcus', 'Nadia', 'Owen', 'Poppy', 'Ravi', 'Sophie', 'Tom', 'Anya', 'Bilal', 'Cara', 'Dev', 'Erin', 'Femi',
  'Gemma', 'Hassan', 'Imogen', 'Jonah', 'Leah', 'Mo', 'Niamh', 'Ollie', 'Priya', 'Reece', 'Sana', 'Theo', 'Uma', 'Wes', 'Zara', 'Kofi',
];
export const LAST = [
  'Abbott', 'Baker', 'Carter', 'Dale', 'Ellis', 'Fowler', 'Gill', 'Hughes', 'Irwin', 'Jarvis', 'Kaur', 'Lane', 'Mason', 'Nolan', 'Okafor',
  'Parry', 'Rahman', 'Shaw', 'Turner', 'Upton', 'Vaughan', 'Webb', 'Young', 'Ahmed', 'Barnes', 'Chandler', 'Dixon', 'Evans', 'Fisher',
  'Grant', 'Hayes', 'Ingram', 'Jones', 'Khan', 'Lloyd', 'Morris', 'Nash', 'Owens', 'Patel', 'Reid', 'Singh', 'Taylor', 'Walsh', 'Bryant',
  'Clarke', 'Doyle', 'Field', 'Gordon', 'Hart', 'Kemp', 'Lowe', 'Marsh', 'Novak', 'Osei', 'Payne', 'Quinlan', 'Rowe', 'Stone', 'Tran',
  'Wood', 'Yates',
];

const hashOf = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
};
export const isTraineeId = (id) => TRAINEE.idPattern.test(String(id ?? ''));
export const traineeId = (role, serial) => `TR${role}${serial}`;
// The first serial a home's Trainees count up from (picked by its seed).
export const firstSerial = (seed) => TRAINEE.serialStart.min + (hashOf(`trainee:${seed}`) % TRAINEE.serialStart.span);
// Which role the next Trainee card is: by weight, from a 0–1 roll.
export function traineeRoleFor(roll) {
  const total = Object.values(TRAINEE.roleWeights).reduce((a, b) => a + b, 0);
  let r = roll * total;
  for (const [role, w] of Object.entries(TRAINEE.roleWeights)) if ((r -= w) < 0) return role;
  return 'CW';
}
const PRIMARY = { CW: 'PER', RN: 'CLN', AH: 'MOB' };

const cache = new Map();
// The whole person from their id (null when it isn't a Trainee id).
export function traineeDef(id) {
  if (cache.has(id)) return cache.get(id);
  const m = TRAINEE.idPattern.exec(String(id ?? ''));
  if (!m) return null;
  const role = m[1];
  const serial = Number(m[2]);
  const h = hashOf(id);
  const look = String((serial % TRAINEE.looks[role]) + 1).padStart(2, '0');
  const stats = {};
  STAT_IDS.forEach((k, i) => (stats[k] = 40 + ((h >>> (i * 4)) % 21)));
  stats[PRIMARY[role]] = 88 + ((h >>> 20) % 14);
  const pool = TRAINEE.traits[role];
  const traits = (h >>> 9) % 2 === 0 ? [pool[(h >>> 11) % pool.length]] : [];
  const def = {
    id,
    name: `${FIRST[serial % FIRST.length]} ${LAST[serial % LAST.length]}`,
    role,
    tier: 'trainee',
    level: 1,
    stats,
    salary: TRAINEE.salary.min + TRAINEE.salary.step * ((h >>> 14) % TRAINEE.salary.steps),
    traits,
    eligibility: 'trainee',
    rule: { type: 'trainee', text: 'Always on Recruit' },
    shiftPref: TRAINEE.shifts[(h >>> 17) % TRAINEE.shifts.length],
    art: `trainee_${role.toLowerCase()}_${look}`,
    trainee: true,
  };
  cache.set(id, def);
  return def;
}
// Every look's art key (the asset list and the art check).
export const TRAINEE_ARTS = TRAINEE.roles.flatMap((r) => Array.from({ length: TRAINEE.looks[r] }, (_, i) => `trainee_${r.toLowerCase()}_${String(i + 1).padStart(2, '0')}`));

// A Trainee's work pace (×) from their primary stat: 85% when new, a Standard person's 1.0 at primary 120.
export function traineePace(primary) {
  const s = TRAINEE.speed;
  const t = Math.max(0, Math.min(1, (primary - s.fromPrimary) / (s.fullAt - s.fromPrimary)));
  return s.start + (1 - s.start) * t;
}
export const traineePaceOf = (role, stats) => traineePace(stats?.[PRIMARY[role]] ?? 0);

// Words on screen (Milestone 40e).
export const TRAINEE_TEXT = {
  recruitLine: 'Trainees are always here: slower and cheaper at first, they grow with courses up to the Rare level.',
};
