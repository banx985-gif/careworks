// CAREWORKS — the Year-16 ending (Milestone 33, bible §47, §3 "indefinite postgame"). Plain data only;
// src/systems/ending.js applies it with core/GradeEngine and core/CampaignEnding.
//
// The 1,000-point grade: the nine §47 categories and their maximums exactly as the bible lists them. Each category is
// made of parts that read facts the home already keeps (the M29 fact registry and the M32 month records): averages over
// the last campaign year, and things the home did (counts). Nothing here reads a passing, a stage of end-of-life care
// or grief — a resident's death is never a failure and never costs points (kind-care rule).
//
// PLACEHOLDERS (DECISIONS.md, M33): every part's `full` / `floor` and the split of each category into parts. The
// category maximums and the grade bands are the bible's.
import { GUIDE } from './cast.js';

export const END_YEAR = 16; // the ending fires at the first month close after Year 16, Month 12 (core/CampaignEnding)

// part: { fact, label, full, points, floor = 0 } — points × (value − floor) ÷ (full − floor), kept to 0 … points
const part = (fact, label, points, full, floor = 0) => ({ fact, label, points, full, floor });
export const ENDING_GRADE = {
  categories: [
    { id: 'wellbeing', name: 'Resident Wellbeing', max: 250, parts: [part('wellbeingYear', 'Resident Wellbeing over the last year', 170, 92, 40), part('wellbeingRun', 'Resident Wellbeing over the whole campaign', 50, 90, 40), part('birthdays', 'Birthdays celebrated', 30, 40)] },
    { id: 'clinical', name: 'Clinical Safety', max: 180, parts: [part('clinicalYear', 'Clinical Safety over the last year', 140, 92, 40), part('safeYear', 'Shifts at Safe Coverage over the last year (%)', 40, 100, 50)] },
    { id: 'family', name: 'Family Trust', max: 120, parts: [part('familyYear', 'Family Trust over the last year', 100, 92, 40), part('familyHighMonths', 'Months with Family Trust 85+', 20, 24)] },
    { id: 'staff', name: 'Staff Development / Wellbeing', max: 120, parts: [part('staffYear', 'Staff Wellbeing over the last year', 80, 92, 40), part('trained', 'Staff who finished a course', 20, 20), part('longestYears', 'Years served by the longest-serving staff member', 20, 15)] },
    { id: 'programs', name: 'Programs / Accreditation', max: 100, parts: [part('awards', 'Accreditations won', 60, 10), part('programs', 'Specialist programs run', 40, 10)] },
    { id: 'facility', name: 'Facility / Environment', max: 80, parts: [part('environmentYear', 'Environment & Compliance over the last year', 50, 92, 40), part('stage', 'Facility stage reached', 30, 5, 1)] },
    { id: 'finance', name: 'Finance / Stability', max: 70, parts: [part('profitMonths', 'Months in profit over the last year', 40, 12), part('credits', 'Credits at the end of the campaign', 30, 60000)] },
    { id: 'community', name: 'Community / Resident Choice', max: 40, parts: [part('choiceYear', 'Resident choice over the last year', 25, 95, 50), part('community', 'Community connection', 15, 90, 40)] },
    { id: 'discovery', name: 'Discovery', max: 40, parts: [part('secrets', 'Secrets found in this home', 40, 20)] },
  ],
  // §47: S 900–1000, A 800–899, B 675–799, C 550–674, D below 550
  bands: [
    { id: 'D', min: 0 },
    { id: 'C', min: 550 },
    { id: 'B', min: 675 },
    { id: 'A', min: 800 },
    { id: 'S', min: 900 },
  ],
  total: 1000,
};
export const GRADE_COLORS = { S: '#D9A93B', A: '#6FA86A', B: '#3E7CB1', C: '#8A6CC0', D: '#7FA7C9' };

// The four inspectors (data/verdicts.js INSPECTORS, M32b) each reveal their share of the nine categories.
export const ENDING_PANEL = [
  { id: 'clinical', categories: ['clinical', 'programs'] },
  { id: 'wellbeing', categories: ['wellbeing', 'community'] },
  { id: 'family', categories: ['family', 'discovery'] },
  { id: 'environment', categories: ['staff', 'facility', 'finance'] },
];
// One plain comment per inspector and share of their points (below 55%, 55–74%, 75–89%, 90%+).
const SHARE = [0.55, 0.75, 0.9, 1.01];
const COMMENTS = {
  clinical: ['Sixteen years of care, with a lot learned along the way.', 'Safe care most days, and the programs grew.', 'Safe, steady care, and real specialist work.', 'A clinical record any home would be proud of.'],
  wellbeing: ['The residents had good days here, and some hard ones.', 'Residents found friends and things they enjoy here.', 'Residents truly lived here, not just stayed.', 'Sixteen years of happy, chosen lives.'],
  family: ['Families came to know the home slowly.', 'Families trusted the home, and its stories grew.', 'Families felt part of the home, year after year.', 'Families will tell this home’s stories for years.'],
  environment: ['The team and the building carried a lot.', 'A steady team in a home that grew.', 'A bright home, a grown team and sound books.', 'A beautiful home, a thriving team, steady finances.'],
};
export function endingComment(id, share) {
  const i = SHARE.findIndex((b) => share < b);
  return COMMENTS[id]?.[i < 0 ? SHARE.length - 1 : i] ?? '';
}

// The ceremony's pages (one tap each, Skip always there; the end choice has no Skip).
export const ENDING_TEXT = {
  beatTitle: 'Year 16 is complete',
  beatText: 'Sixteen years of care. The inspectors have one last visit.',
  inbox: 'Year 16 is complete: the ending ceremony (Records → Year-16 Ending)',
  skip: 'Skip ›',
  tapOn: 'Tap to carry on',
  c10Title: 'National Residential Care Excellence',
  c10Won: 'Awarded: the best care in the country, across everything.',
  c10Failed: 'Not this time. The inspectors saw how far the home has come.',
  c10Booked: 'The national inspectors are still on their way.',
  gradeTitle: 'The Year-16 ending grade',
  lookTitle: 'Looking back',
  closingTitle: 'From Rosie',
  closing: 'Sixteen years. Every resident here was a person first, and you never forgot it. Thank you for caring.',
  closingBy: `${GUIDE.name}, ${GUIDE.job}`,
  choiceTitle: 'What next?',
  choiceText: 'Keep running this home with no end date, or start a New Game+ home in another slot. Either way, this home is kept just as it is.',
  keep: 'Keep running',
  ngPlus: 'Start New Game+',
  postgameTag: 'Postgame',
  // the Living Legacy ending (SEC-NGP-03, the true CAREWORKS ending)
  livingTitle: 'Living Legacy',
  livingLines: ['Every home you have run is part of one long story.', 'The people you carried from home to home kept it going.', 'This is the true CAREWORKS ending.'],
  livingClosing: 'Your legacy lives in every home, every page and every person. Thank you.',
};
