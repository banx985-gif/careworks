// Zones (Milestone 40d, data/balance.js ZONES): each Care Worker and nurse on a shift looks after the rooms nearest each
// other — the residents' rooms in walking order (rows of the floor in bands, each band left to right, then right to
// left, as a carer walks the corridor), cut into one even run per person. They do their own zone's room tasks first and
// only cross into someone else's while their own has nothing waiting. Pure: the home world and the Node tests use it.
//   walkOrder(rooms: [{ id, col, row }], band) → the same rooms in walking order
//   splitZones(rooms, staffIds, band) → Map staffId → Set(roomId)   (no one: an empty map)
export function walkOrder(rooms, band = 8) {
  const bandOf = (r) => Math.floor(r.row / band);
  return [...rooms].sort((a, b) => {
    const ba = bandOf(a);
    const bb = bandOf(b);
    if (ba !== bb) return ba - bb;
    const dir = ba % 2 ? -1 : 1; // (the next band walked back the other way)
    return dir * (a.col - b.col) || a.row - b.row || (a.id < b.id ? -1 : 1);
  });
}
export function splitZones(rooms, staffIds, band = 8) {
  const out = new Map();
  if (!staffIds.length) return out;
  const order = walkOrder(rooms, band);
  const k = staffIds.length;
  staffIds.forEach((id, i) => out.set(id, new Set(order.slice(Math.round((i * order.length) / k), Math.round(((i + 1) * order.length) / k)).map((r) => r.id))));
  return out;
}
