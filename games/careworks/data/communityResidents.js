// Community residents (Milestone 40f, BIGJOB4 Part A: the fix for 60). Plain data only.
// The 60 named residents (data/residents.js) keep their full life stories; those who pass away never apply again, so a home
// used to peak in the high 30s. Community residents are an endless pool from the local area, the way the Trainees fixed
// staff (data/trainees.js): once the named people still to come thin out, Admissions also offers community residents
// (src/systems/admissions.js). They join activities, friendships, family visits, the Memory Book and end-of-life care like
// anyone; they never carry the named residents' secrets (src/systems/secretFacts.js reads no life-story tags from them).
//
// A community resident is made from their id alone (communityDef in data/residents.js), so a reload, the Memory Book and
// every residentById() lookup give the same person: id = CR<serial>, e.g. CR2417. The serial counts up per home from a
// start picked by the home's seed (admissions state .communityNext).
//   name    FIRST_SHE / FIRST_HE × LAST, by their look's pronoun
//   look    community_res_<nn>: one of 20 series chibi bases recoloured (grey / white / silver hair, a new cardigan or top)
//           — card still assets/images/residents/, walking sheet assets/images/walkers/. Looks repeat; names don't.
//   story   built from the pieces below: a past job, the kind of place they grew up, a hobby (their life-story tag), a
//           family member or friend who visits, one thing they love. No medical words (tools/cw_m40e_words.mjs).
//   care    a primary support drawn by weight from the same care profiles the named residents use (most suit Standard
//           Rooms; some need Memory Support or High-Care rooms, like real life)

export const COMMUNITY = {
  looks: 20,
  // looks 01–05 and 11–15 are she, 06–10 and 16–20 he (the bases: #25, #26, #04, #07)
  lookPronoun: (look) => (look <= 5 || (look >= 11 && look <= 15) ? 'she' : 'he'),
  idPattern: /^CR(\d+)$/,
  serialStart: { min: 1000, span: 8000 },
  age: { min: 70, span: 27 },
  // primary support by weight (named residents' profiles); 18 of 22 suit a Standard Room
  supportWeights: { 'Light Support': 4, 'Social Support': 3, 'Nutrition Support': 3, 'Mobility Support': 4, Rehabilitation: 2, 'Clinical Support': 2, 'Memory Support': 3, 'High Care': 1 },
  respiteShare: 0.15, // a few come for a short Respite stay (Rehabilitation is always a Rehab / Short Stay)
  personalities: ['Chatty', 'Curious', 'Stubbornly Independent', 'Quiet', 'Routine-Loving', 'Cheerful', 'Independent', 'Witty', 'Reserved', 'Warm'],
  tag: 'Community resident',
  cardLine: 'From the local community',
};

export const FIRST_SHE = [
  'Joan', 'Brenda', 'Sheila', 'Pauline', 'Doreen', 'Maureen', 'Valerie', 'Irene', 'Shirley', 'Barbara', 'Marjorie', 'Edna', 'Elsie',
  'Winifred', 'Mavis', 'Audrey', 'Gwen', 'Hilda', 'Ivy', 'Lorna', 'Nora', 'Phyllis', 'Rita', 'Sandra', 'Theresa', 'Usha', 'Vivienne',
  'Agnes', 'Beryl', 'Carol', 'Delia', 'Esme', 'Freda', 'Glenys', 'Ida', 'Josie', 'Mabel', 'Nell', 'Olwen', 'Pearl', 'Ruby', 'Stella',
  'Tessa', 'Una', 'Amara', 'Nirmala', 'Bernadette', 'Mei', 'Fatima', 'Gurpreet',
];
export const FIRST_HE = [
  'Arnold', 'Bert', 'Cyril', 'Derek', 'Dennis', 'Eric', 'Geoffrey', 'Gerald', 'Howard', 'Jim', 'Leonard', 'Les', 'Neville', 'Percy',
  'Ray', 'Reg', 'Ron', 'Sid', 'Ted', 'Terry', 'Vernon', 'Wilf', 'Alan', 'Brian', 'Dave', 'Graham', 'Kenneth', 'Lionel', 'Rajesh',
  'Winston', 'Tariq', 'Joseph', 'Patrick', 'Roy', 'Stan', 'Barry', 'Clifford', 'Douglas', 'Errol', 'Felix', 'Gilbert', 'Harold',
  'Ivor', 'Jeffrey', 'Lloyd', 'Monty', 'Nigel', 'Owen', 'Raymond', 'Samuel',
];
export const LAST = [
  'Ashworth', 'Bradley', 'Cartwright', 'Dawson', 'Eccles', 'Fairbairn', 'Gibbons', 'Holloway', 'Ingham', 'Jennings', 'Kirby',
  'Lambert', 'Metcalfe', 'Newbold', 'Oakley', 'Pennington', 'Radcliffe', 'Sutcliffe', 'Thornton', 'Underwood', 'Varley', 'Whitaker',
  'Atkinson', 'Brennan', 'Chowdhury', 'Davies', 'Edwards', 'Fletcher', 'Gallagher', 'Harrison', 'Iqbal', 'Johnson', 'Kowalski',
  'Lightfoot', 'Mitchell', 'Nicholls', "O'Brien", 'Pickering', 'Robinson', 'Sharma', 'Thompson', 'Wainwright', 'Yardley', 'Bailey',
  'Campbell', 'Duffy', 'Ferguson', 'Hamilton', 'Murray', 'Williams', 'Okonkwo', 'Begum', 'Lewis',
];

