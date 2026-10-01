// CAREWORKS image list: key → path (relative to index.html). Batch art is added here milestone by milestone; anything
// missing draws the placeholder box, never crashes.
import { PLACED, PROPS, STAGES } from './home.js';
import { ROOMS } from './rooms.js';
import { BUILDABLE_FACILITIES } from './facilities.js';
import { BOTTOM_SLOTS, TOP_ICONS, CARE_ICONS } from './bars.js';
import { CARE_POPS } from './pops.js';
import { RESIDENTS } from './residents.js';
import { FOUNDERS } from './setup.js';
import { STAFF } from './staff.js';
import { ROLES } from './roles.js';
import { ACTIVITIES, BIRTHDAY } from './activities.js';
import { TROLLEYS } from './dining.js';
import { DISCHARGE } from './mobility.js';
import { ROUND } from './clinical.js';
import { FAMILY_ICONS, FIRSTS, COMPLIMENT } from './family.js';
import { VISIBLE_PROGRAMS } from './programs.js';
import { PARTNERS } from './partners.js';
import { WINGS_SPECIAL } from './wings.js';

const art = (folder, key) => [key, `assets/images/${folder}/${key}.png`];

export const ASSETS = {
  // Milestone 1, the small home: the placed station / lounge / room, Arthur, and every Founder (the worker is the run's
  // Founder).
  ...Object.fromEntries(PLACED.map((p) => art(p.kind === 'room' ? 'rooms' : 'facilities', p.art))),
  // Milestone 10: every room and facility Build Mode can place (not the two secret ones), and the stage pictures
  ...Object.fromEntries(ROOMS.map((r) => art('rooms', r.art))),
  ...Object.fromEntries(BUILDABLE_FACILITIES.map((f) => art('facilities', f.art))),
  ...Object.fromEntries(STAGES.filter((s) => s.art).map((s) => art('events', s.art))),
  ...Object.fromEntries(RESIDENTS.map((r) => art('residents', r.art))),
  ...Object.fromEntries(FOUNDERS.map((f) => art('staff', f.art))),
  // Milestone 3: every staff portrait on the roster data and the five role badges (staff cards).
  ...Object.fromEntries(STAFF.map((s) => art('staff', s.art))),
  ...Object.fromEntries(Object.values(ROLES).map((r) => art('badges', r.badge))),
  // Milestone 5: the five early props, the three care pops, the bar icons (bottom-bar slots, Credits / Care Tokens) and
  // the Care sheet's icons (Admissions, the call bell).
  ...Object.fromEntries(PROPS.map((p) => art('props', p.art))),
  ...Object.fromEntries(Object.values(CARE_POPS).map((p) => art('vfx', p.art))),
  ...Object.fromEntries(BOTTOM_SLOTS.map((s) => art('ui', s.icon))),
  ...Object.fromEntries(Object.values(TOP_ICONS).map((k) => art('rewards', k))),
  ...Object.fromEntries(Object.values(CARE_ICONS).map((k) => art('ui', k))),
  // Milestone 14: the activity props (drawn in the room while a session runs) and the First Birthday picture
  ...Object.fromEntries(ACTIVITIES.filter((a) => a.prop).map((a) => art('props', a.prop))),
  ...Object.fromEntries([art('events', BIRTHDAY.firstArt)]),
  // Milestone 15: the Hydration Cart on the drinks rounds (the dining trolley is one of the early props)
  ...Object.fromEntries([art('equipment', TROLLEYS.round)]),
  // Milestone 16: the First Rehab Discharge picture (the aid props are early props, listed above)
  ...Object.fromEntries([art('events', DISCHARGE.firstArt)]),
  // Milestone 18: the Medication Cart (pushed on the medicine round; beside the Medication Room otherwise)
  ...Object.fromEntries([art('equipment', ROUND.cart)]),
  // Milestone 19: the Family Trust / complaint / compliment icons, the First Family Visit picture, the Family Thank-You
  // Card (the first compliment)
  ...Object.fromEntries(Object.values(FAMILY_ICONS).map((k) => art('ui', k))),
  ...Object.fromEntries([art('events', FIRSTS.visitArt), art('rewards', COMPLIMENT.firstArt)]),
  // Milestone 20: the ten visible program icons (PRG11 / PRG12 are secret: not loaded, never listed)
  ...Object.fromEntries(VISIBLE_PROGRAMS.map((p) => art('programs', p.icon))),
  // Milestone 23: the eight community partners' logos (the Partners sheet)
  ...Object.fromEntries(PARTNERS.map((p) => art('logos', p.logo))),
  // Milestone 24: a wing's opening moment (the Memory Wing's own picture; the others show their hub, already listed)
  ...Object.fromEntries(WINGS_SPECIAL.filter((w) => w.beat.startsWith('care_event')).map((w) => art('events', w.beat))),
  // Milestone 0 loader test (?screen=test): the placeholder PWA icon as a real image, and one deliberately missing file.
  m0Real: 'assets/branding/pwa/icon-192.png',
  m0Missing: 'assets/m0-missing-test.png',
};
