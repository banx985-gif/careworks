// CAREWORKS image list: key → path (relative to index.html). Batch art is added here milestone by milestone; anything
// missing draws the placeholder box, never crashes.
import { PLACED, PROPS } from './home.js';
import { BOTTOM_SLOTS, TOP_ICONS, CARE_ICONS } from './bars.js';
import { CARE_POPS } from './pops.js';
import { RESIDENTS } from './residents.js';
import { FOUNDERS } from './setup.js';
import { STAFF } from './staff.js';
import { ROLES } from './roles.js';

const art = (folder, key) => [key, `assets/images/${folder}/${key}.png`];

export const ASSETS = {
  // Milestone 1, the small home: the placed station / lounge / room, Arthur, and every Founder (the worker is the run's
  // Founder).
  ...Object.fromEntries(PLACED.map((p) => art(p.kind === 'room' ? 'rooms' : 'facilities', p.art))),
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
  // Milestone 0 loader test (?screen=test): the placeholder PWA icon as a real image, and one deliberately missing file.
  m0Real: 'assets/branding/pwa/icon-192.png',
  m0Missing: 'assets/m0-missing-test.png',
};
