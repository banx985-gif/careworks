// The first-week guide and the Help pages (Milestone 34, bible §3.5 opening home, §39 "pop-ups never stack"). Plain data.
// Rosie Hart (the deputy manager, data/cast.js) walks a new player through the first week as next-step hints, one at a
// time, each pointing at the right button with a soft glow (src/main.js guideTarget). It is light and never forced: a
// step finishes itself when the player does the thing, any way they like (its event, src/main.js); Skip guide is on
// her first card and in Settings; it never blocks a tap; nothing shows while a pop-up is up. The first card goes
// through the event director's queue like every other pop-up.
//
// A step: { id, title, text (the line in the home), home (the bottom-bar slot it starts from), event (what finishes
//   it: core/GuideSystem advance + skipIf, so doing it early counts), when? (src/main.js applies: false = it makes no
//   sense now, e.g. a replay with no free room — it counts as done), path: [{ button, say }] — inside a sheet the
//   first button that is there is the one to tap (deepest first); '*' ids are picked by src/main.js GUIDE_PICK }
// Words are Rosie's; the screen adds her name ("Rosie: …"). No medical words (tests: NEVER_SAY).
export const GUIDE_STEPS = [
  {
    id: 'admit',
    title: 'Welcome your first resident',
    text: 'Tap Care to welcome your first resident',
    home: 'care',
    event: 'care:admit',
    when: 'admit',
    path: [
      { button: 'act:admit', say: 'Tap Admit now to welcome them' },
      { button: 'app:*', say: 'Tap someone ready to move in' },
      { button: 'admissions', say: 'Tap Admissions' },
    ],
  },
  {
    id: 'plan',
    title: 'Set up their care plan',
    text: 'Tap Care to set up your new resident’s plan',
    home: 'care',
    event: 'guide:plan',
    path: [
      { button: 'plan:review', say: 'Check their plan, then tap Reviewed' },
      { button: 'resident:*', say: (name) => `Tap ${name} to open their card` },
    ],
  },
  {
    id: 'shifts',
    title: 'Fill every shift',
    text: 'One shift has nobody on it: tap Staff',
    home: 'staff',
    event: 'guide:shifts',
    path: [
      { button: 'lane:*', say: (shift) => `Now tap ${shift} to move them there` },
      { button: 'roster:*', say: (name) => `Tap ${name} to pick them` },
    ],
  },
  {
    id: 'activity',
    title: 'Plan an activity',
    text: 'Tap Care, then Activities, to plan one',
    home: 'care',
    event: 'guide:activity',
    path: [
      { button: 'pick:*', say: 'Choose an activity they will enjoy' },
      { button: 'slot:*', say: 'Tap a free slot' },
      { button: 'care:activities', say: 'Tap Activities' },
    ],
  },
  {
    id: 'quality',
    title: 'Read the Quality page',
    text: 'Tap Quality to see how the home is doing',
    home: 'quality',
    event: 'guide:quality',
    path: [{ button: 'close:quality', say: 'Have a look, then close it with ✕' }],
  },
];
export const GUIDE_STEP_IDS = GUIDE_STEPS.map((s) => s.id);
export const guideStepById = (id) => GUIDE_STEPS.find((s) => s.id === id) ?? null;

export const GUIDE_TEXT = {
  speaker: 'Rosie Hart · Deputy Manager',
  welcome: 'Hello, I’m Rosie, your deputy. I’ll point the way through your first week, one small step at a time. Do things in any order you like.',
  showMe: 'Show me',
  skip: 'Skip guide',
  close: 'Close this for now (✕)',
  done: 'Your first week is under way. Help keeps every page.',
  // Settings (Menu and hints)
  settingTitle: 'First-week guide',
  settingLine: 'Rosie’s first-week steps in this home. A New Game+ home, and a player who has finished the guide before, start with it off.',
  settingNoHome: 'Open a home to switch its guide on or off.',
  again: 'Show guide again',
  againLine: 'From the start, in this home',
  progress: (n, of) => `${n} of ${of} steps done`,
};

