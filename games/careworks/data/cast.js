// CAREWORKS — the series chibi cast in this home (Milestone 32c, SERIES_CHIBI_CAST.md, docs/M32c_CHIBI_CAST.md).
// The walking sprite sheets are not made yet (the series decides that once for every game), so this is data and names
// only: each person has a series chibi id, a name and job of this game's own, and a slot. The systems that already show
// these people pick from their slot's pool and store the id, so the right figure walks in once the sheets arrive. No art
// is drawn, loaded or replaced: residents and staff keep their own art. The cast are everyday people — never as strong as
// the Works Gods, never sold.
//
// PLACEHOLDERS (DECISIONS.md, M32c): the people Cowork named without a matching system (the partner reps' partners).

// The series cast list (SERIES_CHIBI_CAST.md, 31 Oct 2026): every chibi file id.
export const SERIES_CHIBIS = [
  'chibi_01_curly_yellow_jumper', 'chibi_02_teal_hoodie', 'chibi_03_showman_tux', 'chibi_04_silver_green_suit', 'chibi_05_blue_top',
  'chibi_06_red_shirt', 'chibi_07_moustache_polo', 'chibi_08_red_cardigan', 'chibi_09_pink_shorts', 'chibi_10_topknot_shorts',
  'chibi_11_moustache_shorts', 'chibi_12_beach_shirt', 'chibi_13_beard_workwear', 'chibi_14_glasses_vest', 'chibi_15_denim_jacket',
  'chibi_16_curly_coral_tee', 'chibi_17_green_hoodie', 'chibi_18_yellow_tee', 'chibi_19_sporty_red', 'chibi_20_athlete_blue',
  'chibi_21_platinum_sporty', 'chibi_22_teal_sports_tee', 'chibi_23_ponytail_purple_sports', 'chibi_24_orange_tracksuit', 'chibi_25_grey_pink_blazer',
  'chibi_26_grandad_cardigan', 'chibi_27_bob_green_shirt', 'chibi_28_plum_suit', 'chibi_29_navy_suit', 'chibi_30_teal_jumper',
];
const chibi = (n) => SERIES_CHIBIS[n - 1];

