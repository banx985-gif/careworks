// CAREWORKS placement combos (overnight Stage 6, a Kairosoft idea: SERIES_KAIROSOFT_LESSONS.md "placement combos"). Two
// pieces placed close together (their footprints at most COMBO_REACH tiles apart) help each other: the named one gets a
// small lift on its own effect (with its level and its growth from use). Always a bonus, never needed for anything; shown
// in Build Mode (a soft line between the two) and on the Build list. PLACEHOLDERS (DECISIONS.md, overnight Stage 6).
export const COMBO_REACH = 2;
export const COMBOS = [
  { id: 'gardenLounge', a: 'F14', b: 'F05', boost: 'F14', pct: 5, text: 'Garden by the Activity Lounge: gardening sessions a little better' },
  { id: 'diningKitchen', a: 'F03', b: 'F04', boost: 'F03', pct: 5, text: 'Dining Room by the Kitchen: meals arrive hot' },
  { id: 'quietBedrooms', a: 'F06', b: 'RM01', boost: 'F06', pct: 5, text: 'Quiet Lounge by the bedrooms: better rest' },
  { id: 'nutritionKitchen', a: 'F17', b: 'F04', boost: 'F17', pct: 5, text: 'Nutrition Office by the Kitchen: diets made just right' },
  { id: 'physioRehab', a: 'F07', b: 'RM06', boost: 'F07', pct: 5, text: 'Physio Space by a Rehabilitation Room: shorter walks to practise' },
  { id: 'gymFalls', a: 'F19', b: 'F18', boost: 'F19', pct: 5, text: 'Falls Prevention Lab by the Rehabilitation Gym: steadier on their feet' },
  { id: 'memoryRooms', a: 'F20', b: 'RM05', boost: 'F20', pct: 5, text: 'Memory Activity Room by the Memory Support Rooms: a calm, familiar way there' },
  { id: 'sensoryGarden', a: 'F21', b: 'F22', boost: 'F21', pct: 5, text: 'Sensory Room by the Memory Garden: quiet moments flow outside' },
  { id: 'familyReception', a: 'F15', b: 'F09', boost: 'F15', pct: 5, text: 'Family Room by Reception: families settle in quickly' },
  { id: 'palliativeSuite', a: 'F24', b: 'RM07', boost: 'F24', pct: 5, text: 'Palliative Family Lounge by a Palliative Suite: family close by' },
  { id: 'staffStation', a: 'F08', b: 'F01', boost: 'F08', pct: 5, text: 'Staff Room by the Nurse Station: real breaks, close at hand' },
  { id: 'libraryQuiet', a: 'F13', b: 'F06', boost: 'F13', pct: 5, text: 'Library Corner by the Quiet Lounge: a peaceful read' },
];
export const comboById = (id) => COMBOS.find((c) => c.id === id) ?? null;
