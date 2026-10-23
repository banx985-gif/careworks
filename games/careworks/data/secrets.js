// Secrets (Milestone 29, bible §35 the secret condition engine, §36 the 40 secrets, §37 New Game+, §0.1 rule 11). Plain data
// only; the engine is core/SecretEngine and the CAREWORKS side is src/systems/secrets.js (rules, rewards, clues, saves) on
// src/systems/secretFacts.js (every fact, read from the systems that already exist).
//
// THE RULE (§35, §0.1 rule 11): no secret may want resident neglect, distress, preventable harm, a medication error, unsafe
// staffing or a death. A secret only ever rewards good care. Every fact (and every field of a list fact's items) that
// counts something harmful is marked `harm` below; the forbid-harm guard (src/systems/secrets.js validateSecretRules) runs
// on every rule at load and in the tests, and a harm fact may only appear in `forbids` ("and none of these happened"),
// never in requiresAll / requiresAny and never as "fewer than" in forbids (which would want more of it). A bad rule
// stops the game in ?debug=1 and is dropped in a release build.
//
// A rule (core/SecretEngine's format, plus CAREWORKS words):
//   { id, name, category, ngPlusMin,
//     oncePerRun | oncePerAccount,                 once per campaign (again in a later run) or once ever on this device
//     triggerEvents: [trigger],                    the only moments it is looked at (TRIGGERS)
//     requiresAll: [cond], requiresAny: [cond], forbids: [cond],
//     clueStages: [4 × { text, minMet }],          the four clue stages (§35); then found (CLUE.found)
//     reward: 'what the Secrets page says it gave',
//     rewardActions: [{ type, id?, amount? }] }    REWARD_TYPES
// A condition: core/SecretEngine's ({ fact, op, value, … } / countOf / consecutive / sequence / sameAcross / all / any) with a
// `label` in plain words for the why-false inspector ("Family Trust 85+").

// --- clue stages (§35: four, then found) -----------------------------------------------------------------------------------
// The engine reaches a stage when that share of the rule's conditions is done (part-way conditions count part-way: 4 of 6
// months is two-thirds of that condition). Stages only go up. Found = 5 for good (the account remembers it).
export const CLUE = { stages: 4, found: 5, minMet: [{ share: 0.25 }, { share: 0.5 }, { share: 0.75 }, { share: 0.9 }] };
// No easing on a repeat: the bible has none (the same rule, every run).
export const EASING = { countFactor: 1, thresholdPct: 0 };

// --- triggers: the moments a rule may be looked at ---------------------------------------------------------------------------
// 'secrets:day' (each midnight, after the quality scores) and 'secrets:month' (each month's close, after its history is
// written) are the engine's own; the rest are the home's own bus moments, read as they happen.
export const TRIGGERS = ['secrets:day', 'secrets:month', 'care:discharge', 'care:birthday', 'quality:award', 'quality:rankUp', 'partners:signed', 'staff:trained', 'home:stage'];

