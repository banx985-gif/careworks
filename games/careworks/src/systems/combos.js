// Placement combos (overnight Stage 6, data/combos.js): which pairs are placed close together now, and the lift each
// piece gets from them. Pure rules on the layout's pieces ({ uid, defId, box: { col, row, w, h } }); worked out again only
// when the layout changes (the pieces list is a new array then).
//   activeCombos(pieces) → [{ combo, a: piece, b: piece }]   one per combo (the closest pair if there are several)
//   comboPctOf(uid, pieces) → percent lift for that piece (its combos added up)
import { COMBOS, COMBO_REACH } from '../../data/combos.js';

const gapOf = (p, q) => {
  const A = p.box ?? p.fp;
  const B = q.box ?? q.fp;
  const dc = Math.max(0, A.col - (B.col + B.w), B.col - (A.col + A.w));
  const dr = Math.max(0, A.row - (B.row + B.h), B.row - (A.row + A.h));
  return Math.max(dc, dr);
};
const memo = new WeakMap();

export function activeCombos(pieces) {
  if (memo.has(pieces)) return memo.get(pieces);
  const out = [];
  for (const c of COMBOS) {
    let best = null;
    for (const a of pieces) {
      if (a.defId !== c.a) continue;
      for (const b of pieces) {
        if (b.defId !== c.b || b.uid === a.uid) continue;
        const g = gapOf(a, b);
        if (g <= COMBO_REACH && (!best || g < best.gap)) best = { combo: c, a, b, gap: g };
      }
    }
    if (best) out.push(best);
  }
  memo.set(pieces, out);
  return out;
}

export function comboPctOf(uid, pieces) {
  let pct = 0;
  for (const x of activeCombos(pieces)) {
    const target = x.combo.boost === x.a.defId ? x.a : x.b;
    if (target.uid === uid) pct += x.combo.pct;
  }
  return pct;
}