// The Help archive (Menu → Help, the top bar's Help, Settings → Help): one short page per main system, each one screen.
// Every hint Rosie has given is listed there too once seen (src/main.js openHelp). line: the one-line summary on the list.
export const HELP_TEXT = {
  title: 'Help',
  subtitle: 'Short pages on running the home · ✕ closes',
  intro: 'Tap a page to read it. Tap a person or a place in the home to open their card; drag to look round; pinch to zoom.',
  hintsTitle: 'Rosie’s hints',
  hintsNone: 'Rosie’s hints are kept here once she has given them.',
  back: '‹ Back to Help',
};
export const HELP_TOPICS = [
  { id: 'residents', line: 'Admissions, care plans and reviews', title: 'Residents and care plans', icon: 'care_ui_01', paras: [
    'Admissions (Care → Admissions) lists who is applying for a room. Someone marked Ready can be admitted to a free room straight away; others say what the home still needs.',
    'Each resident has a Care Plan: one choice for each part of their day. Change a part by tapping it. An amber dot means the plan is due for review: check it, then tap Reviewed.',
    'Call bells, missed care and how each resident feels are on their card. Tap them in the home, or find them under Care.',
  ] },
  { id: 'staff', line: 'Shifts, Safe Coverage, hiring, training', title: 'Staff and shifts', icon: 'care_ui_02', paras: [
    'There are three shifts: Morning, Afternoon and Night. In the roster (Staff), tap someone, then a shift, to move them. Every shift needs someone on it.',
    'Each shift has a Safe Coverage bar: green at 100% or more, amber just under, red well under. Hire from Recruit when the team is stretched.',
    'Staff get tired. The Staff Room helps them rest, and Training Room courses raise their stats for good.',
  ] },
  { id: 'activities', line: 'The weekly timetable and programs', title: 'Activities and programs', icon: 'care_ui_18', paras: [
    'The timetable (Care → Activities) has a Morning and an Afternoon slot every day. Tap a slot and choose an activity, or free time.',
    'Residents choose whether to join. Declining is always fine: nobody is made to take part.',
    'Specialist programs (Develop → Programs) are longer pieces of care with their own staff hours. Research opens more of them.',
  ] },
  { id: 'quality', line: 'Scores, Rank, accreditation, inspections', title: 'Quality and inspections', icon: 'care_ui_28', paras: [
    'Quality shows the five headline scores: Resident Wellbeing, Clinical Safety, Family Trust, Staff Wellbeing, and Environment & Compliance. Your Rank comes from them.',
    'When the home would pass an accreditation, apply for it from Quality → Accreditation. Inspectors visit, and the peer homes show how you compare.',
    'The Open Day and the Awards Evening come round every year.',
  ] },
  { id: 'money', line: 'Fees, costs, the Ledger, partners, grants', title: 'Money and partners', icon: 'care_ui_05', paras: [
    'Room fees and Care Support Funding come in each month; wages, food and upkeep go out. The Ledger (Business → Ledger) shows every Credit.',
    'Community partners offer deals with goals and rewards. Grants pay when their goals are met.',
    'If money runs short, the community bank can help. Look at Business early so it never comes to that.',
  ] },
  { id: 'building', line: 'Build Mode, upgrades, stages and wings', title: 'Building and levels', icon: 'care_ui_21', paras: [
    'Build Mode (Develop → Build Mode) places, moves and sells rooms and facilities. Every facility does something for the home.',
    'Tap a facility and choose Upgrade to raise it to Level II, then III: its bonus grows.',
    'The home grows through five stages, then new wings, each with more rooms.',
  ] },
  { id: 'families', line: 'Family Trust, visits and complaints', title: 'Families', icon: 'care_ui_10', paras: [
    'Every resident’s family has a Family Trust score. Visits, care-plan meetings and answering their questions all raise it.',
    'The Reception / Family Desk is where families are met. Compliments and complaints arrive in the Inbox; acting on a complaint wins trust back.',
  ] },
  { id: 'records', line: 'Secrets, achievements, the Memory Book', title: 'Secrets and records', icon: 'care_ui_28', paras: [
    'Secrets are hidden goals. Clues appear as you play; the Records list what you have found.',
    'Achievements, Home Records, the Staff Hall of Fame, the Trophy Case and the Memory Book are kept across every home you run.',
  ] },
  { id: 'ngPlus', line: 'The Year-16 grade and what comes next', title: 'New Game+', icon: 'care_brand_06', paras: [
    'At the end of Year 16 the home is graded out of 1,000. Keep running it as long as you like, or start New Game+.',
    'New Game+ starts a new home in another slot. The finished home is kept just as it is. Legacy Staff and program blueprints come with you, and part of your research comes back as Research Points.',
    'There are three New Game+ levels, each bringing a little more.',
  ] },
];
export const helpTopicById = (id) => HELP_TOPICS.find((t) => t.id === id) ?? null;