// --- the facts (src/systems/secretFacts.js answers each one) -------------------------------------------------------------------
// scope: run (this campaign: its save) or account (this device: the account store; New Game+ keeps it).
// kind: number · list (of items, with `fields`) · ids (a list of ids) · flag · object
// harm: true — counts something harmful (§35). Only ever in `forbids`.
// The five headline scores are `run.score.<id>` (clinicalSafety, residentWellbeing, familyTrust, staffWellbeing, environment).
export const FACTS = {
  // thresholds
  'run.score': { name: 'A headline score (run.score.<id>)', kind: 'number', group: true },
  'run.lowestScore': { name: 'The lowest headline score', kind: 'number' },
  'run.nutrition': { name: 'Nutrition (the month’s average)', kind: 'number' },
  'run.environment': { name: 'Environment (rooms and cleanliness)', kind: 'number' },
  'run.residents': { name: 'Residents living here', kind: 'number' },
  'run.capacity': { name: 'Places the home has', kind: 'number' },
  'run.occupancy': { name: 'Occupancy %', kind: 'number' },
  'run.stage': { name: 'Facility stage', kind: 'number' },
  'run.year': { name: 'Campaign year', kind: 'number' },
  'run.rank': { name: 'Rank (E 0 … S 5)', kind: 'number' },
  'run.residentList': { name: 'Each resident', kind: 'list', fields: { id: 'id', stay: 'stay type', longTerm: 'long-term stay', tags: 'life-story tags', mood: 'Mood', comfort: 'Comfort', independence: 'Independence', connection: 'Social Connection', mobility: 'mobility level', familyTrust: 'their family’s Trust', daysHere: 'days living here', memorySupport: 'memory support' } },
  // consecutive months (written at each month's close)
  'run.months': { name: 'Each closed month', kind: 'list', fields: { m: 'month number', scores: 'headline scores (scores.<id>)', lowest: 'lowest headline score', net: 'trading net', profit: 'in profit', noMissed: 'no essential care missed', familyTrust: 'home Family Trust', nutrition: 'Nutrition', environment: 'Environment', residents: 'residents', occupancy: 'occupancy %', agencyShifts: 'agency shifts', agencyPct: 'agency shifts % of shifts', safePct: 'shifts at Safe Coverage %', essentialMissed: { name: 'essential care missed', harm: true }, falls: { name: 'falls', harm: true }, unsafeShifts: { name: 'unsafe shifts', harm: true }, medErrors: { name: 'medication-round issues', harm: true }, complaints: { name: 'complaints', harm: true }, passings: { name: 'passings', harm: true } } },
  'run.monthsClosed': { name: 'Months closed', kind: 'number' },
  // history: the firsts in the order they happened (for sequence / ever-happened rules)
  'run.timeline': { name: 'Firsts, in order (rank:D, award:C01, birthday, discharge, compliment, course, stage:2, partner:<id>)', kind: 'ids' },
  // programs
  'run.programsRunning': { name: 'Programs running', kind: 'number' },
  'run.programIds': { name: 'Programs running (ids)', kind: 'ids' },
  'run.programsEver': { name: 'Different programs ever run', kind: 'ids' },
  'run.programs': { name: 'Each program running', kind: 'list', fields: { id: 'id', days: 'days running' } },
  // resident outcomes
  'run.rehabDischarges': { name: 'Successful rehab discharges', kind: 'number' },
  'run.discharges': { name: 'Each rehab discharge', kind: 'list', fields: { id: 'resident', day: 'day', days: 'days of rehab', independence: 'Independence at discharge' } },
  'run.birthdaysHeld': { name: 'Birthdays held', kind: 'number' },
  'run.wishesHonoured': { name: 'End-of-life periods with their wishes honoured', kind: 'number' },
  'run.wellSupported': { name: 'Well-supported end-of-life periods (comfort)', kind: 'number' },
  // friendship / familiarity
  'run.friendships': { name: 'Each friendship pair', kind: 'list', fields: { a: 'resident', b: 'resident', friendship: 'Friendship', both: 'tags they share', bothLongTerm: 'both long-term', days: 'days since they met', storyTags: 'History / Community on both' } },
  'run.bestFriendship': { name: 'The strongest friendship', kind: 'number' },
  'run.storyFriendship': { name: 'The strongest friendship between two long-term residents who share History or Community', kind: 'number' },
  'run.familiarity': { name: 'Each staff–resident familiarity', kind: 'list', fields: { staff: 'staff', resident: 'resident', familiarity: 'familiarity', starting: 'one of the starting staff' } },
  'run.familiarCare': { name: 'Familiar Care average', kind: 'number' },
  // staff continuous employment
  'run.staff': { name: 'Each staff member', kind: 'list', fields: { id: 'id', role: 'role', tier: 'tier', founder: 'the Founder', starting: 'one of the starting staff', daysEmployed: 'days employed (continuous)' } },
  'run.startingKept': { name: 'Starting staff still here', kind: 'number' },
  'run.longestServing': { name: 'Longest continuous employment (days)', kind: 'number' },
  'run.noQuitDays': { name: 'Days since anyone left', kind: 'number' },
  // family trust
  'run.familyTrust': { name: 'Family Trust (the home)', kind: 'number' },
  'run.families': { name: 'Each family', kind: 'list', fields: { resident: 'resident', trust: 'Trust' } },
  // roster / agency
  'run.agencyShiftsMonth': { name: 'Agency shifts this month', kind: 'number' },
  'run.safePctMonth': { name: 'Shifts at Safe Coverage this month %', kind: 'number' },
  // awards, partners
  'run.awards': { name: 'Accreditations won', kind: 'ids' },
  'run.awardCount': { name: 'Accreditations won (count)', kind: 'number' },
  'run.partners': { name: 'Each partner', kind: 'list', fields: { id: 'id', tier: 'tier (0 Partner … 3 Strategic)', active: 'deal running' } },
  'run.partnerTopTier': { name: 'Highest partner tier', kind: 'number' },
  'run.secretsFound': { name: 'Secrets found in this campaign', kind: 'number' },
  // harm (§35) — only ever in forbids
  'run.essentialMissedMonth': { name: 'Essential care missed this month', kind: 'number', harm: true },
  'run.essentialMissed': { name: 'Essential care missed (ever)', kind: 'number', harm: true },
  'run.falls28': { name: 'Falls in the last 28 days', kind: 'number', harm: true },
  'run.unsafeShiftsMonth': { name: 'Unsafe shifts this month', kind: 'number', harm: true },
  'run.unsafeShifts': { name: 'Unsafe shifts (ever)', kind: 'number', harm: true },
  'run.medErrors': { name: 'Medication-round issues (ever)', kind: 'number', harm: true },
  'run.openMedAlerts': { name: 'Unresolved clinical alerts', kind: 'number', harm: true },
  'run.distress': { name: 'Residents in distress (Mood under 20)', kind: 'number', harm: true },
  'run.complaints': { name: 'Complaints (ever)', kind: 'number', harm: true },
  'run.passings': { name: 'Passings', kind: 'number', harm: true },
  // account (this device; New Game+ keeps it)
  'account.ngPlus': { name: 'New Game+ level', kind: 'number', scope: 'account' },
  'account.memoryBook': { name: 'Memory Book pages (every home)', kind: 'number', scope: 'account' },
  'account.secretsFound': { name: 'Secrets found (every run)', kind: 'number', scope: 'account' },
  'account.secretsFoundIds': { name: 'Secrets found (ids)', kind: 'ids', scope: 'account' },
  'account.prestigeTokens': { name: 'Prestige Tokens', kind: 'number', scope: 'account' },
  // the trigger's own payload: event.<field> (e.g. event.id on quality:award)
  event: { name: 'The moment’s own detail (event.<field>)', kind: 'object', group: true },
};
export const scopeOf = (fact) => (String(fact).startsWith('account.') ? 'account' : 'run');
// The fact's catalogue row (run.score.familyTrust → run.score).
export function factDef(fact) {
  if (FACTS[fact]) return FACTS[fact];
  const p = Object.keys(FACTS).filter((k) => FACTS[k].group && String(fact).startsWith(`${k}.`)).sort((a, b) => b.length - a.length)[0];
  return p ? FACTS[p] : null;
}

