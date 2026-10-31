// CAREWORKS — New Game+ (Milestone 33, bible §3.5.8, §37). Plain data for core/NgPlusSystem and src/systems/ngplus.js.
//
// What a New Game+ home starts with is only what these lists name. Every part of the finished home's save (its top-level
// keys and every key of its care state) and of the account store is in exactly one list: src/systems/ngplus.js builds
// the snapshot and core refuses anything undeclared, so a later milestone that adds something to the save must decide
// whether it carries over.
//
// PLACEHOLDERS (DECISIONS.md, M33): the discount (50% off one facility's first build), Elite mentoring (a worker trained
// to their tier's cap on their role's main stat while a Legacy Staff member of the same role is on the team).
export const NG_PLUS = {
  maxLevel: 3, // §37: NG+1, NG+2, NG+3; a later run stays on NG+3 rules
  fields: {
    // §37 account-wide carryover (+ §3.5.9 "never deleted by a slot overwrite") — all kept in the account store, which a
    // new home in another slot simply goes on using
    always: [
      { id: 'memoryBook', label: 'Memory Book' },
      { id: 'secrets', label: 'Secrets found (every home)' },
      { id: 'achievements', label: 'Achievements' },
      { id: 'records', label: 'Records (account bests)' },
      { id: 'prestigeTokens', label: 'Prestige Tokens' },
      { id: 'storyDiscoveries', label: 'Resident story discoveries' },
      { id: 'staffIdentities', label: 'Staff identities (who you have hired, the Works Gods)' },
      { id: 'cosmetics', label: 'Cosmetics (palettes, keepsakes, frames)' },
      { id: 'hallOfFame', label: 'Staff Hall of Fame' },
      { id: 'trophyCase', label: 'Trophy Case (every home’s trophies)' },
      { id: 'highestNgPlus', label: 'Highest New Game+ level', hidden: true },
      { id: 'pastHomes', label: 'Finished homes (their summaries)', hidden: true },
      { id: 'settings', label: 'Settings (this device)', hidden: true },
    ],
    // §37 selectable
    chosen: [
      { id: 'legacyStaff', label: 'Legacy Staff' },
      { id: 'blueprints', label: 'Legacy Program blueprints' },
      { id: 'discount', label: 'A discounted facility (New Game+ 2 and up)' },
    ],
    // §37 resets — plus the rest of the finished home's save, named so nothing slips through
    reset: [
      { id: 'credits', label: 'Credits (the new home starts with the normal opening Credits)' },
      { id: 'rank', label: 'Rank / Fame and Reputation' },
      { id: 'admissions', label: 'Resident admissions (the residents and the waiting list)' },
      { id: 'staff', label: 'Staff contracts (except your Legacy Staff)' },
      { id: 'layout', label: 'Facility layout and stage' },
      { id: 'research', label: 'Visible research (part of it comes back as starting Research Points)' },
      { id: 'partners', label: 'Active partners and grants' },
      { id: 'facility', label: 'Facility name, Director, colour and Founder (chosen again)' },
      { id: 'calendar', label: 'The calendar (back to Year 1)' },
      { id: 'care', label: 'Day-to-day care (tasks, call bells, care plans, Familiar Care, friendships)' },
      { id: 'quality', label: 'Headline scores, accreditations, inspections and peer homes' },
      { id: 'programs', label: 'Programs running (blueprints come back as chosen)' },
      { id: 'economy', label: 'The economy (Care Tokens, offers, the month history)' },
      { id: 'events', label: 'The Inbox and moments waiting' },
      { id: 'incidents', label: 'Incidents and supplies' },
      { id: 'endOfLife', label: 'This home’s end-of-life records (its Memory Book pages are kept in the account book)' },
      { id: 'homeSecrets', label: 'Secrets found in this home (the account keeps every one)' },
      { id: 'homeAchievements', label: 'This home’s achievements and Home Records (the account keeps the best)' },
      { id: 'verdicts', label: 'This home’s Open Days and Awards Evenings (its trophies stay in the Trophy Case)' },
      { id: 'ending', label: 'The Year-16 ending ceremony' },
      { id: 'homeLife', label: 'Activities, meals, mobility, memory support, families and community (this home’s)' },
      { id: 'ngPlusStart', label: 'The last New Game+ start', hidden: true },
      { id: 'guide', label: 'The first-week guide (a New Game+ home starts with it off)', hidden: true }, // (Milestone 34)
      { id: 'seed', label: 'Random seed', hidden: true },
      { id: 'playSec', label: 'Play time', hidden: true },
      { id: 'level', label: 'New Game+ level (the new home is one higher)', hidden: true },
      { id: 'ledger', label: 'The ledger', hidden: true },
    ],
  },
  // §37: 1 / 2 / 3 Legacy Staff; any staff member employed at the ending (Legendary, Secret, Divine too) keeps their level,
  // traits and blessing (statPct 100: their stats as they are). historyTiers: none — they were employed, so hired.
  legacy: { picksByLevel: [0, 1, 2, 3], statPct: 100, historyTiers: [] },
  // §37: 1 Legacy Program at NG+1 and NG+2, 2 at NG+3
  blueprints: { byLevel: [0, 1, 1, 2] },
  advantages: { perRun: {}, maxRuns: 0 },
  // §37: 15% / 25% / 35% of the visible research done turned into starting Research Points
  researchPct: [0, 15, 25, 35],
  // §37 NG+2: one normal facility starts discounted (its first build)
  discount: { fromLevel: 2, pct: 50 },
  // §37 NG+3: the Living Legacy path (SEC-NGP-03 can be found from NG+3)
  livingFromLevel: 3,
  pastHomesKept: 12,
};

