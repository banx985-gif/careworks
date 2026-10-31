// The ceremony card (Milestone 32b): the four inspectors revealed one at a time — a name badge drawn in code (their chibi
// figures come with the series sprite sheets), a score out of 10 and a short plain comment — then the total out of 40 and
// the result (a grade, a place, an accreditation). One tap skips to the result; the next tap closes it. It takes every
// tap while it is up and the home's clock waits (like the memorial moment), so it never sits under another beat.
//
//   const ceremony = createCeremony({ width, height: () => H, assets, onOpen, onClose })
//   ceremony.show(c) · ceremony.active · ceremony.update(dt) · ceremony.render(ctx) · ceremony.onTap()
//   ceremony.revealed → how many inspectors are showing · ceremony.done → the result is showing · ceremony.current
// Milestone 33 (the Year-16 ending grade): a panel row may carry its own `max` (points out of that, not 10) and `comment`;
// `grade: { letter, color }` shows the grade letter in its circle in place of a place tier.
import { THEME, font } from '../../../../core/Theme.js';
import { panel, wrapLines } from '../../../../core/ui/Kit.js';
import { INSPECTORS, inspectorById, commentOf, tierById, VERDICT_TEXT, PANEL_MAX } from '../../data/verdicts.js';

const C = THEME.color;
const S = THEME.size;
const START = 0.6; // the first inspector after the card arrives (real seconds)
const EACH = 1.0; // then one every second
const SCORE_AFTER = 0.45; // the score a moment after the name

