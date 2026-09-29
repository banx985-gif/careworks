// Staff (bible §12). Milestone 3: the ten Standard rows (RN01/02, CW01/02, LC01/02, AH01/02, HN01/02); Milestone 11
// adds the twenty Rare rows (xx03–xx06, tier 'rare') for recruitment; the Elite, Legendary and Secret rows arrive in
// Milestone 12. Plain data only; validateStaff() runs the list through
// core/DataValidator (staffRoster). Stats are CLN / PER / MOB / SOC / NUT; salary is Credits a month (stored only —
// nothing is paid until the economy, Milestone 22).
//   eligibility: 'start' (Start staff) · 'candidate' (Start candidate) · 'rank' (Rank D, the §12 column) ·
//   'milestone' (Role milestone) — for now every Rare row comes through the recruitment channels that offer Rare
//   (data/recruitment.js); the rank / milestone gates are Milestone 26's
//   shiftPref (Milestone 7, bible §11): the shift they prefer — 'morning' · 'afternoon' · 'night' (Night costs Morale unless
//   it is their preference; working the preferred shift lifts it a little: data/shifts.js SHIFT_MORALE)
//   trait: an id in TRAITS
import { ROLES, STAT_IDS, TIERS } from './roles.js';

const stats = (s) => Object.fromEntries(s.split('/').map((v, i) => [STAT_IDS[i], Number(v)]));
const row = (id, name, role, level, s, salary, trait, eligibility, shiftPref, tier = 'standard') => ({ id, name, role, tier, level, stats: stats(s), salary, traits: [trait], eligibility, shiftPref, art: `staff_${id.toLowerCase()}` });
const rare = (id, name, role, level, s, salary, trait, eligibility, shiftPref) => row(id, name, role, level, s, salary, trait, eligibility, shiftPref, 'rare');