// --- rewards (each through an existing system; src/systems/secrets.js has one function per type) ----------------------------
// scope: account — kept on this device (New Game+ keeps it); run — in this campaign. currency: paid once per account only.
export const REWARD_TYPES = {
  prestige: { scope: 'account', currency: true, text: (a) => `${a.amount} Prestige Token${a.amount === 1 ? '' : 's'}` },
  record: { scope: 'account', text: (a) => `The ${RECORDS[a.id]?.name ?? a.id} record` },
  palette: { scope: 'account', text: (a) => `The ${PALETTES[a.id]?.name ?? a.id} palette` },
  recognition: { scope: 'run', text: (a) => RECOGNITIONS[a.id]?.name ?? a.id }, // the Founder's recognitions and this home's records
  item: { scope: 'run', text: () => 'A piece of care equipment' }, // items.grant('secret') — never bought
  arrival: { scope: 'run', text: (a) => `A special arrival: ${a.name ?? a.id}` }, // a flag the M30 special arrivals read
  event: { scope: 'run', text: (a) => CELEBRATIONS[a.id]?.name ?? a.id }, // a celebration / event chain flag (M30 builds them)
};
export const RECORDS = {
  fiveStarBalance: { name: 'Five-Star Balance', text: 'All five headline scores 90+ together for six months' },
};
export const PALETTES = {
  heritageHome: { name: 'Heritage Home', text: 'A warm heritage palette for any home' },
};
export const RECOGNITIONS = {
  oldFriends: { name: 'Old Friends celebration', text: 'Two old friends, celebrated by the whole home' },
};
export const CELEBRATIONS = {
  oldFriends: { name: 'The Old Friends celebration' },
};