// The finished home's save → the declared field each key belongs to. care is split key by key.
export const RUN_FIELDS = {
  facility: 'facility',
  seed: 'seed',
  clock: 'calendar',
  date: 'calendar',
  residents: 'admissions',
  admissions: 'admissions',
  staff: 'staff', // (the Legacy Staff are picked from it: chosen)
  care: null, // split below
  economy: 'credits',
  ledger: 'ledger',
  layout: 'layout',
  playSec: 'playSec',
  ngPlus: 'level',
  guide: 'guide', // (Milestone 34)
};
export const CARE_FIELDS = {
  tasks: 'care', nextId: 'care', gen: 'care', bells: 'care', relations: 'care', friendships: 'care', keyWorkers: 'care', counts: 'care', plans: 'care', reviews: 'care', rewards: 'care',
  quality: 'quality', research: 'research', partners: 'partners', programs: 'programs', economy: 'economy', events: 'events', incidents: 'incidents',
  eol: 'endOfLife', secrets: 'homeSecrets', achievements: 'homeAchievements', verdicts: 'verdicts', ending: 'ending', ngPlusStart: 'ngPlusStart',
  families: 'homeLife', family: 'homeLife', activities: 'homeLife', dining: 'homeLife', mobility: 'homeLife', memory: 'homeLife', clinical: 'homeLife', community: 'homeLife', prestige: 'homeLife', tours: 'homeLife', walkPath: 'layout', layoutLog: 'layout', wingsOpened: 'layout', opened: 'calendar',
};
// The account store's keys → the field each carries as.
export const ACCOUNT_FIELDS = {
  memoryBook: 'memoryBook',
  secrets: 'secrets',
  achievements: 'achievements',
  ngplus: 'pastHomes',
  settings: 'settings',
};

export const NGPLUS_TEXT = {
  menuRow: 'Start New Game+',
  menuSub: 'A new home in another slot, with Legacy Staff and blueprints',
  title: (lv) => `New Game+ ${lv}`,
  pickLegacy: (n) => `Legacy Staff: pick ${n}`,
  pickBlueprints: (n) => `Legacy Programs: pick ${n}`,
  pickDiscount: 'A facility at half price (its first build)',
  research: (pct, rp) => `${pct}% of this home’s research comes back as ${rp.toLocaleString('en-GB')} starting Research Points`,
  living: 'The Living Legacy path is open in this home',
  carried: 'Always kept (account): Memory Book, secrets found, achievements, records, Prestige Tokens, resident stories, staff identities, cosmetics, the Hall of Fame and the Trophy Case.',
  resets: 'Starts again: Credits, Rank and Fame, admissions, staff contracts (except Legacy Staff), the layout and stage, visible research, active partners and grants.',
  keepsParent: (home) => `${home} is kept just as it is.`,
  next: 'Choose a slot ›',
  slotNote: 'Pick a slot for the New Game+ home. Free slots first; the finished home is kept.',
  parentLocked: 'This finished home is kept',
  overwriteTitle: (n) => `Write over Slot ${n}?`,
  overwriteBody: (s) => `Slot ${s.n} holds "${s.facility}" — Year ${s.year}, Month ${s.month}${s.ngPlus ? `, New Game+ ${s.ngPlus}` : ', no New Game+'}. It will be replaced by the New Game+ home for good. Your account progress is kept.`,
  overwriteYes: 'Write over it',
  duplicate: (name) => `${name} is your Founder in the new home, so they can't also be Legacy Staff. Pick another Legacy Staff member.`,
  started: (lv, home) => `New Game+ ${lv}: ${home} opens`,
};
