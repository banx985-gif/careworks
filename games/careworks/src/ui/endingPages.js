// The Year-16 ending's pages (Milestone 33): one card per page — the C10 result, the look back, Rosie's closing line, the
// end choice — and the Living Legacy ending's two pages. One tap carries on; Skip (top right of the card) is always there
// except on the end choice, which waits for its two buttons. The grade page itself is the M32b ceremony card
// (src/ui/ceremony.js), opened by src/main.js between these. It takes every tap while it is up; the home's clock waits.
//
//   const pages = createEndingPages({ width, height: () => H, assets, onTap: (what) => … })
//     what: 'next' · 'skip' · 'keep' · 'ngplus'
//   pages.show(page) — page: { id, title, art, lines: [text], quote, by, choice: { keep, ngplus } } · pages.hide()
//   pages.active · pages.current · pages.onTap(p) · pages.render(ctx) · pages.update(dt) · pages.rectOf('skip' | 'keep' | 'ngplus')
import { THEME, font } from '../../../../core/Theme.js';
import { panel, wrapLines } from '../../../../core/ui/Kit.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { ENDING_TEXT } from '../../data/ending.js';

const C = THEME.color;
const S = THEME.size;

export function createEndingPages({ width = 1080, height = () => 1920, assets = null, onTap = () => {} }) {
  let cur = null;
  let t = 0;
  const geo = () => {
    const H = height();
    const cardW = Math.min(width - 64, 980);
    const x = (width - cardW) / 2;
    const cardH = Math.min(H - 120, 1500);
    const y = Math.max(60, (H - cardH) / 2);
    const box = { x, y, w: cardW, h: cardH };
    const skip = { x: x + cardW - 250, y: y + 24, w: 226, h: THEME.button.minH };
    const bw = cardW - 120;
    const keep = { x: x + 60, y: y + cardH - 2 * (THEME.button.minH + 30) - 30, w: bw, h: THEME.button.minH + 10 };
    const ngplus = { x: x + 60, y: keep.y + keep.h + 30, w: bw, h: THEME.button.minH + 10 };
    return { box, skip, keep, ngplus };
  };
  const api = {
    get active() {
      return !!cur;
    },
    get current() {
      return cur;
    },
    show(page) {
      cur = page;
      t = 0;
      return true;
    },
    hide() {
      cur = null;
    },
    update(dt) {
      if (cur) t += dt;
    },
    rectOf(id) {
      if (!cur) return null;
      const g = geo();
      if (id === 'skip') return cur.choice ? null : g.skip;
      if (id === 'keep' || id === 'ngplus') return cur.choice ? g[id] : null;
      return g.box;
    },
    onTap(p) {
      if (!cur) return false;
      if (t < 0.25) return true; // (a tap that closed the last card doesn't run through this one)
      const g = geo();
      if (cur.choice) {
        if (p && hitRect(p, g.keep)) onTap('keep');
        else if (p && hitRect(p, g.ngplus) && cur.choice.ngplus) onTap('ngplus');
        return true;
      }
      onTap(p && hitRect(p, g.skip) ? 'skip' : 'next');
      return true;
    },
    // Back: carry on (never closes the end choice by itself)
    onBack() {
      if (!cur) return false;
      if (!cur.choice) onTap('next');
      return true;
    },
    render(ctx) {
      if (!cur) return;
      const H = height();
      const { box, skip, keep, ngplus } = geo();
      ctx.save();
      ctx.globalAlpha = Math.min(1, t / 0.3);
      ctx.fillStyle = 'rgba(30, 24, 18, 0.62)';
      ctx.fillRect(0, 0, width, H);
      panel(ctx, box, { fill: C.panel, stroke: C.line, radius: 32 });
      const mid = box.x + box.w / 2;
      let y = box.y + 40 + (cur.choice ? 0 : THEME.button.minH);
      const artH = 300;
      if (cur.art && assets) {
        assets.drawContained(ctx, cur.art, { x: mid - artH / 2, y, w: artH, h: artH });
        y += artH + 30;
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = C.text;
      ctx.font = font(S.title, true);
      ctx.fillText(cur.title ?? '', mid, y + 50, box.w - 60);
      y += 100;
      const maxW = box.w - 100;
      for (const l of cur.lines ?? []) {
        const big = typeof l === 'object' && l.big;
        const words = typeof l === 'object' ? l.text : l;
        const size = big ? S.heading : S.body;
        ctx.font = font(size, big);
        ctx.fillStyle = big ? C.actionDark : C.text;
        for (const w of wrapLines(words, maxW, size, big)) {
          ctx.fillText(w, mid, y + size, maxW);
          y += size * 1.35;
        }
        y += 18;
      }
      if (cur.quote) {
        y += 20;
        ctx.font = font(S.heading, false);
        ctx.fillStyle = C.text;
        for (const w of wrapLines(`“${cur.quote}”`, maxW, S.heading, false)) {
          ctx.fillText(w, mid, y + S.heading, maxW);
          y += S.heading * 1.4;
        }
        if (cur.by) {
          ctx.font = font(S.small, true);
          ctx.fillStyle = C.textMuted;
          ctx.fillText(`— ${cur.by}`, mid, y + 40, maxW);
        }
      }
      if (cur.choice) {
        drawButton(ctx, keep, cur.choice.keep);
        if (cur.choice.ngplus) drawButton(ctx, ngplus, cur.choice.ngplus, { accent: C.purple });
      } else {
        drawButton(ctx, skip, ENDING_TEXT.skip, { accent: C.progress });
        ctx.textAlign = 'center';
        ctx.fillStyle = C.textFaint;
        ctx.font = font(S.small, false);
        ctx.fillText(ENDING_TEXT.tapOn, mid, box.y + box.h - 30);
      }
      ctx.restore();
    },
  };
  return api;
}
