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
};
