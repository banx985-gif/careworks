// Staff (bible §12). Milestone 3: the ten Standard rows only (RN01/02, CW01/02, LC01/02, AH01/02, HN01/02); the other
// 40 drop into STAFF unchanged in Milestone 12. Plain data only; validateStaff() runs the list through
// core/DataValidator (staffRoster). Stats are CLN / PER / MOB / SOC / NUT; salary is Credits a month (stored only —
// nothing is paid until the economy, Milestone 22).
//   eligibility: 'start' (Start staff) · 'candidate' (Start candidate) · later rows: 'rank', 'milestone', 'secret' …
//   trait: an id in TRAITS
import { ROLES, STAT_IDS, TIERS } from './roles.js';

const stats = (s) => Object.fromEntries(s.split('/').map((v, i) => [STAT_IDS[i], Number(v)]));
const row = (id, name, role, level, s, salary, trait, eligibility) => ({ id, name, role, tier: 'standard', level, stats: stats(s), salary, traits: [trait], eligibility, art: `staff_${id.toLowerCase()}` });

export const STAFF = [
  row('RN01', 'Maya Finch', 'RN', 1, '105/57/64/71/78', 520, 'calmRound', 'start'),
  row('RN02', 'Daniel Cross', 'RN', 2, '118/70/77/53/60', 560, 'carefulChart', 'candidate'),
  row('CW01', 'Ruby Hale', 'CW', 1, '59/121/73/80/56', 520, 'gentleHands', 'start'),
  row('CW02', 'Arun Moss', 'CW', 2, '72/134/55/62/69', 560, 'morningPerson', 'candidate'),
  row('LC01', 'Zoe Quinn', 'LC', 1, '68/75/51/113/65', 520, 'conversationStarter', 'start'),
  row('LC02', 'Oscar Bell', 'LC', 2, '50/57/64/126/78', 560, 'creativeClub', 'candidate'),
  row('AH01', 'Nia Foster', 'AH', 1, '77/53/115/67/74', 520, 'steadySteps', 'start'),
  row('AH02', 'Hugo Pike', 'AH', 2, '59/66/128/80/56', 560, 'safeTransfers', 'candidate'),
  row('HN01', 'Sam Kitchen', 'HN', 1, '55/62/69/76/107', 520, 'warmWelcome', 'start'),
  row('HN02', 'Noor Price', 'HN', 2, '68/75/51/58/120', 560, 'hydrationEye', 'candidate'),
];
export const staffById = (id) => STAFF.find((s) => s.id === id) ?? null;

// Traits (bible §12 names them; the effects are placeholders — one line each, stored and shown, not applied until the
// systems they touch exist). effects: numbers for later, in the StaffSystem trait format.
export const TRAITS = {
  calmRound: { name: 'Calm Round', text: 'Medication rounds run a little steadier', effects: { medRoundDelayPct: -5 } },
  carefulChart: { name: 'Careful Chart', text: 'Care notes and reviews are more thorough', effects: { reviewQualityPct: 5 } },
  gentleHands: { name: 'Gentle Hands', text: 'Personal care is a little more comfortable', effects: { comfortGainPct: 5 } },
  morningPerson: { name: 'Morning Person', text: 'Tires more slowly on the Morning shift', effects: { morningEnergyLossPct: -10 } },
  conversationStarter: { name: 'Conversation Starter', text: 'Activities lift Social Connection a little more', effects: { connectionGainPct: 5 } },
  creativeClub: { name: 'Creative Club', text: 'Craft and music activities go further', effects: { creativeActivityPct: 8 } },
  steadySteps: { name: 'Steady Steps', text: 'Walking support is a little safer', effects: { fallRiskPct: -5 } },
  safeTransfers: { name: 'Safe Transfers', text: 'Moving and lifting help is safer', effects: { transferRiskPct: -8 } },
  warmWelcome: { name: 'Warm Welcome', text: 'Meals feel more welcoming', effects: { mealMoodPct: 5 } },
  hydrationEye: { name: 'Hydration Eye', text: 'Spots when a resident needs a drink', effects: { hydrationPct: 8 } },
};

// Check the list (debug builds at start-up, and the Node tests). v = a core/DataValidator.
export function validateStaff(v, list = STAFF) {
  v.staffRoster('staff', list, { roles: ROLES, tiers: TIERS, traits: TRAITS, statKeys: STAT_IDS });
  for (const s of list) {
    const who = `staff ${s.id}`;
    v.check(/^(RN|CW|LC|AH|HN)\d{2}$/.test(s.id) && s.id.startsWith(s.role), `${who}: id must be <role>nn`);
    v.check(Number.isInteger(s.salary) && s.salary > 0, `${who}: salary`);
    v.check(['start', 'candidate'].includes(s.eligibility), `${who}: eligibility "${s.eligibility}"`);
    v.check(s.art === `staff_${s.id.toLowerCase()}`, `${who}: art key`);
    // the role's primary stat is their best
    const best = STAT_IDS.reduce((a, k) => (s.stats[k] > s.stats[a] ? k : a), STAT_IDS[0]);
    v.check(best === ROLES[s.role]?.primaryStat, `${who}: primary stat is not their highest`);
  }
  return v;
}
