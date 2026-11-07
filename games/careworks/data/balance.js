import { ROOM_FEES, FUNDING } from './economy.js';
// Staff numbers (Milestone 3). Placeholders, logged in docs/DECISIONS.md — tune here.
//   Energy and Morale are 0–100. Hours are game hours (a game hour is 3.75 real seconds at 1×).
import { SHIFT_TEMPLATES } from './shifts.js';
export const STAFF_BALANCE = {
  startEnergy: 100,
  startMorale: 75,
  energy: {
    workPerHour: -3.5, // on shift (at a post, walking, helping)
    perTask: -3, // each routine step they help with
    restPerHour: 3.5, // off shift
    restSpotBonus: 1.2, // × while standing down at their rest spot (the Staff Room, Milestone 5)
  },
  morale: {
    lowEnergyBelow: 35, // below this Energy, Morale drifts down…
    lowEnergyPerHour: -0.6,
    perTask: 1.5, // …and each finished task lifts it a little
    settleTo: 75, // otherwise it settles slowly back towards this
    settlePerHour: 0.2,
  },
  tooTiredBelow: 8, // Energy below this: not picked automatically (still choosable)
};

// The shifts (Milestone 3 had one Morning shift, 06:00–17:00). Milestone 7: the three templates live in data/shifts.js;
// SHIFTS is the same object, kept under its Milestone 3 name.
export const SHIFTS = SHIFT_TEMPLATES;

// Milestone 5: the top bar's money; Milestone 6 puts it in a ledger (core/EconomySystem). A placeholder opening
// balance, logged in docs/DECISIONS.md.
export const ECONOMY_START = { credits: 100000, careTokens: 0 };

// Milestone 6: the first pass of income and costs (bible §27 income lines; deliberately simple, tuned in Milestone 22).
// At each month's close every resident pays the accommodation fee and brings Care Support Funding by their Support
// Level (1–5, data/residents.js), both for the days they lived here that month; every team member's salary (data/staff.js)
// goes out in full. The balance may go below zero: no debt system yet, just a red number.
// Milestone 22: the real numbers live in data/economy.js (fees by room, funding by level from the care it needs); FEES
// keeps the Milestone 6 names for the code and tests that read them: a Standard Room's fee and the funding table.
export const FEES = {
  accommodationPerMonth: ROOM_FEES.RM01,
  careSupportFundingByLevel: FUNDING,
};
export const LEDGER = {
  categories: { opening: 'Opening balance', fees: 'Accommodation fees', funding: 'Care Support Funding', wages: 'Wages', agency: 'Agency cover', careRecovery: 'Care recovery', build: 'Building', sell: 'Sold (50% back)', food: 'Food', rehabFunding: 'Rehab funding', programs: 'Specialist programs', research: 'Research', respiteFunding: 'Respite funding', programFunding: 'Program funding', supplies: 'Supplies', equipment: 'Equipment upkeep', upkeep: 'Rooms and facilities upkeep', utilities: 'Utilities and maintenance', training: 'Training', recruit: 'Recruitment', clinical: 'Clinician and hospital', loan: 'Emergency Credit', loanRepay: 'Emergency Credit repayment', investor: 'Rescue Investor', investorShare: 'Rescue Investor share', tokens: 'Care Tokens', grants: 'Grants and service contracts', partnerSupport: 'Partner support', partnerPerk: 'Partner perks (savings)', emergency: 'Emergency supplies and responses', purchase: 'Care Tokens bought', ad: 'Care Tokens from ads', store: 'Care Tokens spent' }, // (Milestone 25) // (Milestone 23) // (Milestone 22) // (Milestone 21: Research Points in and out, currency 'rp') // (Milestone 20: each running program's weekly cost — data/programs.js) // (Milestone 16: rehab funding — data/mobility.js REHAB_FUNDING) // (Milestone 15: food, per meal served — data/dining.js FOOD_COST)
  maxLines: 400, // older lines fold into one (core/EconomySystem)
};

