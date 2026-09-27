// The home (Milestone 1, bible §4): a small residential home on a hidden 12×16 grid in the 3/4 dollhouse view, floor
// and walls drawn by code (warm cream, sage, timber — a home, not a hospital). Arthur Lane and the run's Founder walk
// their loops (src/systems/homeWorld.js) through the doorways. Drag pans, pinch / wheel zooms (clamped to the home);
// tapping Arthur, the worker, the Nurse Station, the Lounge or Arthur's room opens its bottom sheet; the one temporary
// bottom button opens the Nurse Station's sheet too (the five-button bar is Milestone 5). A long press on empty floor
// enters a placeholder Build Mode (banner + Done). ‹ Menu (or Back) returns to the Main Menu.
// Plan space lives in the world; only drawing and tapping go through the IsoProjection here.
//   createHomeScreen({ renderer, layout, assets, bus, sheet, campaign, openSheet(kind, id), onMenu, debug })
//   enter() builds the world for the open campaign (campaign() → { n, data })
import { THEME, font } from '../../../../core/Theme.js';
import { IsoProjection } from '../../../../core/IsoProjection.js';
import { Camera } from '../../../../core/Camera.js';
import { WorldGestures } from '../../../../core/WorldGestures.js';
import { CachedLayer } from '../../../../core/CachedLayer.js';
import { Selection } from '../../../../core/Selection.js';
import { drawIsoRoom, isoPath, wallPatch } from '../../../../core/IsoRoom.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { text } from '../../../../core/ui/Kit.js';
import { HOME, FLOORS, ART_DRAW, PERSON, HOME_LOOK as L, WALLS } from '../../data/home.js';
import { paletteById } from '../../data/setup.js';
import { createHomeWorld, wallTiles } from '../systems/homeWorld.js';

const C = THEME.color;
const S = THEME.size;
const WALL_T = 0.24; // inside-wall thickness, in tiles

