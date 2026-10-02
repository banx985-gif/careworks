// Where and how CAREWORKS saves (Milestone 0, bible §3.5.9). Its own database, so it never meets another series
// game's saves. Four campaign slots on core/CampaignSlots (keys campaign_1 … campaign_4, each its own rolling
// SaveSlot, plus a small summary record per slot that the slot screen reads without loading the campaign). The
// account store (Memory Book, achievements, tokens … later) is its own key, never touched by a slot overwrite/delete.
export const SAVE = {
  dbName: 'careworks',
  localPrefix: 'careworks:',
  count: 4,
  prefix: 'campaign_',
  accountKey: 'account',
  version: 25, // 2 = Milestone 2 (the clock and the residents' state), 3 = Milestone 3 (the staff), 4 = Milestone 4 (care
  // plans, tasks, call bells, familiarity), 5 = Milestone 5 (the Dining Room and Staff Room, the props, Credits / Care
  // Tokens), 6 = Milestone 6 (every resident, the 24 × 16 home, applicants, the ledger), 7 = Milestone 7 (three
  // shifts, floats, wings, on call, coverage history, agency hires), 8 = Milestone 8 (plan reviews, stale reasons,
  // option preferences), 9 = Milestone 9 (stay timers, life-story tags, who went home / returning), 10 = Milestone 10 (the layout: every
  // placed room and facility, the stage, sell history), 11 = Milestone 11 (the candidate board, hires, departures,
  // training, specialties), 12 = Milestone 12 (Familiar Care records, the Elite unlock), 13 = Milestone 13 (wake times, seats,
  // friendships, activity counts, favourites, continuity groups), 14 = Milestone 14 (the activity timetable, sessions,
  // community notices, birthdays), 15 = Milestone 15 (the weekly menu, meal records, hydration timers, diet tags, dining
  // satisfaction), 16 = Milestone 16 (mobility levels and aids, rehab goals, falls risk, discharges, rewards counters,
  // family records), 17 = Milestone 17 (memory support: routine changes, personalised sessions, the Choice signal,
  // stimulation, walks, the walking path), 18 = Milestone 18 (clinical: medicine rounds, round safety history, observations, open alerts and
  // their choices, hospital transfers under way; renamed ids), 19 = Milestone 19 (family records and Family Trust with every
  // change, visits and visitors under way, meetings, compliments, complaints and their trails, requests), 20 = Milestone 20 (running
  // specialist programs, what each has paid, their sessions and participation counts, partnership meetings), 21 = Milestone 21
  // (research: the tree, its slots and progress; Research Points on the ledger), 22 = Milestone 22 (the economy: Care
  // Tokens on the ledger, the month-by-month history, Emergency Credit / Rescue Investor, each resident's assessed needs
  // and level, the month's Mood), 23 = Milestone 23 (community partners and grants: the deals, tiers and history, the grant
  // board and active grants, the counters, the assistive-tech pilot), 24 = Milestone 24 (stages 3–5: the stage being built, the
  // painted wings and their tiles; per-wing rosters were already in the staff state), 25 = Milestone 25 (incidents: the event under way
  // and its timeline, Preparedness inputs, emergency supplies, past events and their after-reports, falls; staff off sick); src/systems/facility.js
  // SAVE_MIGRATIONS moves older saves
};
