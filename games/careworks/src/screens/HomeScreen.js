// The placeholder "home" (Milestone 0): the facility name on its sign in the chosen palette, the Facility Director
// and the Founder. The real home scene (the place, top bar, bottom bar) arrives in Milestone 1.
import { THEME, font } from '../../../../core/Theme.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { card, text } from '../../../../core/ui/Kit.js';
import { founderById, paletteById, ROLES } from '../../data/setup.js';
import { drawPortrait, drawSign } from '../ui/careArt.js';

const C = THEME.color;
const S = THEME.size;

// campaign(): { n, data } of the open slot.
export function createHomeScreen({ layout, assets, campaign, onMenu }) {
  const menuRect = () => layout.anchor('bottom', Math.min(layout.safeRect.w - 120, 820), 130, 60);
  return {
    onTap(p) {
      if (hitRect(p, menuRect())) onMenu();
    },
    onBack() {
      onMenu();
      return true;
    },
    render(ctx) {
      const c = campaign();
      if (!c) return;
      const f = c.data.facility;
      const palette = paletteById(f.palette);
      const founder = founderById(f.founder.id);
      const sr = layout.safeRect;
      const cx = sr.x + sr.w / 2;
      // the palette's soft wash behind everything
      ctx.fillStyle = palette.light;
      ctx.fillRect(sr.x, sr.y, sr.w, sr.h);
      let y = sr.y + Math.max(60, sr.h * 0.08);
      text(ctx, `Campaign slot ${c.n} · Year ${c.data.date.year}, Month ${c.data.date.month}`, cx, y, { size: S.small, bold: true, color: palette.dark, align: 'center' });
      y += 70;
      const sw = Math.min(sr.w - 120, 880);
      drawSign(ctx, assets, { x: cx - sw / 2, y, w: sw, h: 360 }, f.name, palette, `Facility Director ${f.director}`);
      y += 360 + 50;
      ctx.save();
      ctx.font = font(S.major, true);
      ctx.fillStyle = palette.dark;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(f.name, cx, y, sr.w - 80);
      ctx.restore();
      y += 100;
      const r = { x: cx - sw / 2, y, w: sw, h: 260 };
      card(ctx, r, 'normal');
      drawPortrait(ctx, { x: r.x + 30, y: r.y + 30, w: 200, h: 200 }, founder, palette.hex);
      text(ctx, 'Founding Staff', r.x + 260, r.y + 40, { size: S.small, color: C.textMuted });
      text(ctx, founder?.name ?? '', r.x + 260, r.y + 84, { size: S.heading, bold: true, maxWidth: r.w - 290 });
      text(ctx, founder ? ROLES[founder.role].name : '', r.x + 260, r.y + 146, { size: S.body, maxWidth: r.w - 290 });
      text(ctx, founder?.perk.name ?? '', r.x + 260, r.y + 196, { size: S.small, bold: true, color: C.purple, maxWidth: r.w - 290 });
      y += 260 + 40;
      text(ctx, 'Your home opens in the next build (Milestone 1).', cx, y, { size: S.body, color: C.textMuted, align: 'center', maxWidth: sr.w - 80 });
      drawButton(ctx, menuRect(), 'Main Menu', { accent: C.progress });
    },
    rectOf(id) {
      return id === 'menu' ? menuRect() : null;
    },
  };
}
