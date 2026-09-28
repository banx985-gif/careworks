// The roster (Milestone 3): a single Morning shift — the Morning peak and Afternoon bands, 06:00–17:00 — with the whole
// opening team on it. Afternoon / Night templates, wings and floats arrive in Milestone 7. Pure: the Node tests use it.
//   createRoster(state)          state = the run's staff state (its roster.shifts: staff id → shift id)
//   roster.shiftOf(id) → { id, name, bands, from, to } | null
//   roster.onShift(id, hour, bandId) → bool      on shift when the band is one of the shift's bands
//   roster.onShiftIds(hour, bandId) → [id]
//   roster.label(id) → "Morning shift · 06:00–17:00"
import { SHIFTS } from '../../data/balance.js';
import { clockText } from './residentNeeds.js';

export function createRoster(state) {
  const shiftOf = (id) => {
    const key = state.roster.shifts[id];
    return key && SHIFTS[key] ? { id: key, ...SHIFTS[key] } : null;
  };
  return {
    shiftOf,
    onShift(id, hour, bandId) {
      const s = shiftOf(id);
      return !!s && s.bands.includes(bandId);
    },
    onShiftIds(hour, bandId) {
      return Object.keys(state.roster.shifts).filter((id) => this.onShift(id, hour, bandId));
    },
    label(id) {
      const s = shiftOf(id);
      return s ? `${s.name} shift · ${clockText(s.from)}–${clockText(s.to)}` : 'Not on a shift';
    },
  };
}
