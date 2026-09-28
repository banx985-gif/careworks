// The day and Arthur's routine (Milestone 2, bible §3 and §6). Plain data only; the rules that use it are in
// src/systems/residentNeeds.js and src/systems/homeWorld.js.

// The calendar (bible §3): 12 months × 28 days. secondsPerDay is NOT the bible's 2.5 s: at 2.5 s Arthur could never
// walk his routine (one room → lounge walk is ~8 s). Aaron chose a longer day for now (DECISIONS.md, 28 Sept) — settle
// before Milestone 5 adds 2×/4×. At 90 s a game hour is 3.75 real seconds.
export const DAY = {
  secondsPerDay: 90,
  daysPerMonth: 28,
  monthsPerYear: 12,
  speeds: [1, 2, 4], // only 1× (and Pause) usable until Milestone 5
  unlockedSpeeds: [1],
  startHour: 5.9, // a new facility opens just before the Morning shift starts
};

// The four simulation bands (bible §3), by hour of the day. Night wraps past midnight.
export const BANDS = [
  { id: 'night', name: 'Night / early morning', from: 22, to: 6 },
  { id: 'morning', name: 'Morning peak', from: 6, to: 12 },
  { id: 'afternoon', name: 'Afternoon / activities', from: 12, to: 17 },
  { id: 'evening', name: 'Evening / settling', from: 17, to: 22 },
];

// Where things happen: spots on the home grid (data/home.js). 'room' = the resident's own room (its inside spot).
export const PLACES = {
  room: { spot: null, name: 'his room' }, // filled from the resident's room
  dining: { spot: 'F05.dining', name: 'the lounge dining table' },
  lounge: { spot: 'F05.resident', name: 'the Activity Lounge' },
};

// One fixed daily routine, in order, by the hour each step starts. Milestone 3: roles = who may help with it (bible
// §11 roles; an on-shift helper walks to him and the step happens when both are there), task = what the helper does.
// Wake-up moved to 07:00 so the Morning shift (from 06:00) is in place first. A step "happens" when he gets there (drops then
// apply). optional: he may say no to it (bible §6: eligible routines, activities and meals — waking and settling for the
// night always happen). drops: need points taken off; activity: the day's one activity (its refusal nudges Social Connection down).
//   log: the word in today's log · doing: the card's line while there · going: while walking
export const ROUTINE = [
  { id: 'wake', name: 'Wake up', at: 7, place: 'room', roles: ['CW'], task: 'help him get up and dressed', log: 'Woke', doing: 'Up and dressed in his room', going: 'Heading back to his room', drops: { personal: 30 } },
  { id: 'breakfast', name: 'Breakfast', at: 8.5, place: 'dining', optional: true, roles: ['CW', 'HN'], task: 'support him at breakfast', log: 'Breakfast', doing: 'Having breakfast', going: 'Walking to breakfast', drops: { nutrition: 40, social: 5 } },
  { id: 'rest', name: 'Morning rest', at: 11, place: 'room', optional: true, roles: ['RN', 'AH'], task: 'a quiet health and mobility check', log: 'Rested', doing: 'Resting in his room', going: 'Walking to his room for a rest', drops: { mobility: 20, clinical: 10 } },
  { id: 'cards', name: 'Cards', at: 13.5, place: 'lounge', optional: true, activity: true, roles: ['LC'], task: 'run the Cards game', log: 'Played Cards', doing: 'Playing Cards in the lounge', going: 'Walking to the lounge for Cards', drops: { social: 30, memory: 20 } },
  { id: 'dinner', name: 'Evening meal', at: 17.5, place: 'dining', optional: true, roles: ['CW', 'HN'], task: 'support him at the evening meal', log: 'Evening meal', doing: 'Having his evening meal', going: 'Walking to the evening meal', drops: { nutrition: 40, social: 5 } },
  { id: 'settle', name: 'Settle and sleep', at: 19.5, place: 'room', roles: ['CW', 'RN'], task: 'help him settle for the night', log: 'Settled for the night', doing: 'Asleep in his room', going: 'Walking to his room to settle', drops: { personal: 25, clinical: 20, mobility: 25 } },
];

// Needs rise every game hour (points per hour), slower while asleep; each routine step's drops take them back down,
// so over a normal day they rise and fall; a day with every step done brings them down a little, a refused day up.
export const NEED_RISE = { personal: 2.4, clinical: 1.3, mobility: 1.8, nutrition: 3.6, memory: 0.9, social: 1.8 };
export const ASLEEP_RISE = 0.4; // × while asleep

// Outcomes drift towards a target set by the needs (higher needs → lower target), a little each hour.
//   target = 100 − Σ need × weight        pull = share of the gap closed per game hour
export const OUTCOME_TARGETS = {
  comfort: { personal: 0.4, nutrition: 0.3, mobility: 0.3 },
  independence: { mobility: 0.5, memory: 0.3, personal: 0.2 },
  mood: { social: 0.5, nutrition: 0.2, personal: 0.3 },
  connection: { social: 0.8 },
  safety: { clinical: 0.5, mobility: 0.5 },
};
export const OUTCOME_PULL = 0.03;

// Preferences (bible §6): the chance he says no to a step on a given day, and the small Mood nudge when it happens.
// 'refuse' always says no. A refusal skips the step (logged, never a failure) and he stays in (or goes back to) his room.
export const PREF_RULES = {
  prefer: { refuseChance: 0, mood: 1.5 },
  accept: { refuseChance: 0.04, mood: 0 },
  dislike: { refuseChance: 0.35, mood: -1 },
  refuse: { refuseChance: 1, mood: 0 },
};
export const ACTIVITY_DONE = { connection: 3 }; // outcome points when he joins the activity
export const ACTIVITY_REFUSED = { connection: -2 }; // …and when he refuses it
export const LOG_SHOWN = 6; // log lines on his card