// Milestone 7: short staffing costs money (bible §14 "understaffing does not become a cheap-profit strategy", §27 agency
// cover is a cost line). Both post to the ledger as they happen: an agency fee when the worker is hired for a shift, and
// care recovery at the end of each day for that day's missed essential tasks (a placeholder for the extra care, reviews
// and family follow-up a missed wake-up, meal, medicine round or settle brings; Milestone 22 tunes it).
//
// The design rule, checked here and by tests/careworks/m7.test.mjs (a 28-day run with one shift short costs more than
// the fully staffed run):
//   leaving one shift empty saves at most one salary: 560 Credits a month (the dearest Standard staff member)
//   an empty shift brings an agency worker every day: 28 × 120 = 3,360 Credits a month — six times the wage saved
//   when the ledger can't pay agency, the unsafe shift's missed essential tasks cost 35 each: one or two a day is
//   980–1,960 Credits a month, and the unsafe-shift counter goes up (quality scores read it in Milestone 26)
// So the cheapest safe roster always beats running short.
// Milestone 10 fix: a small home's nurse on call (bible §14 "RN or on-call"). A brand-new home (Arthur and the three-
// person opening team) must not bleed agency fees the player never chose. The roster's "nurse on call" switch, one per
// shift that allows it (data/shifts.js clinical.onCall), stands in for an RN on shift — and adds coverPoints of Safe
// Coverage — while the home is small and nobody on it needs much clinical care:
//   clinicalNeedAbove   a resident whose assessed Clinical/Nursing need (their profile, data/residents.js) is above this
//                       needs a real RN on every shift (Clinical Support and High Care are 55; everyone else 36 or less)
//   maxResidents        per shift: the switch only covers while the home has at most this many residents (Afternoon:
//                       the card's 4; Night: no limit — the coverPoints then run out for a bigger home by themselves)
//   coverPoints         Safe Coverage Points the nurse on call is worth: 4 low-support residents at Night need 0.4 ×
//                       (1+2+2+2) = 2.8, so Night is covered for them; a bigger or needier home is not, and must staff
//                       it (or pay agency) — the M7 rule that under-staffing never saves money still holds there
export const ON_CALL = {
  clinicalNeedAbove: 45,
  maxResidents: { afternoon: 4, night: Infinity },
  coverPoints: 3.2,
};

export const SHORT_STAFFING = {
  agencyFeePerShift: 120, // Credits, each agency worker, each shift
  careRecoveryPerMissed: 25, // Credits per missed essential task (Milestone 22: 35 → 25, tuned with the real economy)
};

// Milestone 14 (fix first, Aaron's call 30 Sept): everyone walks 5× faster. The 90-second day stays. In a full Stage-1
// home the far rooms were a 2–3 game-hour walk from the Dining Room (M13: ~63 essential morning tasks missed a day);
// at 5× that is under half an hour. speedMultiplier multiplies data/home.js PERSON.speed (staff) and RESIDENT.speed
// (residents); the hop length (MOTION.stride) is multiplied too, so people take the same number of hops a second on
// screen as before — a longer, brisker hop, never frantic legs or a slide.
// aids: a resident with a mobility aid walks at this share of everyone else's speed (still 5× faster than before);
// aidBySupport: which aid by their primary support (bible §7), until Milestone 16 gives each resident their own.
// Milestone 25b (Aaron, 2 Oct: "Staff move way too fast… not heaps, but 10%"): 5 → 4.5, with the day 10% longer in
// real time to match (data/routine.js: 90 → 100 s), so the walk per game hour — and so the care per day — is unchanged.
export const WALK = {
  speedMultiplier: 4.5,
  aids: { frame: 0.8, wheelchair: 0.85 },
  aidBySupport: { 'Mobility Support': 'frame', Rehabilitation: 'frame', 'High Care': 'wheelchair' },
};

// Milestone 39b (Kairosoft gap #6, things improve with use): a program grows with the sessions it has held in this home
// (across stops and restarts), a facility with the care tasks done at its spots (M32's use count). A small lift at each
// step, shown on its card. Never needed to win, never sold. PLACEHOLDERS (DECISIONS.md, overnight Stage 5).
export const USE_GROWTH = {
  steps: [50, 150, 400],
  names: ['Practised', 'Well loved', 'A home tradition'],
  programPct: [3, 6, 10], // on a session's lift for those who join (group and one-to-one)
  facilityPct: [2, 4, 6], // on the facility's own effect (with its level)
};
export function growthOf(n, pcts) {
  const S = USE_GROWTH;
  let i = -1;
  while (i + 1 < S.steps.length && n >= S.steps[i + 1]) i++;
  return { n, step: i + 1, name: i >= 0 ? S.names[i] : null, pct: i >= 0 ? pcts[i] : 0, next: S.steps[i + 1] ?? null, nextName: S.names[i + 1] ?? null };
}