export function createHomeScreen({ renderer, layout, assets, bus, sheet, campaign, openSheet, onMenu, debug = null }) {
  const W = renderer.width;
  const { cols, rows, cellSize: CELL, wallH, innerWallH, margin } = HOME;
  const { halfW: HW, halfH: HH } = HOME.view;
  const iso = new IsoProjection({ tileSize: CELL, halfW: HW, halfH: HH, originX: margin + rows * HW, originY: margin + wallH });
  const worldW = (cols + rows) * HW + margin * 2;
  const worldH = (cols + rows) * HH + wallH + margin * 2;
  const floorLayer = new CachedLayer({ width: worldW, height: worldH, draw: drawFloor });
  const camera = new Camera({ viewW: W, viewH: renderer.height, worldW, worldH });
  camera.minZoom = HOME.zoom.min;
  camera.maxZoom = HOME.zoom.max;

  let world = null;
  let palette = paletteById('sage');
  let slotN = null;
  const walls = wallTiles().map((t) => ({ kind: 'wall', ...t, dir: WALLS.find((w) => w.id === t.wall).dir }));

  // --- where things are drawn (projected world) ----------------------------------------------------------------
  const artRect = (it) => {
    const look = ART_DRAW[it.kind];
    const fp = it.fp;
    const w = (fp.w + fp.h) * HW * look.width;
    const h = w / assets.aspect(it.def.art);
    const cx = iso.corner(fp.col + fp.w / 2, fp.row + fp.h / 2).x;
    const base = iso.corner(fp.col + fp.w, fp.row + fp.h).y + HH * look.drop;
    return { x: cx - w / 2, y: base - h, w, h };
  };
  const feetOf = (p) => {
    const f = iso.toWorld(p.agent.x, p.agent.y);
    return { x: f.x, y: f.y + HH * 0.2 };
  };
  const personRect = (p) => {
    const f = feetOf(p);
    const h = PERSON.height;
    const w = h * assets.aspect(p.art);
    return { x: f.x - w / 2, y: f.y - h, w, h };
  };
  // A person is tapped on their body (the art's transparent margin is left out), a place on its art.
  const tapRect = (it) => {
    if (it.kind === 'resident' || it.kind === 'staff') {
      const r = personRect(it);
      return { x: r.x + r.w * 0.22, y: r.y + r.h * 0.04, w: r.w * 0.56, h: r.h * 0.94 };
    }
    return artRect(it);
  };
  // Draw order: plan x + y (further back first). A walk-in room is part of the floor, so it is always under people.
  const depthOf = (it) => {
    if (it.kind === 'resident' || it.kind === 'staff') return it.agent.x + it.agent.y;
    if (it.kind === 'wall') return (it.col + it.row + 1) * CELL;
    if (it.kind === 'room') return -1;
    return (it.fp.col + it.fp.w / 2 + it.fp.row + it.fp.h / 2) * CELL;
  };
  // People first when they overlap a place (they stand in front of it); among places, the nearest.
  const selection = new Selection(bus, { boundsOf: tapRect, depthOf: (it) => depthOf(it) + (it.kind === 'resident' || it.kind === 'staff' ? 100000 : 0), minHitSize: 90 });

  // --- UI rects (screen) ------------------------------------------------------------------------------------------
  let buildMode = false;
  const menuRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: 230, h: 110 };
  };
  const shortcutRect = () => layout.anchor('bottom', Math.min(layout.safeRect.w - 64, 820), 130, 28);
  const bannerRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: sr.w - 48, h: 190 };
  };
  const doneRect = () => {
    const b = bannerRect();
    return { x: b.x + b.w - 250, y: b.y + (b.h - 120) / 2, w: 226, h: 120 };
  };
  const onUi = (p) => (buildMode ? hitRect(p, bannerRect()) : hitRect(p, menuRect()) || hitRect(p, shortcutRect()));
  const overSheet = (p) => sheet.active && p.y >= sheet.rect().y;

  // The camera sees the space between the top button row and the bottom button, so every edge stays reachable.
  function fitView() {
    const top = menuRect();
    const bottom = shortcutRect();
    camera.viewX = 0;
    camera.viewY = top.y + top.h + 8;
    camera.setView(W, bottom.y - 8 - camera.viewY);
  }
  function resetView() {
    fitView();
    camera.zoom = HOME.zoom.start;
    // Start on the middle of the home: the hall between Arthur's door and the Nurse Station.
    const c = iso.cellCenter(5, 8);
    camera.centerOn(c.x, c.y);
  }

  // --- gestures ------------------------------------------------------------------------------------------------------
  let active = false;
  const gestures = new WorldGestures({ camera, bus, isActive: () => active });
  const taps = []; // recent taps and what they hit (tests / debug)
  const pickAt = (sx, sy) => {
    const w = camera.screenToWorld(sx, sy);
    return selection.pick(w.x, w.y);
  };
  const cellAt = (sx, sy) => {
    const w = camera.screenToWorld(sx, sy);
    const plan = iso.toPlan(w.x, w.y);
    const c = { col: Math.floor(plan.x / CELL), row: Math.floor(plan.y / CELL) };
    return world?.grid.inBounds(c.col, c.row) ? c : null;
  };
  const open = (it) => {
    selection.select(it);
    openSheet(it.kind, it.id);
  };

  const screen = {
    camera,
    iso,
    selection,
    taps,
    get world() {
      return world;
    },
    get buildMode() {
      return buildMode;
    },
    get slot() {
      return slotN;
    },
    rectOf(id) {
      return { menu: menuRect(), shortcut: shortcutRect(), done: doneRect(), banner: bannerRect() }[id] ?? null;
    },
    // Screen point on a person's body or a place's art (tests): the visible middle of what a finger would tap.
    screenPointOf(id) {
      const it = world.byId(id);
      const r = tapRect(it);
      return camera.worldToScreen(r.x + r.w / 2, r.y + r.h * (it.kind === 'room' ? 0.45 : 0.55));
    },
    screenPointOfCell(col, row) {
      const w = iso.cellCenter(col, row);
      return camera.worldToScreen(w.x, w.y);
    },
    cellAt,
    pickAt,

    setBuildMode(on) {
      if (buildMode === on) return;
      buildMode = on;
      if (on) {
        sheet.close();
        selection.clear();
      }
      debug?.log(`Build Mode ${on ? 'on' : 'off'}`);
    },

    enter() {
      active = true;
      const c = campaign();
      if (!c) return;
      const founderId = c.data.facility.founder?.id;
      if (!world || slotN !== c.n || world.founder.id !== founderId) {
        world = createHomeWorld({ founderId });
        for (const it of [...selection.items]) selection.remove(it);
        for (const it of [...world.placed, ...world.people]) selection.add(it);
        slotN = c.n;
        screen.viewSet = false;
      }
      const was = palette;
      palette = paletteById(c.data.facility.palette);
      if (palette !== was) floorLayer.invalidate(); // the doormats are in the facility's colour
      screen.resize();
      if (!screen.viewSet) {
        screen.viewSet = true;
        resetView();
      }
    },
    exit() {
      active = false;
      gestures.reset();
      screen.setBuildMode(false);
      selection.clear();
    },
    resize() {
      camera.pixelScale = renderer.pixelScale;
      floorLayer.setPixelScale(renderer.pixelScale * HOME.zoom.max); // sharp up to full zoom
      const cx = camera.x + camera.visibleW / 2;
      const cy = camera.y + camera.visibleH / 2;
      fitView();
      camera.centerOn(cx, cy);
    },
    update(dt) {
      world?.update(dt);
    },
    onBack() {
      if (buildMode) screen.setBuildMode(false);
      else onMenu();
      return true;
    },

    onDown(p) {
      if (overSheet(p) || onUi(p)) return; // the buttons, the banner and the sheet never pan or pinch the home
      gestures.down(p);
    },
    onUp(p) {
      gestures.up(p);
    },
    onDragStart(p) {
      gestures.dragStart(p);
    },
    onDrag(p) {
      gestures.drag(p);
    },
    onDragEnd(p) {
      gestures.dragEnd(p);
    },
    onWheel(p) {
      gestures.wheel(p);
    },
    onTap(p) {
      if (!world || gestures.multiTouch) return;
      if (buildMode) {
        if (hitRect(p, doneRect())) screen.setBuildMode(false);
        taps.push({ x: p.x, y: p.y, picked: null, build: true });
        return;
      }
      if (hitRect(p, menuRect())) return void onMenu();
      if (hitRect(p, shortcutRect())) {
        open(world.byId('F01'));
        taps.push({ x: p.x, y: p.y, picked: 'shortcut' });
        return;
      }
      const picked = pickAt(p.x, p.y);
      if (picked) open(picked);
      else selection.clear();
      taps.push({ x: p.x, y: p.y, picked: picked?.id ?? null });
      if (taps.length > 50) taps.shift();
    },
    // Long press on empty floor → Build Mode. On a person or a place it opens their sheet, like a tap.
    onHold(p) {
      if (!world || gestures.multiTouch || gestures.fingers > 1 || buildMode || onUi(p) || overSheet(p)) return;
      const picked = pickAt(p.x, p.y);
      if (picked) open(picked);
      else if (cellAt(p.x, p.y)) screen.setBuildMode(true);
    },

    render(ctx) {
      if (!world) return;
      ctx.fillStyle = palette.light;
      ctx.fillRect(0, 0, W, renderer.height);
      camera.apply(ctx);
      floorLayer.render(ctx, 0, 0);
      assets.detail = HOME.zoom.max; // sprites cached at full-zoom size, so they stay sharp when zoomed in
      for (const it of world.placed) if (it.kind === 'room') assets.draw(ctx, it.def.art, ...rectArgs(artRect(it)));
      if (buildMode) drawBuildFloor(ctx);
      drawSelectionMark(ctx);
      const items = [...world.placed.filter((p) => p.kind !== 'room'), ...walls, ...world.people].sort((a, b) => depthOf(a) - depthOf(b));
      for (const it of items) {
        if (it.kind === 'wall') drawWall(ctx, it);
        else if (it.kind === 'station') assets.draw(ctx, it.def.art, ...rectArgs(artRect(it)));
        else assets.draw(ctx, it.art, ...rectArgs(personRect(it)));
      }
      assets.detail = 1;
      camera.restore(ctx);
      // Name tags in screen space: always the small text size (28), whatever the zoom.
      for (const p of world.people) drawTag(ctx, p);
      if (buildMode) drawBanner(ctx);
      else {
        drawButton(ctx, menuRect(), '‹ Menu', { accent: C.progress });
        drawFacilityName(ctx);
        drawButton(ctx, shortcutRect(), 'Nurse Station', { accent: C.action });
      }
    },
  };

  const rectArgs = (r) => [r.x, r.y, r.w, r.h];

  // --- drawing ---------------------------------------------------------------------------------------------------
  function patch(g, pts, fill, stroke = null, lw = 2) {
    isoPath(g, pts);
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = lw;
      g.stroke();
    }
  }
  // Floor and the two outer walls (core/IsoRoom), the timber room floor, the lounge carpet, windows and doormats —
  // drawn once into the cached layer.
  function drawFloor(g) {
    drawIsoRoom(g, iso, { cols, rows, wallH, look: L, bands: [{ from: 0, to: 0.07, color: L.skirting }, { from: 0.36, to: 0.39, color: L.rail }] });
    g.lineJoin = 'round';
    for (const f of FLOORS) {
      const look = L.floors[f.look];
      if (!look) continue;
      for (let c = f.col; c < f.col + f.w; c++) {
        for (let r = f.row; r < f.row + f.h; r++) patch(g, iso.outline(c, r, 1, 1), (c + r) % 2 ? look.a : look.b, look.line, 1);
      }
    }
    // The foot of both outer walls in soft shade.
    patch(g, [iso.corner(0, 0), iso.corner(cols, 0), iso.corner(cols, 0.3), iso.corner(0.3, 0.3)], L.shadow);
    patch(g, [iso.corner(0, 0), iso.corner(0.3, 0.3), iso.corner(0.3, rows), iso.corner(0, rows)], L.shadow);
    // Windows: two on the hall's back wall, two on the lounge's side wall.
    for (const [side, t0, t1] of [['right', 7, 8.6], ['right', 9.6, 11.2], ['left', 11.6, 13.2], ['left', 7, 8.6]]) {
      patch(g, wallPatch(iso, side, t0, t1, 70, 185), L.window.frame, L.wallCap, 3);
      patch(g, wallPatch(iso, side, t0 + 0.12, t1 - 0.12, 80, 175), L.window.glass, L.wallLine, 1.5);
      patch(g, wallPatch(iso, side, t0 + 0.3, t0 + 0.55, 95, 165), L.window.shine);
    }
    // A doormat in every doorway.
    for (const w of WALLS) {
      for (const i of w.gaps) {
        const c = w.dir === 'row' ? w.col + i : w.col;
        const r = w.dir === 'row' ? w.row : w.row + i;
        patch(g, iso.outline(c + 0.12, r + 0.12, 0.76, 0.76), palette.hex, L.wallCap, 2);
      }
    }
  }
  // An inside wall: a low slab through the middle of its tile (two front faces and the top).
  function drawWall(ctx, t) {
    const h = innerWallH;
    const [x0, x1, y0, y1] = t.dir === 'row' ? [t.col, t.col + 1, t.row + 0.5 - WALL_T / 2, t.row + 0.5 + WALL_T / 2] : [t.col + 0.5 - WALL_T / 2, t.col + 0.5 + WALL_T / 2, t.row, t.row + 1];
    const P = (c, r, up = 0) => {
      const p = iso.corner(c, r);
      return { x: p.x, y: p.y - up };
    };
    const face = (pts, fill) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = L.innerWall.line;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    };
    ctx.save();
    ctx.lineJoin = 'round';
    face([P(x0, y1), P(x1, y1), P(x1, y1, h), P(x0, y1, h)], L.innerWall.front); // the face towards the lower left
    face([P(x1, y0), P(x1, y1), P(x1, y1, h), P(x1, y0, h)], L.innerWall.side); // the face towards the lower right
    face([P(x0, y0, h), P(x1, y0, h), P(x1, y1, h), P(x0, y1, h)], L.innerWall.top);
    ctx.restore();
  }
  function drawSelectionMark(ctx) {
    const it = selection.selected;
    if (!it) return;
    ctx.save();
    ctx.strokeStyle = C.progress;
    ctx.lineWidth = 6;
    if (it.kind === 'resident' || it.kind === 'staff') {
      const f = feetOf(it);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, HW * 0.55, HH * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      isoPath(ctx, iso.outline(it.fp.col, it.fp.row, it.fp.w, it.fp.h));
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawBuildFloor(ctx) {
    ctx.save();
    ctx.lineWidth = 1.5;
    world.grid.forEachTile((c, r) => {
      if (world.grid.isBlocked(c, r)) return;
      isoPath(ctx, iso.outline(c, r, 1, 1));
      ctx.fillStyle = L.buildTint;
      ctx.fill();
      ctx.strokeStyle = L.buildLine;
      ctx.stroke();
    });
    ctx.restore();
  }
  function drawTag(ctx, p) {
    const r = personRect(p);
    const s = camera.worldToScreen(r.x + r.w / 2, r.y + r.h * 0.02);
    if (s.y < camera.viewY || s.y > camera.viewY + camera.viewH) return;
    const label = p.name.split(' ')[0];
    ctx.save();
    ctx.font = font(PERSON.tagSize, true);
    const w = ctx.measureText(label).width + 36;
    const h = 48;
    const x = s.x - w / 2;
    const y = s.y - h - 6;
    ctx.fillStyle = p.kind === 'resident' ? '#FFFFFF' : palette.hex;
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.kind === 'resident' ? C.text : '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, s.x, y + h / 2 + 1);
    ctx.restore();
  }
  function drawFacilityName(ctx) {
    const m = menuRect();
    const sr = layout.safeRect;
    const x = m.x + m.w + 24;
    const w = sr.x + sr.w - 24 - x;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 250, 240, 0.92)';
    ctx.strokeStyle = palette.hex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x, m.y, w, m.h, 24);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const f = campaign()?.data.facility;
    text(ctx, f?.name ?? '', x + w / 2, m.y + 32, { size: S.body, bold: true, color: palette.dark, align: 'center', baseline: 'middle', maxWidth: w - 30 });
    text(ctx, `Facility Director ${f?.director ?? ''}`, x + w / 2, m.y + 78, { size: S.small, color: C.textMuted, align: 'center', baseline: 'middle', maxWidth: w - 30 });
  }
  function drawBanner(ctx) {
    const b = bannerRect();
    ctx.save();
    ctx.fillStyle = C.chip;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, THEME.panel.radius);
    ctx.fill();
    ctx.restore();
    const tw = doneRect().x - b.x - 60;
    text(ctx, 'Build Mode', b.x + 36, b.y + 62, { size: S.title, bold: true, color: C.textOnDark, baseline: 'middle', maxWidth: tw });
    text(ctx, 'Nothing to build yet. Tap Done to leave.', b.x + 36, b.y + 132, { size: S.small, color: C.textOnDark, baseline: 'middle', maxWidth: tw });
    drawButton(ctx, doneRect(), 'Done', { accent: C.good });
  }

  return screen;
}
