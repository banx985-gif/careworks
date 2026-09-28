// Staff numbers (Milestone 3). Placeholders, logged in docs/DECISIONS.md — tune here.
//   Energy and Morale are 0–100. Hours are game hours (a game hour is 3.75 real seconds at 1×).
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

// The one shift of Milestone 3 (bible §3: three shifts later — Afternoon / Night templates arrive in Milestone 7).
export const SHIFTS = {
  morning: { name: 'Morning', bands: ['morning', 'afternoon'], from: 6, to: 17 },
};

// Milestone 5: the top bar's money. Numbers only — nothing earns or spends them until the economy (Milestone 22).
// A placeholder opening balance, logged in docs/DECISIONS.md.
export const ECONOMY_START = { credits: 100000, careTokens: 0 };
