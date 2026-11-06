// Walking chibis (Milestone 40c, SERIES_STAFF_CHIBIS.md): the people who walk in the home are the series 3D chibis,
// rendered as sprite sheets; the flat art stays on every card, pop-up and list. One lookup for every walker:
//   staff and residents — their own recoloured sheet (assets/images/walkers/<art id>_sheet.png, data/walkers.js lists the
//                         ones made); Aaron — his own chibi #71; the Works Gods — their god sheets; the M32c visitors —
//                         their cast chibi's sheet, as it is (no recolour). Anyone without a sheet (the residents whose
//                         flat art shows a walking frame or wheelchair, or a sheet that hasn't loaded yet) keeps today's
//                         walker.
// Sheets load lazily (the first time someone is drawn), so the first screen never waits for ~100 sheets.
//   walkerKeyOf(person) → { key, path } | null      person: a crew / resident / visitor entry ({ kind, id, art, model, cast })
//   drawWalker(ctx, assets, who, { x, y, h, anim, back, mirror, t }) → true when a sheet frame was drawn
//     x, y: the feet · h: the person's drawn height · anim: 'idle' | 'walk' | 'work' · back: seen from behind
// The layout is the series standard (chibis/sprites/sprites.json): 8 columns; rows front idle / walk / work / cheer, then
// back idle / walk / work / cheer. The web copies have 128 px frames (tools/cw_sprite_web.mjs); the frame size is read
// from the image, so a 256 px master works the same.
import { WALKER_IDS } from '../../data/walkers.js';
import { castById } from '../../data/cast.js';

const COLUMNS = 8;
const ROWS = { idle: [0, 4, 4], walk: [1, 8, 10], work: [2, 6, 8], cheer: [3, 6, 8] }; // anim → [front row, frames, fps]
const BACK = 4; // back rows = front rows + 4
export const FEET = { x: 138 / 256, y: 240 / 256 }; // where the feet are in a frame
export const BODY = 220 / 256; // the figure's height in a frame (head to feet)
const AARON_ID = 'LC13';
const HAS = new Set(WALKER_IDS);

const keyFor = (name, folder) => ({ key: `walk_${name}`, path: `assets/images/${folder}/${name}_sheet.png` });
export function walkerKeyOf(p) {
  if (!p) return null;
  if (p.kind === 'visitor') {
    const cid = p.cast ?? p.v?.cast ?? null; // (the family's visitor, picked once and kept — Milestone 32c)
    const c = cid ? castById(cid) : null;
    return c?.chibi ? keyFor(c.chibi, 'cast') : null;
  }
  const id = p.model?.id ?? p.id;
  if (id === AARON_ID) return keyFor('chibi_71_aaron_banx_games_founder', 'cast');
  if (p.model?.tier === 'divine' && p.model?.god) return keyFor(`god_${p.model.god}`, 'cast');
  const art = p.art ?? p.model?.art;
  return art && HAS.has(art) ? keyFor(art, 'walkers') : null;
}

const state = new Map(); // key → 'loading' | 'ready' | 'failed'
function ready(assets, w) {
  const s = state.get(w.key);
  if (s === 'ready') return assets.get(w.key);
  if (!s && assets.loadImage) {
    state.set(w.key, 'loading');
    Promise.resolve(assets.loadImage(w.key, w.path))
      .then((img) => state.set(w.key, img ? 'ready' : 'failed'))
      .catch(() => state.set(w.key, 'failed'));
  }
  return null;
}
export const walkerStats = () => ({ ready: [...state.values()].filter((s) => s === 'ready').length, loading: [...state.values()].filter((s) => s === 'loading').length, failed: [...state.values()].filter((s) => s === 'failed').length });

export function drawWalker(ctx, assets, who, { x, y, h, anim = 'idle', back = false, mirror = false, t = 0, alpha = 1 }) {
  const w = walkerKeyOf(who);
  if (!w) return false;
  const img = ready(assets, w);
  const iw = img?.naturalWidth || img?.width;
  if (!iw) return false;
  const fs = iw / COLUMNS;
  const [row0, frames, fps] = ROWS[anim] ?? ROWS.idle;
  const row = row0 + (back ? BACK : 0);
  const f = Math.floor(Math.max(0, t) * fps) % frames;
  const k = h / (BODY * fs); // the figure (not the frame) is h tall
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(img, f * fs, row * fs, fs, fs, -FEET.x * fs * k, -FEET.y * fs * k, fs * k, fs * k);
  ctx.restore();
  return true;
}
