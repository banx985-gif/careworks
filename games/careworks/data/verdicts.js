// CAREWORKS — the verdict calendar (Milestone 32b; Kairosoft gaps 1 and 2, SERIES_KAIROSOFT_LESSONS.md rules 1–2).
// Four named inspectors show the routine review's and an accreditation inspection's existing maths in four parts (the
// grade still comes from data/quality.js ROUTINE_GRADE, unchanged); the Community Open Day every Month 7; the Year-end
// Awards Evening every Month 12 (the routine review and the recognition table as one ceremony). Nothing here is bought.
//
// PLACEHOLDERS (DECISIONS.md, M32b): the comments, the Open Day's day, every place threshold and reward.

import { castFor, guideSays } from './cast.js';

// The inspectors (names and series chibi ids from data/cast.js, Milestone 32c). `categories` are ROUTINE_GRADE category ids:
// each category belongs to exactly one inspector, so their points add up to the review's own total. Portraits are name
// badges drawn in code until the series sprite sheets come (chibi 14, 27, 25, 07) — no new art keys.
export const INSPECTORS = [
  { id: 'clinical', role: 'Clinical inspector', looks: 'Clinical Safety and essential care', categories: ['clinical', 'care'], color: '#3E7CB1', openDay: 'a calm, well-run day: essential care done, programs running' },
  { id: 'wellbeing', role: 'Wellbeing inspector', looks: 'Resident Wellbeing', categories: ['wellbeing'], color: '#6FA86A', openDay: 'how the residents seemed' },
  { id: 'family', role: 'Family inspector', looks: 'Family Trust', categories: ['family'], color: '#C8634E', openDay: 'how welcome the families felt' },
  { id: 'environment', role: 'Environment inspector', looks: 'Environment & Compliance and Staff Wellbeing', categories: ['environment', 'staff'], color: '#8A6CC0', openDay: 'the rooms, the grounds and the team' },
].map((i) => ({ ...i, name: castFor(i.id).name, chibi: castFor(i.id).chibi, cast: castFor(i.id).id }));
export const inspectorById = (id) => INSPECTORS.find((i) => i.id === id) ?? null;
export const PANEL_MAX = 10; // each inspector's score is out of 10; four of them out of 40

// One short plain comment per inspector and score band (the band of the score out of 10: 0–3, 4–5, 6–7, 8–9, 10).
const BANDS = [3, 5, 7, 9, 10];
const COMMENTS = {
  clinical: ['Care was missed too often. That comes first.', 'Care is there, but it slips on busy shifts.', 'Safe, steady care. A few gaps to close.', 'Care is safe and on time, day and night.', 'Faultless. Every resident cared for, every time.'],
  wellbeing: ['Residents seem a little lost. They need more of what they love.', 'Some residents are content; others are waiting for something to do.', 'Residents are comfortable here. A little more joy would help.', 'Residents seem truly at home here.', 'The happiest home I have visited this year.'],
  family: ['Families are worried. They need to hear from you more.', 'Families trust the home, but not yet fully.', 'Families feel welcome and listened to.', 'Families speak warmly of the team.', 'Every family I met said they would choose you again.'],
  environment: ['The home needs a tidy and a tired team needs a rest.', 'Clean enough, but the team is stretched.', 'A pleasant home and a steady team.', 'Bright rooms and a team who enjoy their work.', 'Spotless, cheerful, and a team that shines.'],
};
export function commentOf(id, score) {
  const i = BANDS.findIndex((b) => score <= b);
  return COMMENTS[id]?.[i < 0 ? BANDS.length - 1 : i] ?? '';
}

// A score out of 10 from a 0–100 headline score (the routine grade's own floor and full: 40 → 0, 92 → 10).
export const SCORE10 = { floor: 40, full: 92 };

// The places (Gold / Silver / Bronze / Taking part): a place among the home and its peer homes AND a total — so a
// home alone in Year 1 still has to earn Gold. A low result is "Taking part", never a penalty.
export const TIERS = [
  { id: 'gold', name: 'Gold', color: '#D9A93B' },
  { id: 'silver', name: 'Silver', color: '#A8B0B8' },
  { id: 'bronze', name: 'Bronze', color: '#B87A4B' },
  { id: 'part', name: 'Taking part', color: '#7FA7C9' },
];
export const tierById = (id) => TIERS.find((t) => t.id === id) ?? null;