// Slots: guide (the narrator), inspector (M32b), family (visiting a resident), tour (admissions), community (visitors and
// volunteers), host (the Awards Evening), rep (partner reps and the builder), rival (peer-home directors).
// `for` ties a person to the thing that names them (an inspector id, a partner id, a peer id, a builder's moments).
const c = (n, id, name, job, slot, desc, extra = {}) => ({ id, chibi: chibi(n), n, name, job, slot, desc, ...extra });
export const CAST = [
  c(8, 'rosie', 'Rosie Hart', 'Deputy Manager', 'guide', 'Warm and practical, twenty years in care homes. Gives the next-step hints, the news and gentle warnings.'),
  c(14, 'dev', 'Dev Anand', 'Clinical inspector', 'inspector', 'Looks at Clinical Safety and essential care.', { for: 'clinical' }),
  c(27, 'nina', 'Nina Brooks', 'Wellbeing inspector', 'inspector', 'Looks at Resident Wellbeing.', { for: 'wellbeing' }),
  c(25, 'margaret', 'Margaret Cole', 'Family inspector', 'inspector', 'Looks at Family Trust.', { for: 'family' }),
  c(7, 'ray', 'Ray Dunn', 'Environment inspector', 'inspector', 'Looks at Environment & Compliance and Staff Wellbeing.', { for: 'environment' }),
  // families visiting residents (picked per family once, then always the same visitor)
  c(1, 'fam01', 'A granddaughter', 'Family visitor', 'family', 'A granddaughter visiting.'),
  c(2, 'fam02', 'A grandson', 'Family visitor', 'family', 'A grandson visiting.'),
  c(5, 'fam05', 'A daughter', 'Family visitor', 'family', 'A daughter visiting.'),
  c(9, 'fam09', 'A niece', 'Family visitor', 'family', 'A niece visiting.'),
  c(15, 'fam15', 'A daughter', 'Family visitor', 'family', 'A daughter visiting.'),
  c(16, 'fam16', 'A granddaughter', 'Family visitor', 'family', 'A granddaughter visiting.'),
  c(17, 'fam17', 'A son', 'Family visitor', 'family', 'A son visiting.'),
  c(18, 'fam18', 'A grandson', 'Family visitor', 'family', 'A grandson visiting.'),
  c(30, 'fam30', 'A son', 'Family visitor', 'family', 'A son visiting.'),
  c(26, 'arthur', 'Arthur Bell', 'Prospective resident', 'tour', 'A retired postman looking round with his family before moving in. He comes on admission days; he never becomes a resident himself.'),
  // community visitors and volunteers
  c(10, 'com10', 'A volunteer helper', 'Volunteer', 'community', 'Drops in for tea and a chat.'),
  c(12, 'com12', 'A volunteer helper', 'Volunteer', 'community', 'Drops in for tea and a chat.'),
  c(22, 'com22', 'A walking-club coach', 'School walking club', 'community', 'Brings the school walking club round.'),
  c(23, 'com23', 'A walking-club coach', 'School walking club', 'community', 'Brings the school walking club round.'),
  c(19, 'com19', 'A Fun Run runner', 'Community Fun Run team', 'community', 'Runs for the home at fundraisers and the Open Day.'),
  c(20, 'com20', 'A Fun Run runner', 'Community Fun Run team', 'community', 'Runs for the home at fundraisers and the Open Day.'),
  c(21, 'com21', 'A Fun Run runner', 'Community Fun Run team', 'community', 'Runs for the home at fundraisers and the Open Day.'),
  c(24, 'com24', 'A Fun Run runner', 'Community Fun Run team', 'community', 'Runs for the home at fundraisers and the Open Day.'),
  c(3, 'max', 'Max Marvel', 'Compère', 'host', 'Hosts the Month-12 Awards Evening and the Open Day prize-giving.'),
  // partner reps (the partners that visit) and the builder
  c(29, 'daniel', 'Daniel Shaw', 'Community bank rep', 'rep', 'Comes about Emergency Credit and the rescue loan offers.', { for: 'bank' }),
  c(11, 'leo', 'Leo Marino', 'Local bakery owner', 'rep', 'Bakes for the home and visits for Hearth Nutrition.', { for: 'SPN02' }),
  c(6, 'sam', 'Sam Reyes', 'Delivery driver', 'rep', 'Drives for SilverLine Transport on outings.', { for: 'SPN06' }),
  c(13, 'bruno', 'Bruno Kowalski', 'Builder', 'rep', 'Builds the new stages and the facility level-ups.', { for: 'builder' }),
  // rival directors (peer homes)
  c(28, 'vivienne', 'Vivienne Crane', 'Director of Crown Haven', 'rival', 'Runs Crown Haven, the elite rival.', { for: 'R07' }),
  c(4, 'ivy', 'Dame Ivy Sterling', 'Chair of the Legacy House Network', 'rival', 'Chairs the Legacy House Network; only named once it appears.', { for: 'R08' }),
];
export const castById = (id) => CAST.find((x) => x.id === id) ?? null;
export const castFor = (forId) => CAST.find((x) => x.for === forId) ?? null;
export const CAST_SLOTS = ['guide', 'inspector', 'family', 'tour', 'community', 'host', 'rep', 'rival'];
export const poolOf = (slot) => CAST.filter((x) => x.slot === slot).map((x) => x.id);
// An event crowd (Open Day, Awards Evening, birthday parties): the family and community pools together.
export const CROWD_POOL = [...poolOf('family'), ...poolOf('community')];
export const CROWD_SIZE = { openDay: 6, awards: 6, party: 3 };

export const GUIDE = castById('rosie');
export const HOST = castById('max');
export const guideSays = (text) => `${GUIDE.name.split(' ')[0]}: ${text}`; // (Rosie's voice on the hint and news lines)
export const hostLine = (kind) => (kind === 'awards' ? `Your host: ${HOST.name}, compère of the Awards Evening` : `Prizes given by ${HOST.name}`);

export function validateCast(v) {
  v.uniqueIds('cast', CAST);
  v.check(SERIES_CHIBIS.length === 30, 'cast: the series list has 30 chibis');
  for (const x of CAST) {
    v.check(SERIES_CHIBIS.includes(x.chibi), `cast ${x.id}: ${x.chibi} is in SERIES_CHIBI_CAST.md`);
    v.check(CAST_SLOTS.includes(x.slot), `cast ${x.id}: slot ${x.slot}`);
    v.check(!!x.name && !!x.job && !!x.desc, `cast ${x.id}: name, job, description`);
  }
  for (const s of CAST_SLOTS) {
    const ids = CAST.filter((x) => x.slot === s).map((x) => x.chibi);
    v.check(new Set(ids).size === ids.length, `cast: no chibi twice in the ${s} slot`);
    v.check(ids.length > 0, `cast: the ${s} slot has someone`);
  }
  v.check(new Set(CAST.map((x) => x.chibi)).size === 30, 'cast: all 30 have a place');
  return v;
}
export const castStrings = () => CAST.flatMap((x) => [x.name, x.job, x.desc]);
