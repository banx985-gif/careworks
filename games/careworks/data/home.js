// The small home (Milestone 1, bible §4): one residential home on a hidden 12×16 grid, seen in the 3/4 dollhouse view.
// Plain data only. Columns run along the right-hand back wall, rows along the left-hand one; (0, 0) is the far corner.
//
//   cols 0-4, rows 0-4   Arthur's Standard Room (the art fills cols 0-3, rows 0-3; row 4 is floor inside his door)
//   col 5 / row 5        the room's inside walls, doorway at col 2 on row 5
//   rows 6-9             the hall, with the Central Nurse Station
//   row 10               the lounge wall, a wide doorway at cols 5-6
//   rows 11-15           the Activity Lounge
// Walls are blocked tiles, so the A* paths (core/Pathing) can only pass through the doorways.

export const HOME = {
  cols: 12,
  rows: 16,
  cellSize: 100, // plan units per tile (pathing and walking speed)
  view: { halfW: 72, halfH: 36 }, // one tile draws as a 144 × 72 diamond (2:1, the series art angle)
  wallH: 230, // the two outer back walls, drawn px
  innerWallH: 70, // inside walls are cut down low (dollhouse), so nobody is ever hidden behind one
  margin: 90, // empty world round the home (the camera stops at the home plus this)
  zoom: { min: 0.5, max: 1.4, start: 1.0 }, // start close in (style guide §2); 0.5 shows the whole home on a phone
};

// Inside walls as runs of blocked tiles: { col, row, len, dir: 'col' (along a column, rows grow) | 'row' (along a row) }.
// gaps = doorway tiles left open in the run.
export const WALLS = [
  { id: 'roomSide', col: 5, row: 0, len: 6, dir: 'col', gaps: [] },
  { id: 'roomFront', col: 0, row: 5, len: 5, dir: 'row', gaps: [2] },
  { id: 'lounge', col: 0, row: 10, len: 12, dir: 'row', gaps: [5, 6] },
];

// Floor areas (drawn by code): where each floor finish goes. Later areas paint over earlier ones.
export const FLOORS = [
  { id: 'hall', col: 0, row: 0, w: 12, h: 16, look: 'hall' },
  { id: 'room', col: 0, row: 0, w: 5, h: 5, look: 'room' },
  { id: 'lounge', col: 0, row: 11, w: 12, h: 5, look: 'lounge' },
];

// Everything placed on the grid (Milestone 10 builds more). fp = footprint in tiles (blocked for walking, except a
// walk-in room's). spots = named tiles people stand on. text = the one line on its sheet (what it is for).
export const PLACED = [
  {
    id: 'F01', kind: 'station', name: 'Central Nurse Station', art: 'facility_f01', fp: { col: 7, row: 6, w: 3, h: 3 },
    text: 'Coordinates shifts, care rounds and handovers',
    spots: { staff: { col: 8, row: 9 } },
  },
  {
    id: 'F05', kind: 'station', name: 'Activity Lounge', art: 'facility_f05', fp: { col: 3, row: 11, w: 3, h: 3 },
    text: 'Group activities and a comfortable place to relax',
    spots: { resident: { col: 4, row: 14 }, staff: { col: 6, row: 13 } },
  },
  {
    id: 'RM01', kind: 'room', name: 'Standard Room', art: 'room_rm01', fp: { col: 0, row: 0, w: 4, h: 4 },
    text: 'A private room for general long-term care',
    walkIn: true, // the art is the room itself: drawn under the people, and its floor stays walkable
    blockedInside: [{ col: 0, row: 0, w: 4, h: 3 }], // the bed, the drawers and the chair
    spots: { inside: { col: 2, row: 4 }, doorway: { col: 2, row: 5 } },
  },
];

// Drawing: every placed picture at one scale. width = the footprint's diamond width × this; drop = how far (in tile
// heights) its base sits below the footprint's front corner. Walk-in rooms fill their footprint a little more.
export const ART_DRAW = { station: { width: 1.05, drop: 0.25 }, room: { width: 1.12, drop: 0.35 } };
// People: drawn height in logical px at zoom 1 (tested against the room and station art at phone scale).
export const PERSON = { height: 190, speed: 150, tagSize: 28 };

// The one resident (bible §7, RES01) and their loop: rest in the room → the lounge → back. rest = seconds at each stop.
export const RESIDENT = {
  id: 'RES01', name: 'Arthur Lane', age: 68, support: 'Light Support', art: 'resident_res01', room: 'RM01',
  loop: [
    { at: 'RM01.inside', rest: 7, walking: 'Walking to his room', here: 'Resting in his room' },
    { at: 'F05.resident', rest: 9, walking: 'Walking to the lounge', here: 'Relaxing in the lounge' },
  ],
};

// The worker: the run's Founder (from the slot's setup). Loop: nurse station → Arthur's doorway → lounge → back.
export const WORKER_LOOP = [
  { at: 'F01.staff', rest: 5, walking: 'Walking to the nurse station', here: 'At the nurse station' },
  { at: 'RM01.doorway', rest: 3, walking: "Going to check on Arthur", here: "Checking on Arthur" },
  { at: 'F05.staff', rest: 5, walking: 'Walking to the lounge', here: 'Helping in the lounge' },
];

// Colours drawn by code: residential, not hospital — warm cream, sage and timber.
export const HOME_LOOK = {
  // core/IsoRoom look for the hall floor and the two outer walls
  floorA: '#F3E6CB', floorB: '#EEDDBD', grout: 'rgba(120, 90, 50, 0.10)',
  wallFace: '#DCE7D3', wallSide: '#C9D9BF', wallLine: 'rgba(60, 80, 55, 0.25)', wallCap: '#3B342C',
  skirting: '#B98C5E', rail: '#F6EFDF',
  floors: {
    hall: null, // the IsoRoom checker
    room: { a: '#E2B884', b: '#DAAE78', line: 'rgba(110, 70, 30, 0.18)' }, // timber boards
    lounge: { a: '#E7D3B0', b: '#E1CBA5', line: 'rgba(110, 80, 40, 0.10)' }, // soft carpet
  },
  innerWall: { top: '#F6EFDF', front: '#C9D9BF', side: '#B5C9A9', line: '#3B342C' },
  shadow: 'rgba(60, 45, 25, 0.12)',
  window: { frame: '#FFFFFF', glass: '#BFE3EE', shine: 'rgba(255,255,255,0.55)' },
  buildTint: 'rgba(30, 156, 196, 0.10)',
  buildLine: 'rgba(30, 156, 196, 0.45)',
};