// --- the rules (Milestone 29: three samples from §36 to prove the engine; the other 37 are Milestone 30) ----------------------
const stages = (texts) => texts.map((text, i) => ({ text, minMet: CLUE.minMet[i] }));
const SCORE = (id, min, label) => ({ fact: `run.score.${id}`, op: 'gte', value: min, kind: 'threshold', category: 'quality', label });
export const SECRET_RULES = [
  // threshold + consecutive months
  {
    id: 'SEC-AWARD-01',
    name: 'Five-Star Balance',
    category: 'recognition',
    oncePerRun: true,
    triggerEvents: ['secrets:month'],
    requiresAll: [
      {
        fact: 'run.months',
        op: 'consecutive',
        where: [
          { field: 'scores.clinicalSafety', op: 'gte', value: 90 },
          { field: 'scores.residentWellbeing', op: 'gte', value: 90 },
          { field: 'scores.familyTrust', op: 'gte', value: 90 },
          { field: 'scores.staffWellbeing', op: 'gte', value: 90 },
          { field: 'scores.environment', op: 'gte', value: 90 },
        ],
        value: 6,
        kind: 'count',
        category: 'quality',
        label: 'All five headline scores 90+ together',
        unit: 'months',
      },
    ],
    clueStages: stages([
      'Inspectors talk of homes where every part of care shines at once.',
      'Balance is the word: no one score carried by the others.',
      'Keep it up, month after month, and someone will notice.',
      'Very close: a little longer, all together.',
    ]),
    reward: 'The Five-Star Balance record and 3 Prestige Tokens',
    rewardActions: [{ type: 'record', id: 'fiveStarBalance' }, { type: 'prestige', amount: 3 }],
  },
  // resident outcome / friendship
  {
    id: 'SEC-RES-02',
    name: 'Old Friends',
    category: 'residentStory',
    oncePerRun: true,
    triggerEvents: ['secrets:day'],
    requiresAll: [
      {
        fact: 'run.friendships',
        op: 'countOf',
        where: [
          { field: 'bothLongTerm', op: 'eq', value: true },
          { field: 'storyTags', op: 'eq', value: true },
        ],
        value: 1,
        kind: 'fixed',
        category: 'residents',
        label: 'Two long-term residents with History or Community in their stories, getting to know each other',
      },
      { fact: 'run.storyFriendship', op: 'gte', value: 100, kind: 'threshold', category: 'friendship', label: 'Their friendship reaches 100' },
    ],
    clueStages: stages([
      'Some residents arrive with stories that sound oddly familiar to each other.',
      'Long stays, long memories: history and community bring people together.',
      'Two residents seem to finish each other’s stories.',
      'Their friendship is nearly as deep as it can go.',
    ]),
    reward: 'The Old Friends celebration',
    rewardActions: [{ type: 'event', id: 'oldFriends' }, { type: 'recognition', id: 'oldFriends' }, { type: 'item' }],
  },
  // account / New Game+
  {
    id: 'SEC-NGP-01',
    name: 'Back to the Small Home',
    category: 'newGamePlus',
    ngPlusMin: 1,
    oncePerAccount: true,
    triggerEvents: ['quality:award', 'secrets:month'],
    requiresAll: [
      { fact: 'run.awards', op: 'has', value: 'C02', kind: 'fixed', category: 'recognition', label: 'Resident Choice Recognition (C02) won' },
      { fact: 'run.stage', op: 'eq', value: 1, kind: 'fixed', category: 'facility', label: 'Still a Stage 1 home' },
      { fact: 'run.residents', op: 'lt', value: 16, kind: 'fixed', category: 'facility', label: 'Under 16 residents' },
      { fact: 'run.lowestScore', op: 'gte', value: 80, kind: 'threshold', category: 'quality', label: 'Every headline score 80+' },
    ],
    clueStages: stages([
      'Some say the best care happens in the smallest homes.',
      'A second life for a small home: no need to grow to be recognised.',
      'Residents’ own choices, honoured in a home that stays small.',
      'Nearly there: keep it small and keep every score high.',
    ]),
    reward: 'The Heritage Home palette and 2 Prestige Tokens',
    rewardActions: [{ type: 'palette', id: 'heritageHome' }, { type: 'prestige', amount: 2 }],
  },
];
export const SECRET_IDS = SECRET_RULES.map((r) => r.id);

// Every player-facing word here, for the banned-word check.
export function secretStrings() {
  const out = [];
  for (const r of SECRET_RULES) out.push(r.name, r.reward, ...r.clueStages.map((s) => s.text), ...[...(r.requiresAll ?? []), ...(r.requiresAny ?? []), ...(r.forbids ?? [])].map((c) => c.label ?? ''));
  for (const t of Object.values(REWARD_TYPES)) out.push(t.text({ id: 'x', amount: 2 }));
  for (const g of [RECORDS, PALETTES, RECOGNITIONS, CELEBRATIONS]) for (const v of Object.values(g)) out.push(v.name, v.text ?? '');
  for (const f of Object.values(FACTS)) out.push(f.name);
  return out.filter(Boolean);
}
