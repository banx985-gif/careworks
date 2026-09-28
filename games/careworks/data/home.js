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
    spots: { resident: { col: 4, row: 14 }, staff: { col: 6, row: 13 }, dining: { col: 8, row: 12 } }, // dining: until the Dining Room exists
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
export const PERSON = { height: 190, speed: 280, tagSize: 28 }; // speed: staff, plan units a game-second (Milestone 3: brisker, so
// helpers reach Arthur within his routine)

// The home's one resident (Milestone 2: his profile is data/residents.js, his day data/routine.js) and the room he is
// assigned. speed: plan units per game-second at 1× — a little brisker than staff, so a room → lounge walk (~16 tiles)
// takes about 1.8 game hours of his day.
export const RESIDENT = { id: 'RES01', room: 'RM01', speed: 240 };

// Where staff stand (Milestone 3). Named tiles outside the placed things (spotTile() reads these as well as PLACED spots).
export const SPOTS = {
  'hall.rnRound': { col: 7, row: 4 },
  'hall.cwPost': { col: 3, row: 7 },
  'hall.cwRound': { col: 9, row: 3 },
  'hall.ahPost': { col: 4, row: 8 },
  'hall.ahRound': { col: 10, row: 5 },
  'lounge.lcRound': { col: 9, row: 14 },
  'lounge.hnPost': { col: 10, row: 13 },
  'lounge.hnRound': { col: 7, row: 11 },
  // helpers stand beside Arthur: in his room, at the dining spot, at the Cards table
  'help.room': { col: 3, row: 4 },
  'help.dining': { col: 9, row: 12 },
  'help.lounge': { col: 5, row: 14 },
  // Milestone 4: a second spot at each, for when two people come to him at once (e.g. breakfast and the medicine round)
  'help.room2': { col: 1, row: 4 },
  'help.dining2': { col: 7, row: 12 },
  'help.lounge2': { col: 3, row: 14 },
  // off shift: standing down in the lounge (the Staff Room area until the Staff Room exists)
  'rest.1': { col: 8, row: 15 },
  'rest.2': { col: 10, row: 15 },
  'rest.3': { col: 11, row: 12 },
  'rest.4': { col: 7, row: 15 },
  'rest.5': { col: 11, row: 14 },
};
// On shift and not helping, each role walks between its post and a second spot (so the home never looks frozen).
// stay = game-seconds at each.
export const POSTS = {
  RN: { spots: ['F01.staff', 'hall.rnRound'], stay: [6, 3] },
  CW: { spots: ['hall.cwPost', 'hall.cwRound'], stay: [6, 3] },
  LC: { spots: ['F05.staff', 'lounge.lcRound'], stay: [6, 3] },
  AH: { spots: ['hall.ahPost', 'hall.ahRound'], stay: [6, 3] },
  HN: { spots: ['lounge.hnPost', 'lounge.hnRound'], stay: [6, 3] },
};
// Where a helper stands for each routine place.
export const HELP_SPOTS = { room: 'help.room', dining: 'help.dining', lounge: 'help.lounge' };
export const HELP_SPOTS_2 = { room: 'help.room2', dining: 'help.dining2', lounge: 'help.lounge2' };

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