const initials = (name) => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function createCeremony({ width = 1080, height = () => 1920, assets = null, onOpen = null, onClose = null }) {
  let cur = null;
  let t = 0;
  const doneAt = () => START + (cur?.panel?.length ?? 4) * EACH + 0.2;
  const api = {
    get active() {
      return !!cur;
    },
    get current() {
      return cur;
    },
    get revealed() {
      if (!cur) return 0;
      return Math.max(0, Math.min(cur.panel.length, Math.floor((t - START) / EACH) + 1));
    },
    get done() {
      return !!cur && t >= doneAt();
    },
    show(c) {
      if (!c) return false;
      cur = { ...c, panel: c.panel?.length ? c.panel : INSPECTORS.map((i) => ({ id: i.id, score: 0 })) };
      t = 0;
      onOpen?.(cur);
      return true;
    },
    update(dt) {
      if (cur) t += dt;
    },
    onTap() {
      if (!cur) return false;
      if (t < doneAt()) t = doneAt(); // one tap skips to the result
      else {
        const was = cur;
        cur = null;
        onClose?.(was);
      }
      return true;
    },
    render(ctx) {
      if (!cur) return;
      const H = height();
      const W = width;
      const appear = Math.min(1, t / 0.3);
      ctx.save();
      ctx.globalAlpha = appear;
      ctx.fillStyle = 'rgba(30, 24, 18, 0.62)';
      ctx.fillRect(0, 0, W, H);
      const cardW = Math.min(W - 64, 980);
      const x = (W - cardW) / 2;
      const rowH = 196;
      const cardH = 250 + cur.panel.length * rowH + 480;
      const y = Math.max(40, (H - cardH) / 2);
      panel(ctx, { x, y, w: cardW, h: cardH }, { fill: C.panel, stroke: C.line, radius: 32 });
      // the title and its picture
      const artH = 130;
      if (cur.art && assets) assets.drawContained(ctx, cur.art, { x: x + cardW / 2 - artH / 2, y: y + 24, w: artH, h: artH });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = C.text;
      ctx.font = font(S.heading, true);
      ctx.fillText(cur.title, x + cardW / 2, y + 24 + artH + 56, cardW - 60);
      if (cur.host) {
        ctx.font = font(S.small, false);
        ctx.fillStyle = C.textMuted;
        ctx.fillText(cur.host, x + cardW / 2, y + 24 + artH + 96, cardW - 60);
      }
      // the four inspectors, one at a time
      let ry = y + 250;
      cur.panel.forEach((p, i) => {
        const at = START + i * EACH;
        const k = Math.max(0, Math.min(1, (t - at) / 0.3));
        if (k <= 0) {
          ry += rowH;
          return;
        }
        const ins = inspectorById(p.id);
        ctx.save();
        ctx.globalAlpha = appear * k;
        const cx = x + 40 + 58;
        const cy = ry + 70;
        // the name badge (drawn in code)
        ctx.beginPath();
        ctx.arc(cx, cy, 58, 0, Math.PI * 2);
        ctx.fillStyle = ins?.color ?? C.progress;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.font = font(S.heading, true);
        ctx.fillText(initials(ins?.name ?? '?'), cx, cy + 16);
        ctx.textAlign = 'left';
        ctx.fillStyle = C.text;
        ctx.font = font(S.button, true);
        const tx = cx + 80;
        ctx.fillText(ins?.name ?? p.id, tx, ry + 52, cardW - 330);
        ctx.font = font(S.small, false);
        ctx.fillStyle = C.textMuted;
        ctx.fillText(ins?.role ?? '', tx, ry + 92, cardW - 330);
        // the score, a moment later, with the comment
        if (t >= at + SCORE_AFTER || api.done) {
          ctx.textAlign = 'right';
          const share = p.score / (p.max ?? PANEL_MAX);
          ctx.fillStyle = share >= 0.8 ? C.good : share >= 0.5 ? C.actionDark : C.bad;
          ctx.font = font(S.title, true);
          ctx.fillText(`${p.score}`, x + cardW - (p.max >= 100 ? 140 : 110), ry + 78);
          ctx.font = font(S.body, false);
          ctx.fillStyle = C.textMuted;
          ctx.fillText(`/ ${p.max ?? PANEL_MAX}`, x + cardW - 40, ry + 78);
          ctx.textAlign = 'left';
          ctx.fillStyle = C.text;
          ctx.font = font(S.small, false);
          const lines = wrapLines(`“${p.comment ?? commentOf(p.id, p.score)}”`, cardW - (tx - x) - 40, S.small, false).slice(0, 2);
          lines.forEach((l, j) => ctx.fillText(l, tx, ry + 134 + j * 36, cardW - (tx - x) - 40));
        }
        ctx.restore();
        ry += rowH;
      });
      // the result
      if (api.done) {
        const tier = cur.tier ? tierById(cur.tier) : null;
        const mid = x + cardW / 2;
        let yy = ry + 40;
        ctx.textAlign = 'center';
        ctx.fillStyle = C.text;
        ctx.font = font(S.title, true);
        ctx.fillText(`${cur.total} / ${cur.max ?? 40}`, mid, yy + 40);
        yy += 70;
        if (cur.grade) {
          ctx.beginPath();
          ctx.arc(mid, yy + 52, 52, 0, Math.PI * 2);
          ctx.fillStyle = cur.grade.color;
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = C.outline;
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = font(S.title, true);
          ctx.fillText(cur.grade.letter, mid, yy + 52 + 22);
          yy += 118;
        } else if (tier) {
          ctx.beginPath();
          ctx.arc(mid, yy + 44, 40, 0, Math.PI * 2);
          ctx.fillStyle = tier.color;
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = C.outline;
          ctx.stroke();
          yy += 100;
        }
        ctx.fillStyle = tier ? C.gold : C.actionDark;
        ctx.font = font(S.heading, true);
        ctx.fillText(cur.headline ?? '', mid, yy + 34, cardW - 60);
        yy += 50;
        ctx.fillStyle = C.textMuted;
        ctx.font = font(S.small, false);
        for (const l of (cur.lines ?? []).slice(0, 3)) {
          yy += 38;
          ctx.fillText(l, mid, yy, cardW - 60);
        }
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = C.textFaint;
      ctx.font = font(S.small, false);
      ctx.fillText(api.done ? VERDICT_TEXT.close : VERDICT_TEXT.skip, x + cardW / 2, y + cardH - 30);
      ctx.restore();
    },
  };
  return api;
}