// The story pieces (no medical words; plain, warm and everyday).
export const JOBS = [
  'A retired postal worker', 'A former school cook', 'A retired bus driver', 'A one-time shopkeeper', 'A retired joiner',
  'A former mill worker', 'A retired bookkeeper', 'A former hairdresser', 'A retired park keeper', 'A former telephone operator',
  'A retired printer', 'A former market trader', 'A retired engineer', 'A former seamstress', 'A retired farmhand', 'A former baker',
  'A retired electrician', 'A retired taxi driver', 'A former office clerk', 'A retired teacher', 'A former window cleaner',
  'A retired lorry driver', 'A former factory supervisor', 'A retired caretaker',
];
export const PLACES = [
  'a seaside town', 'a fishing village', 'a market town', 'a busy city street', 'a farming village', 'a mining town',
  'a canal-side terrace', 'a hill village', 'a railway town', 'a river town', 'a new-town estate', 'a quiet suburb',
];
// hobby → their life-story tag (data/lifeStories.js LIFE_TAGS)
export const HOBBIES = [
  { tag: 'Gardening', text: 'kept an allotment for forty years' },
  { tag: 'Music', text: 'sang in the local choir' },
  { tag: 'Dancing', text: 'danced every Saturday night' },
  { tag: 'Reading', text: 'never goes anywhere without a book' },
  { tag: 'History', text: 'knows the story of every old street' },
  { tag: 'Community', text: 'ran the street party every summer' },
  { tag: 'Cards', text: 'plays a sharp hand of whist' },
  { tag: 'Football', text: 'followed the local team home and away' },
  { tag: 'Fishing', text: 'fished the river every weekend' },
  { tag: 'Faith', text: 'sang at the Sunday service for years' },
  { tag: 'Crafts', text: 'knits for the whole family' },
  { tag: 'Pets', text: 'always had a dog at heel' },
  { tag: 'Travel', text: 'took a coach trip every summer' },
  { tag: 'Cooking', text: 'makes a famous Sunday roast' },
];
// who visits → the Visitors column the family system reads
export const FAMILY = [
  { who: 'daughter', visitors: 'Frequent family' }, { who: 'son', visitors: 'Frequent family' },
  { who: 'granddaughter', visitors: 'Frequent family' }, { who: 'grandson', visitors: 'Occasional family' },
  { who: 'niece', visitors: 'Occasional family' }, { who: 'nephew', visitors: 'Occasional family' },
  { who: 'sister', visitors: 'Occasional family' }, { who: 'brother', visitors: 'Occasional family' },
  { who: 'oldest friend', visitors: 'Community visitor' }, { who: 'old neighbour', visitors: 'Community visitor' },
];
export const WHEN = ['every Sunday', 'most weekends', 'on Wednesdays', 'whenever they can', 'after work on Fridays'];
export const LOVES = [
  'a strong cup of tea', 'a warm scone', 'the radio in the morning', 'a good crossword', 'fresh flowers on the sill',
  'a seat by the window', 'old films on a rainy day', 'a bit of chocolate after lunch', 'the birdsong in the garden',
  'a sunny bench', 'a good natter', 'the smell of fresh bread', 'a game of dominoes', 'a hand of cards after tea',
];

// Small helpers (no imports, so data/residents.js can use them without a loop).
export const hashOf = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
};
// A seeded 0–1 stream from a 32-bit hash (mulberry32).
export function streamOf(h) {
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const isCommunityId = (id) => COMMUNITY.idPattern.test(String(id ?? ''));
export const communityId = (serial) => `CR${serial}`;
export const firstCommunitySerial = (seed) => COMMUNITY.serialStart.min + (hashOf(`community:${seed}`) % COMMUNITY.serialStart.span);
export const COMMUNITY_ARTS = Array.from({ length: COMMUNITY.looks }, (_, i) => `community_res_${String(i + 1).padStart(2, '0')}`);