export const STAFF = [
  row('RN01', 'Maya Finch', 'RN', 1, '105/57/64/71/78', 520, 'calmRound', 'start', 'morning'),
  row('RN02', 'Daniel Cross', 'RN', 2, '118/70/77/53/60', 560, 'carefulChart', 'candidate', 'night'),
  row('CW01', 'Ruby Hale', 'CW', 1, '59/121/73/80/56', 520, 'gentleHands', 'start', 'morning'),
  row('CW02', 'Arun Moss', 'CW', 2, '72/134/55/62/69', 560, 'morningPerson', 'candidate', 'morning'),
  row('LC01', 'Zoe Quinn', 'LC', 1, '68/75/51/113/65', 520, 'conversationStarter', 'start', 'afternoon'),
  row('LC02', 'Oscar Bell', 'LC', 2, '50/57/64/126/78', 560, 'creativeClub', 'candidate', 'afternoon'),
  row('AH01', 'Nia Foster', 'AH', 1, '77/53/115/67/74', 520, 'steadySteps', 'start', 'morning'),
  row('AH02', 'Hugo Pike', 'AH', 2, '59/66/128/80/56', 560, 'safeTransfers', 'candidate', 'afternoon'),
  row('HN01', 'Sam Kitchen', 'HN', 1, '55/62/69/76/107', 520, 'warmWelcome', 'start', 'morning'),
  row('HN02', 'Noor Price', 'HN', 2, '68/75/51/58/120', 560, 'hydrationEye', 'candidate', 'night'),
  // Milestone 11: the Rare rows (bible §12)
  rare('RN03', 'Priya Vale', 'RN', 4, '194/115/122/129/136', 1020, 'woundWise', 'rank', 'morning'),
  rare('RN04', 'Noah Mercer', 'RN', 6, '176/128/135/142/118', 1080, 'diabetesSupport', 'milestone', 'afternoon'),
  rare('RN05', 'Hana Reed', 'RN', 8, '189/141/117/124/131', 1140, 'familyCommunicator', 'milestone', 'afternoon'),
  rare('RN06', 'Elise Hart', 'RN', 10, '171/123/130/137/113', 1200, 'medicationFocus', 'milestone', 'night'),
  rare('CW03', 'Tessa Cole', 'CW', 4, '117/179/131/138/114', 1020, 'dignityFirst', 'rank', 'morning'),
  rare('CW04', 'Milo Grant', 'CW', 6, '130/192/113/120/127', 1080, 'fastResponse', 'milestone', 'night'),
  rare('CW05', 'Leila Park', 'CW', 8, '143/174/126/133/140', 1140, 'memoryFriendly', 'milestone', 'afternoon'),
  rare('CW06', 'Ben Rowan', 'CW', 10, '125/187/139/115/122', 1200, 'companion', 'milestone', 'morning'),
  rare('LC03', 'Mei Hart', 'LC', 4, '126/133/140/171/123', 1020, 'gardenLover', 'rank', 'morning'),
  rare('LC04', 'Theo Vale', 'LC', 6, '139/115/122/184/136', 1080, 'musicMaker', 'milestone', 'afternoon'),
  rare('LC05', 'Imani Reed', 'LC', 8, '121/128/135/197/118', 1140, 'communityLink', 'milestone', 'afternoon'),
  rare('LC06', 'Eli Bloom', 'LC', 10, '134/141/117/179/131', 1200, 'quietConnector', 'milestone', 'morning'),
  rare('AH03', 'Freya Lane', 'AH', 4, '135/142/173/125/132', 1020, 'balanceCoach', 'rank', 'morning'),
  rare('AH04', 'Joel Nash', 'AH', 6, '117/124/186/138/114', 1080, 'rehabPlanner', 'milestone', 'morning'),
  rare('AH05', 'Mina Stone', 'AH', 8, '130/137/168/120/127', 1140, 'fallsWatch', 'milestone', 'afternoon'),
  rare('AH06', 'Soren Ward', 'AH', 10, '143/119/181/133/140', 1200, 'independenceFirst', 'milestone', 'afternoon'),
  rare('HN03', 'Kira Wells', 'HN', 4, '113/120/127/134/196', 1020, 'comfortFood', 'rank', 'morning'),
  rare('HN04', 'Leo March', 'HN', 6, '126/133/140/116/178', 1080, 'textureExpert', 'milestone', 'afternoon'),
  rare('HN05', 'Zara Bloom', 'HN', 8, '139/115/122/129/191', 1140, 'dietMatch', 'milestone', 'morning'),
  rare('HN06', 'Dorian Cole', 'HN', 10, '121/128/135/142/173', 1200, 'diningHost', 'milestone', 'night'),
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
  // Milestone 11: the Rare staff's traits (placeholders like the Standard ones: stored and shown, applied later)
  woundWise: { name: 'Wound Wise', text: 'Skin and wound checks are more thorough', effects: { skinCarePct: 8 } },
  diabetesSupport: { name: 'Diabetes Support', text: 'Keeps a closer eye on blood sugar and meals', effects: { mealClinicalPct: 8 } },
  familyCommunicator: { name: 'Family Communicator', text: 'Families feel better informed', effects: { familyTrustPct: 6 } },
  medicationFocus: { name: 'Medication Focus', text: 'Medicine rounds are steadier', effects: { medRoundDelayPct: -8 } },
  dignityFirst: { name: 'Dignity First', text: 'Personal care keeps dignity and choice', effects: { comfortGainPct: 8 } },
  fastResponse: { name: 'Fast Response', text: 'Answers call bells a little faster', effects: { bellResponsePct: -10 } },
  memoryFriendly: { name: 'Memory Friendly', text: 'Calmer support for residents with memory needs', effects: { memoryCarePct: 8 } },
  companion: { name: 'Companion', text: 'One-to-one time lifts Mood a little more', effects: { oneToOneMoodPct: 8 } },
  gardenLover: { name: 'Garden Lover', text: 'Outdoor and garden activities go further', effects: { gardenActivityPct: 10 } },
  musicMaker: { name: 'Music Maker', text: 'Music activities lift Social Connection more', effects: { musicActivityPct: 10 } },
  communityLink: { name: 'Community Link', text: 'Brings visitors and volunteers in', effects: { communityEventPct: 8 } },
  quietConnector: { name: 'Quiet Connector', text: 'Reaches the residents who keep to themselves', effects: { quietResidentPct: 8 } },
  balanceCoach: { name: 'Balance Coach', text: 'Walking practice builds confidence', effects: { mobilityGainPct: 8 } },
  rehabPlanner: { name: 'Rehab Planner', text: 'Rehabilitation plans work a little faster', effects: { rehabSpeedPct: 8 } },
  fallsWatch: { name: 'Falls Watch', text: 'Spots a fall risk early', effects: { fallRiskPct: -10 } },
  independenceFirst: { name: 'Independence First', text: 'Helps residents do more for themselves', effects: { independenceGainPct: 8 } },
  comfortFood: { name: 'Comfort Food', text: 'Favourite meals lift Mood', effects: { mealMoodPct: 8 } },
  textureExpert: { name: 'Texture Expert', text: 'Texture-modified meals are safer and nicer', effects: { textureMealPct: 10 } },
  dietMatch: { name: 'Diet Match', text: 'Special diets are matched with care', effects: { dietPlanPct: 8 } },
  diningHost: { name: 'Dining Host', text: 'Mealtimes are more sociable', effects: { diningConnectionPct: 8 } },
};

// Check the list (debug builds at start-up, and the Node tests). v = a core/DataValidator.
export function validateStaff(v, list = STAFF) {
  v.staffRoster('staff', list, { roles: ROLES, tiers: TIERS, traits: TRAITS, statKeys: STAT_IDS });
  for (const s of list) {
    const who = `staff ${s.id}`;
    v.check(/^(RN|CW|LC|AH|HN)\d{2}$/.test(s.id) && s.id.startsWith(s.role), `${who}: id must be <role>nn`);
    v.check(Number.isInteger(s.salary) && s.salary > 0, `${who}: salary`);
    v.check(['start', 'candidate', 'rank', 'milestone'].includes(s.eligibility), `${who}: eligibility "${s.eligibility}"`);
    v.check(s.tier === 'standard' ? ['start', 'candidate'].includes(s.eligibility) : s.tier === 'rare', `${who}: tier ${s.tier} with eligibility ${s.eligibility}`); // (Milestone 11: Standard + Rare only)
    v.check(s.art === `staff_${s.id.toLowerCase()}`, `${who}: art key`);
    v.check(['morning', 'afternoon', 'night'].includes(s.shiftPref), `${who}: shift preference "${s.shiftPref}"`);
    // the role's primary stat is their best
    const best = STAT_IDS.reduce((a, k) => (s.stats[k] > s.stats[a] ? k : a), STAT_IDS[0]);
    v.check(best === ROLES[s.role]?.primaryStat, `${who}: primary stat is not their highest`);
  }
  return v;
}
