// The first-week guide on screen (Milestone 34): a soft glow round the button to tap and one line from Rosie — under
// the date in the home (where the next-step hint line sits), or just above an open sheet. Nothing is dimmed and no tap
// is blocked: the glow is only a ring, and the line is the size of a hint.
//   const mark = createGuideMark({ renderer })
//   mark.render(ctx, { target, text, lineRect })   target: the screen rect to glow round (or null) · lineRect: where the
//                                                  line goes · mark.lineRect (the last one drawn, for taps) · mark.update(dt)
import { THEME, font } from '../../../../core/Theme.js';

const C = THEME.color;
const S = THEME.size;

export function createGuideMark() {
  let t = 0;
  let last = null;
  return {
    get lineRect() {
      return last;
    },
    update(dt) {
      t += dt;
    },
    hide() {
      last = null;
    },
    render(ctx, { target = null, text = '', lineRect = null } = {}) {
      last = null;
      if (target) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
        const pad = 10;
        ctx.save();
        ctx.strokeStyle = `rgba(255,183,77,${0.3 + 0.35 * pulse})`;
        ctx.lineWidth = 10 + pulse * 8;
        ring(ctx, target, pad);
        ctx.strokeStyle = C.action;
        ctx.lineWidth = 5;
        ring(ctx, target, pad);
        ctx.restore();
      }
      if (lineRect && text) {
        const r = lineRect;
        ctx.save();
        ctx.fillStyle = C.panelGold ?? C.panel;
        ctx.strokeStyle = C.action;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = C.text;
        ctx.font = font(S.small, true);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`→ ${text}`, r.x + 24, r.y + r.h / 2, r.w - 48);
        ctx.restore();
        last = r;
      }
    },
  };
}

function ring(ctx, r, pad) {
  ctx.beginPath();
  ctx.roundRect(r.x - pad, r.y - pad, r.w + pad * 2, r.h + pad * 2, 22);
  ctx.stroke();
}