// Milestone 40b (the soak's Rank E staffing trap): "safe capacity", how many residents the team can look after with every
// essential task done on time. Two kinds of essential care set it on each day shift — the hands-on care (wake-ups,
// washes, medicines, settling: carers and nurses) and the meals (served by Hospitality workers, carers helping) — and the
// night's checks (anyone on Night, plus the nurse on call and the evening settle: base). perHand: residents one pair of
// hands keeps up with on that shift; a better-skilled person (SKILL_SPEED) counts a little more. The team's number is its
// weakest shift, never below minimum (the opening team looks after Arthur and a first resident). Agency workers are not
// counted (they come for one shift at a time). Calibrated on the M40 probes: the ten Standard staff on the sensible roster
// keep 6 residents' essential care done (S at 6; ~10 essential tasks a day missed at 8); at 13 residents one Hospitality
// worker and two carers on the Afternoon shift miss about half the lunches. PLACEHOLDERS (DECISIONS.md, Milestone 40b).
export const SAFE_CAPACITY = {
  // (Milestone 40d: a nurse counts 0.6 — the medicine round comes first — and a carer's hands go further with zones and the
  // spread morning: 3.75, was RN 1 · 3; the Rank E roster still safely cares for 6)
  // (and Allied Health 0.4: they back up wake-ups and personal care, data/tasks.js ALSO_HELP)
  care: { hands: { CW: 1, RN: 0.6, AH: 0.4 }, perHand: { morning: 3.75, afternoon: 3.75 } },
  // (Milestone 40d: a server only serves a resident at the table now, so each goes further: 5.5, was 4.3)
  meals: { hands: { HN: 1, CW: 0.4, AH: 0.2 }, perHand: { morning: 5.5, afternoon: 5.5 } }, // (AH: the meal back-up)
  // (Part D) the medicine rounds: nurses only; at 13 residents two morning nurses missed about four rounds a day
  // (Milestone 40d: the morning round opens from 08:00: 7, was 6)
  // (Part B: back to 6 in the morning with its own stage factor — the round's walk to every resident and the cart grows with
  // the home; three morning nurses missed ~2 stops a day at 17 residents in Stage 2)
  meds: { hands: { RN: 1 }, perHand: { morning: 6, afternoon: 8 }, stageFactor: [1, 0.8, 0.72, 0.66, 0.6] },
  night: { base: 4, perHand: 12 },
  minimum: 2,
  // (Part D) a bigger home is a longer walk between rooms, the dining room and the medicine trolley: each pair of hands keeps
  // up with fewer residents from Stage 2 on (× by stage 1–5; the 16-year soak at 13 residents in Stage 2 missed ~7 tasks a day
  // that the Stage 1 numbers called safe)
  // (Milestone 40d: zones, the nearest Dining Room and residents setting off in time cut the bigger home's walks: was
  // 1 · 0.8 · 0.75 · 0.7 · 0.65; the soak at 18 residents in Stage 2 missed under 2 essential tasks a day)
  stageFactor: [1, 0.9, 0.85, 0.8, 0.75],
  skillShare: 0.5, // (about half a task's time is the walk there, which skill doesn't shorten)
  // Stage 1 holds this many residents until Rank D (its first six places at the start; the rest open at Rank D)
  rankEPlaces: 6,
  placesText: 'Rooms 7 and up open at Rank D: until then Stage 1 holds 6 residents (as many as a Rank E team can safely care for)',
  stretched: 'Your team is stretched — essential care may be missed.',
  need: { care: 'a carer or nurse', meals: 'a Hospitality worker', meds: 'a nurse', night: 'someone on Night' },
};
// Milestone 40b (the soak: a bigger home's Rare staff cost twice a Standard's wage for the same work): staff above the
// Standard row work a little faster at their tasks — 1 + k × (their stat points ÷ basePoints − 1), at most max. basePoints
// sits above every Standard person, so the Standard ten (and every home's first months) work exactly as before. Rare
// ≈ 1.4×, Elite ≈ 2.2×, Legendary 2.5×; a Standard person who levels up past it starts to speed up too. Agency: 1.
export const SKILL_SPEED = { basePoints: 5.4, k: 0.6, max: 2.5 };

// Milestone 40d (let a well-run home grow): zones — each Care Worker and nurse on a shift looks after a run of
// neighbouring rooms (src/systems/zones.js), split automatically from who is on now; their own zone's room tasks come
// first (inZone: worth that many tiles of walking), and they only cross into a colleague's zone while their own has
// nothing waiting. Floats and agency workers have no zone (they go where they're needed); a wing's staff split that
// wing's rooms (painting wings is how a player sets zones by hand). band: floor rows per stretch of corridor walked.
// holdHours: after a task someone with a zone waits near their rooms this long before walking back to their post.
// minRoomsEach: zones start once there are at least this many residents' rooms per person (a small home is everyone's).
export const ZONES = { on: true, roles: ['CW', 'RN'], inZone: 40, band: 8, holdHours: 3, minRoomsEach: 2 };

// Milestone 40d (spread the rush): residents set off for a meal or the lounge early enough to be there on time (the walk
// from their room at their own pace + spareHours, at most maxLeadHours), and a server takes a resident's meal only once
// they are at the table or nearly (nearTiles), never standing at an empty seat while others wait.
// waitAtTable: someone seated whose meal help can come stays for it up to waitHours after the meal's time (the next step waits).
export const MEAL_SERVICE = { setOff: true, places: ['dining', 'lounge'], spareHours: 0.1, maxLeadHours: 1, whenSeated: true, nearTiles: 6, waitAtTable: true, waitHours: 2.5 };

// Milestone 40d (independence helps): the daily-living tasks (types) take less hands-on time for a resident who does more
// for themselves — from their Independence outcome: nothing at `from` or below, up to maxPct% less at `to` and above. The
// care is the same (the same need eased), their plan is never changed, and nothing is forced: it is good rehab, memory
// care and independence options paying back in staff time.
export const INDEPENDENCE = { types: ['wake', 'personal', 'settle', 'meal'], from: 45, to: 85, maxPct: 40 };