// Community Open Day — every Month 7 (a fixed yearly show). The day of the month it falls on; more family visits that day
// (residents with family who weren't already due); judged the next midnight on that day's readings.
export const OPEN_DAY = {
  month: 7,
  day: 14,
  extraVisits: 8, // at most this many extra family visits on the day
  peerNoise: 1, // a peer home's inspector scores move by up to ±1 (seeded) on the day
  programsMax: 3, // Dev's programs part: one point a running program, at most 3 (his other 7 points: essential care that day)
  essential: { floor: 80, full: 99, points: 7 },
  place: { gold: { place: 1, min: 30 }, silver: { place: 2, min: 24 }, bronze: { place: 3, min: 18 } },
  rewards: {
    gold: { reputation: 60, item: { common: 10, rare: 50, elite: 32, legendary: 8 } },
    silver: { reputation: 35, item: { common: 30, rare: 50, elite: 18, legendary: 2 } },
    bronze: { reputation: 20, item: { common: 60, rare: 35, elite: 5, legendary: 0 } },
    part: { reputation: 5, item: null },
  },
  art: 'community_prop_08', // (the Community Visit Table)
  title: 'Community Open Day',
};

// Year-end Awards Evening — every Month 12 (the routine review at the year's end and the recognition table, together).
// The place is the home's place in that year's recognition table; the grade is the routine review's own.
export const AWARDS_EVENING = {
  place: { gold: { place: 1, grades: ['S', 'A'] }, silver: { place: 2, grades: ['S', 'A', 'B'] }, bronze: { place: 3, grades: ['S', 'A', 'B', 'C'] } },
  rewards: {
    gold: { reputation: 90, item: { common: 0, rare: 40, elite: 45, legendary: 15 } },
    silver: { reputation: 55, item: { common: 20, rare: 50, elite: 26, legendary: 4 } },
    bronze: { reputation: 30, item: { common: 50, rare: 40, elite: 10, legendary: 0 } },
    part: { reputation: 0, item: null },
  },
  art: 'care_ui_28', // (the Quality icon: the National Excellence Trophy stays C10's own)
  title: 'Year-end Awards Evening',
};

export const VERDICT_TEXT = {
  trophyCase: 'Trophy Case',
  trophyCaseSub: 'Open Days and Awards Evenings, year by year',
  openDayToday: guideSays('Open Day today: families and neighbours are visiting, and four inspectors are coming to see how the home feels'),
  skip: 'Tap to see the result',
  close: 'Tap to carry on',
};

export function validateVerdicts(v, gradeCategories) {
  const ids = gradeCategories.map((c) => c.id);
  const owned = INSPECTORS.flatMap((i) => i.categories);
  v.check(INSPECTORS.length === 4, 'verdicts: four inspectors');
  v.check(owned.length === ids.length && ids.every((id) => owned.filter((x) => x === id).length === 1), 'verdicts: every routine-grade category belongs to exactly one inspector');
  for (const i of INSPECTORS) v.check(COMMENTS[i.id]?.length === BANDS.length && /^chibi_\d\d_/.test(i.chibi), `verdicts: ${i.id} comments / chibi`);
  for (const k of ['gold', 'silver', 'bronze', 'part']) v.check(OPEN_DAY.rewards[k] && AWARDS_EVENING.rewards[k], `verdicts: rewards for ${k}`);
  v.check(OPEN_DAY.month >= 1 && OPEN_DAY.month <= 12 && OPEN_DAY.day >= 1 && OPEN_DAY.day <= 28, 'verdicts: the Open Day date');
  return v;
}
export function verdictStrings() {
  return [...INSPECTORS.flatMap((i) => [i.name, i.role, i.looks, i.openDay]), ...Object.values(COMMENTS).flat(), ...Object.values(VERDICT_TEXT), OPEN_DAY.title, AWARDS_EVENING.title, ...TIERS.map((t) => t.name)];
}
