// Admissions / waiting list (Milestone 6, bible §8). Plain data only; the rules are in src/systems/admissions.js.
//   The board holds 2–4 applicants drawn from residents not yet in the home. A new applicant arrives every few days
//   (and the board is topped up to its minimum at once). An applicant nobody answers leaves after boardDays; a
//   declined one leaves at once; both may apply again after reapplyAfterDays. A wait-listed applicant leaves the board
//   for the waiting list and stays waitDays (a countdown on their card), then finds a place elsewhere if not admitted.
//   Request assessment update: once per applicant, it re-rolls their need variation and takes assessmentDays (they
//   can't be admitted until it is back).
export const ADMISSION = {
  firstBoard: 3, // applicants on a new home's first board
  board: { min: 2, max: 4 },
  arriveEveryDays: 3,
  boardDays: 8,
  waitDays: 10,
  waitMax: 4,
  reapplyAfterDays: 20,
  assessmentDays: 1,
  needVariation: 8, // ± points on each need at admission (inside 0–100)
  outcomeVariation: 5, // ± points on each outcome
  // Milestone 9: the pool is every resident not in the home (all 60). At most maxBlocked applicants whose hard
  // prerequisite the home can't meet yet stand on the board at once (they show, greyed with the reason, but never
  // crowd out people who can come in). A resident who went home (respite / short stay) may apply again after
  // returnAfterDays, tagged Returning, with their Familiar Care kept.
  maxBlocked: 1,
  returnAfterDays: 28,
  homeGoingsKept: 40, // the last few who went home (the ledger's partial months, a later quality score)
  // Milestone 40f (BIGJOB4 Part A): community residents (data/communityResidents.js). While fewer than thinBelow named
  // residents can still apply, that share of arrivals is a community resident ((thinBelow − named left) / thinBelow: none
  // at 16 left, half at 8, all once none are left). tries: community serials looked at for one the home can take now.
  community: { thinBelow: 16, tries: 6 },
};
