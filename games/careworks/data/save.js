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
  version: 7, // 2 = Milestone 2 (the clock and the residents' state), 3 = Milestone 3 (the staff), 4 = Milestone 4 (care
  // plans, tasks, call bells, familiarity), 5 = Milestone 5 (the Dining Room and Staff Room, the props, Credits / Care
  // Tokens), 6 = Milestone 6 (every resident, the 24 × 16 home, applicants, the ledger), 7 = Milestone 7 (three
  // shifts, floats, wings, on call, coverage history, agency hires); src/systems/facility.js
  // SAVE_MIGRATIONS moves older saves
};
