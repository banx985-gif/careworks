// The home (Milestone 1, bible §4): a small residential home on a hidden 12×16 grid in the 3/4 dollhouse view, floor
// and walls drawn by code (warm cream, sage, timber — a home, not a hospital). Arthur Lane and the team walk their day
// (src/systems/homeWorld.js) through the doorways. Drag pans, pinch / wheel zooms (clamped to the home); tapping a
// person or a place opens its bottom sheet. A long press on empty floor enters a placeholder Build Mode (banner + Done).
// Back returns to the Main Menu.
// Milestone 2: the game clock; the home dims a little at night. Milestone 4: a small code-drawn marker over each
// helper's head (one shape per task type, no text) and the ringing call bell over Arthur (src/ui/taskMarkers.js).
// Milestone 5 (first art / phone feel): the shared series bars (core/ui TopBar and BottomBar, made in main) replace the
// Milestone 1–4 menu button, clock row and shortcut; a slim line under the top bar gives the time, band and facility.
// Every placed thing in its art at one scale (the Dining Room and Staff Room join), the five early props (decoration:
// never tapped, never on a walkway), a hall runner and timber back hall, wainscot on the walls, soft daylight from the
// windows and soft floor shadows under furniture and people. People hop and sway as they walk (one hop per stride
// walked: no sliding), lean gently while helping, breathe while standing or resting; a status icon over staff (their
// task, resting, or tired). Care pops (src/ui/carePops.js) draw here through core/VfxSystem's 'world' layer; the
// end-of-day beat under the time line.
// Plan space lives in the world; only drawing and tapping go through the IsoProjection here.
//   createHomeScreen({ renderer, layout, assets, bus, sheet, campaign, world, openSheet(kind, id), onMenu, topBar,
//                      bottomBar, vfx, dayBeat, debug })
//   campaign() → { n, data } of the open slot · world() → its home world (main makes one per opened campaign)
import { THEME, font } from '../../../../core/Theme.js';
import { IsoProjection } from '../../../../core/IsoProjection.js';
import { Camera } from '../../../../core/Camera.js';
import { WorldGestures } from '../../../../core/WorldGestures.js';
import { CachedLayer } from '../../../../core/CachedLayer.js';
import { Selection } from '../../../../core/Selection.js';
import { drawIsoRoom, isoPath, wallPatch } from '../../../../core/IsoRoom.js';
import { characterPose, drawCharacter } from '../../../../core/CharacterMotion.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { text } from '../../../../core/ui/Kit.js';
import { HOME, FLOORS, ART_DRAW, PERSON, MOTION, WINDOWS, HOME_LOOK as L, WALLS } from '../../data/home.js';
import { paletteById } from '../../data/setup.js';
import { wallTiles } from '../systems/homeWorld.js';
import { bandAt, clockText } from '../systems/residentNeeds.js';
import { TASK_TYPES } from '../../data/tasks.js';
import { drawTaskMarker, drawBellMarker } from '../ui/taskMarkers.js';

const C = THEME.color;
const S = THEME.size;
const WALL_T = 0.24; // inside-wall thickness, in tiles
// Sprite detail steps: the smallest step at or above the camera zoom. Drawn about 1:1 at any zoom (so frames stay cheap
// on big screens — caching at full zoom and shrinking every frame cost ~20 ms a frame on a tablet) with only a few
// cached sizes per picture, remade once when a pinch crosses a step.
const DETAIL_STEPS = [0.5, 0.7, 1.0, 1.4];
const detailFor = (zoom) => DETAIL_STEPS.find((d) => d >= zoom - 1e-3) ?? DETAIL_STEPS[DETAIL_STEPS.length - 1];
const isPerson = (it) => it.kind === 'resident' || it.kind === 'staff';

export function createHomeScreen({ renderer, layout, assets, bus, sheet, campaign, world: getWorld, openSheet, onMenu, topBar, bottomBar, vfx = null, dayBeat = null, debug = null }) {
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
  // Every placed picture at one scale: its width follows its footprint (ART_DRAW), so a 3×3 facility and a 1×1 prop
  // match the grid the same way.
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
    if (isPerson(it)) {
      const r = personRect(it);
      return { x: r.x + r.w * 0.22, y: r.y + r.h * 0.04, w: r.w * 0.56, h: r.h * 0.94 };
    }
    return artRect(it);
  };
  // Draw order: plan x + y (further back first). A walk-in room is part of the floor, so it is always under people.
  const depthOf = (it) => {
    if (isPerson(it)) return it.agent.x + it.agent.y;
    if (it.kind === 'wall') return (it.col + it.row + 1) * CELL;
    if (it.kind === 'room') return -1;
    return (it.fp.col + it.fp.w / 2 + it.fp.row + it.fp.h / 2) * CELL;
  };
  // People first when they overlap a place (they stand in front of it); among places, the nearest.
  const selection = new Selection(bus, { boundsOf: tapRect, depthOf: (it) => depthOf(it) + (isPerson(it) ? 100000 : 0), minHitSize: 90 });

  // --- UI rects (screen) ------------------------------------------------------------------------------------------
  let buildMode = false;
  const bannerRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: sr.w - 48, h: 190 };
  };
  const doneRect = () => {
    const b = bannerRect();
    return { x: b.x + b.w - 250, y: b.y + (b.h - 120) / 2, w: 226, h: 120 };
  };
  // The time line under the top bar: "08:20 · Morning peak" and the facility's name.
  const infoRect = () => {
    const t = topBar.rect();
    return { x: t.x + 8, y: t.y + t.h + 10, w: t.w - 16, h: 64 };
  };
  const onUi = (p) => (buildMode ? hitRect(p, bannerRect()) : topBar.contains(p) || bottomBar.contains(p));
  const overSheet = (p) => sheet.active && p.y >= sheet.rect().y;

  // The camera sees the space between the time line and the bottom bar: the bars never cover the home's edges.
  function fitView() {
    const top = infoRect();
    const bottom = bottomBar.rect();
    camera.viewX = 0;
    camera.viewY = top.y + top.h + 6;
    camera.setView(W, bottom.y - 8 - camera.viewY);
  }
  function resetView() {
    fitView();
    camera.zoom = HOME.zoom.start;
    // Start on the middle of the home: the hall between Arthur's door, the Nurse Station and the Dining Room.
    const c = iso.cellCenter(7, 5);
    camera.centerOn(c.x, c.y);
  }

  // --- how each person moves (Milestone 5) -----------------------------------------------------------------------
  // stride: plan distance walked (the walking clock, so hops keep pace with the feet at any speed); flip: the way they
  // face on screen.
  const motion = new Map(); // id → { x, y, stride, flip, seed }
  const pose = { bob: 0, tilt: 0, flip: 1 };
  const poseAgent = { state: 'idle', facing: 1 };
  let animT = 0; // the breathe / help clock (stops while the game is paused)
  const motionOf = (p) => {
    let m = motion.get(p.id);
    if (!m) {
      m = { x: p.agent.x, y: p.agent.y, stride: 0, flip: 1, seed: motion.size * 1.7 + 0.4 };
      motion.set(p.id, m);
    }
    return m;
  };
  function updateMotion(dt) {
    if (!world) return;
    if (!world.clock.paused) animT += dt;
    for (const p of world.people) {
      const m = motionOf(p);
      const dx = p.agent.x - m.x;
      const dy = p.agent.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d > CELL * 3) m.stride = 0; // placed, not walked (a load, the stuck fallback)
      else m.stride += d;
      const sx = dx - dy; // plan → screen: x grows with col, shrinks with row
      if (Math.abs(sx) > 0.5) m.flip = sx > 0 ? 1 : -1;
      m.x = p.agent.x;
      m.y = p.agent.y;
    }
  }
  // What their body is doing: walking, helping (a task under way), or still (standing, resting, sitting, asleep).
  function stateOf(p) {
    if (p.agent.state === 'walking') return 'walking';
    if (p.kind === 'staff' && p.mode === 'helping' && world.taskOf(p)?.status === 'working') return 'working';
    return 'idle';
  }

  // --- gestures ------------------------------------------------------------------------------------------------------
  let active = false;
  const gestures = new WorldGestures({ camera, bus, isActive: () => active });
  const taps = []; // recent taps and what they hit (tests / debug)
  // People first; when several people overlap under the finger (a helper standing right beside Arthur), the one whose
  // body is nearest the finger — not simply the one drawn in front — so each of them can still be tapped.
  const pickAt = (sx, sy) => {
    const w = camera.screenToWorld(sx, sy);
    const hit = (r) => w.x >= r.x && w.x <= r.x + r.w && w.y >= r.y && w.y <= r.y + r.h;
    const people = (world?.people ?? []).filter((p) => hit(tapRect(p)));
    if (people.length > 1) {
      const dist = (p) => {
        const r = tapRect(p);
        return Math.abs(w.x - (r.x + r.w / 2)) + Math.abs(w.y - (r.y + r.h / 2)) * 0.35;
      };
      return people.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    }
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
    motion,
    get world() {
      return world;
    },
    get buildMode() {
      return buildMode;
    },
    get slot() {
      return slotN;
    },
    // Tests / the guide: a bar button ('pause', 'speed1', 'inbox', 'help', a bottom slot id), 'done', 'banner', 'info'.
    rectOf(id) {
      const b = topBar.buttons().find((x) => x.id === id);
      if (b) return b.rect;
      if (id === 'inbox') return topBar.inboxRect();
      if (id === 'help') return topBar.helpRect();
      if (id === 'stats') return topBar.statsRect();
      const slot = bottomBar.buttonRect(id);
      if (slot) return slot;
      return { done: doneRect(), banner: bannerRect(), info: infoRect() }[id] ?? null;
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
    // A plan point lifted off the floor, in world px (the care pops).
    worldPointOf(x, y, lift = 0) {
      const w = iso.toWorld(x, y);
      return { x: w.x, y: w.y - lift };
    },
    // On screen inside the home's view (tests).
    inView(sx, sy) {
      return sx >= 0 && sx <= W && sy >= camera.viewY && sy <= camera.viewY + camera.viewH;
    },
    // Screen rect of a placed thing's or a prop's art (tests).
    artScreenRect(it) {
      const r = artRect(it);
      const a = camera.worldToScreen(r.x, r.y);
      const b = camera.worldToScreen(r.x + r.w, r.y + r.h);
      return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
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
      const w = getWorld();
      if (w && w !== world) {
        const sameSlot = slotN === c.n;
        world = w;
        motion.clear();
        for (const it of [...selection.items]) selection.remove(it);
        for (const it of [...world.placed, ...world.people]) selection.add(it); // (props are decoration: never picked)
        slotN = c.n;
        if (!sameSlot) screen.viewSet = false; // the same slot reopened keeps its view
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
      vfx?.clear();
    },
    resize() {
      camera.pixelScale = renderer.pixelScale;
      floorLayer.setPixelScale(renderer.pixelScale * detailFor(camera.zoom)); // near the drawn size (see render)
      const cx = camera.x + camera.visibleW / 2;
      const cy = camera.y + camera.visibleH / 2;
      fitView();
      camera.centerOn(cx, cy);
    },
    update(dt) {
      world?.update(dt);
      updateMotion(dt);
    },
    onBack() {
      if (buildMode) screen.setBuildMode(false);
      else onMenu();
      return true;
    },

    onDown(p) {
      if (overSheet(p) || onUi(p)) return; // the bars, the banner and the sheet never pan or pinch the home
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
      if (topBar.handleTap(p)) {
        taps.push({ x: p.x, y: p.y, picked: 'topBar' });
        return;
      }
      if (bottomBar.handleTap(p)) {
        taps.push({ x: p.x, y: p.y, picked: 'bottomBar' });
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
      // The floor picture is kept near the size it is drawn (remade once when a pinch crosses a detail step), and only its
      // visible part is drawn: the whole picture every frame held a tablet to ~33 fps.
      floorLayer.setPixelScale(renderer.pixelScale * detailFor(camera.zoom));
      floorLayer.renderView(ctx, { x: camera.x, y: camera.y, w: camera.visibleW, h: camera.visibleH }); // only what is on screen
      assets.detail = detailFor(camera.zoom); // sprites cached near the size they are drawn: sharp, and a plain copy each frame
      for (const it of world.placed) if (it.kind === 'room') assets.draw(ctx, it.def.art, ...rectArgs(artRect(it)));
      if (buildMode) drawBuildFloor(ctx);
      drawPersonShadows(ctx);
      drawSelectionMark(ctx);
      const items = [...world.placed.filter((p) => p.kind !== 'room'), ...world.props, ...walls, ...world.people].sort((a, b) => depthOf(a) - depthOf(b));
      for (const it of items) {
        if (it.kind === 'wall') drawWall(ctx, it);
        else if (it.kind === 'station') assets.draw(ctx, it.def.art, ...rectArgs(artRect(it)));
        else if (it.kind === 'prop') drawProp(ctx, it);
        else drawPerson(ctx, it);
      }
      assets.detail = 1;
      camera.restore(ctx);
      drawNight(ctx);
      // Name tags in screen space: always the small text size (28), whatever the zoom.
      layoutTags(ctx);
      for (const p of world.people) drawTag(ctx, p);
      drawMarkers(ctx); // a status icon over each staff member (their task, resting, tired); the call bell over Arthur
      // The care pops, in the world but over the tags for their second or two (so a name never hides one).
      if (vfx) {
        camera.apply(ctx);
        vfx.render(ctx, 'world');
        camera.restore(ctx);
      }
      if (buildMode) drawBanner(ctx);
      else {
        drawInfo(ctx);
        dayBeat?.render(ctx, infoRect().x + 20, infoRect().y + infoRect().h + 14, infoRect().w - 40);
        topBar.render(ctx);
        bottomBar.render(ctx);
      }
    },
  };

  const rectArgs = (r) => [r.x, r.y, r.w, r.h];

  // The time line (Milestone 5): "08:20 · Morning peak" (with "Paused" while paused) and the facility's name, on a slim
  // cream strip under the top bar.
  function drawInfo(ctx) {
    const clock = world.clock;
    const r = infoRect();
    ctx.save();
    ctx.fillStyle = 'rgba(255, 250, 240, 0.94)';
    ctx.strokeStyle = palette.hex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const band = bandAt(world.hour);
    const time = `${clockText(world.hour)} · ${band.name}`;
    const left = clock.paused ? `Paused · ${time}` : time;
    text(ctx, left, r.x + 30, r.y + r.h / 2, { size: S.small, bold: true, color: clock.paused ? C.actionDark : C.text, baseline: 'middle', maxWidth: r.w * 0.6 });
    const f = campaign()?.data.facility;
    text(ctx, f?.name ?? '', r.x + r.w - 30, r.y + r.h / 2, { size: S.small, bold: true, color: palette.dark, align: 'right', baseline: 'middle', maxWidth: r.w * 0.36 });
  }
  // Night: the home dims a little (a soft blue veil over the world, not the bars).
  function drawNight(ctx) {
    const h = world.hour;
    const dark = h >= 21 || h < 5 ? 1 : h >= 19.5 ? (h - 19.5) / 1.5 : h < 6.5 ? 1 - (h - 5) / 1.5 : 0;
    if (dark <= 0) return;
    ctx.save();
    ctx.globalAlpha = dark * 0.22;
    ctx.fillStyle = '#23305A';
    ctx.fillRect(0, camera.viewY, W, camera.viewH);
    ctx.restore();
  }

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
  // Floor and the two outer walls (core/IsoRoom) with the wainscot, the timber floors, the lounge carpet, the hall
  // runner, windows with their daylight, doormats, and the soft shadows under the facilities and props — drawn once
  // into the cached layer.
  function drawFloor(g) {
    drawIsoRoom(g, iso, { cols, rows, wallH, look: L, bands: [{ from: 0, to: 0.07, color: L.skirting }, { from: 0.07, to: 0.36, color: L.wainscot }, { from: 0.36, to: 0.39, color: L.rail }] });
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
    // Windows, and the soft pool of daylight each one lays across the floor (light from the upper left).
    for (const w of WINDOWS) {
      patch(g, wallPatch(iso, w.side, w.from, w.to, 70, 185), L.window.frame, L.wallCap, 3);
      patch(g, wallPatch(iso, w.side, w.from + 0.12, w.to - 0.12, 80, 175), L.window.glass, L.wallLine, 1.5);
      patch(g, wallPatch(iso, w.side, w.from + 0.3, w.from + 0.55, 95, 165), L.window.shine);
      const a = iso.corner(0.05, w.from);
      const b = iso.corner(0.05, w.to);
      const grad = g.createLinearGradient(a.x, a.y, iso.corner(2.6, w.from).x, iso.corner(2.6, w.from).y);
      grad.addColorStop(0, L.daylight);
      grad.addColorStop(1, 'rgba(255, 246, 214, 0)');
      patch(g, [iso.corner(0.05, w.from), iso.corner(0.05, w.to), iso.corner(2.6, w.to + 0.9), iso.corner(2.6, w.from + 0.9)], grad);
    }
    // A doormat in every doorway.
    for (const w of WALLS) {
      for (const i of w.gaps) {
        const c = w.dir === 'row' ? w.col + i : w.col;
        const r = w.dir === 'row' ? w.row : w.row + i;
        patch(g, iso.outline(c + 0.12, r + 0.12, 0.76, 0.76), palette.hex, L.wallCap, 2);
      }
    }
    // Soft shadows under the facilities and props (the art has none): the footprint, a little inset, feathered.
    g.save();
    g.filter = 'blur(6px)';
    for (const it of [...(world?.placed ?? []), ...(world?.props ?? [])]) {
      if (it.kind === 'room') continue;
      const inset = it.kind === 'prop' ? 0.2 : 0.06;
      patch(g, iso.outline(it.fp.col + inset, it.fp.row + inset, it.fp.w - inset * 2, it.fp.h - inset * 2), L.softShadow);
    }
    g.restore();
  }
  // A soft shadow at each person's feet — it stays on the floor while they hop, so the hop reads as a hop.
  function drawPersonShadows(ctx) {
    ctx.save();
    ctx.fillStyle = L.personShadow;
    for (const p of world.people) {
      const f = feetOf(p);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y - 4, 40, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function drawProp(ctx, it) {
    const r = artRect(it);
    if (!it.def.flip) return void assets.draw(ctx, it.def.art, r.x, r.y, r.w, r.h);
    ctx.save();
    ctx.translate(r.x + r.w / 2, 0);
    ctx.scale(-1, 1);
    assets.draw(ctx, it.def.art, -r.w / 2, r.y, r.w, r.h);
    ctx.restore();
  }
  // A person with their pose (core/CharacterMotion): hop + sway walking, a gentle lean helping, breathing otherwise.
  function drawPerson(ctx, p) {
    const m = motionOf(p);
    poseAgent.state = stateOf(p);
    poseAgent.facing = m.flip;
    const t = poseAgent.state === 'walking' ? m.stride / MOTION.stride : animT;
    characterPose(poseAgent, t, m.seed, pose, p.kind === 'resident' ? MOTION.resident : MOTION.staff);
    const f = feetOf(p);
    const r = personRect(p);
    drawCharacter(ctx, assets, p.art, f.x, f.y, r.w, r.h, pose);
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
    if (isPerson(it)) {
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
  // Name tags: a fixed size on screen at every zoom (text 28). When people stand close their tags stack upwards instead
  // of covering each other (the person nearest the viewer keeps theirs just over their head).
  const TAG_H = 48;
  const tags = new Map(); // id → { x, y, w } this frame
  function layoutTags(ctx) {
    tags.clear();
    ctx.save();
    ctx.font = font(PERSON.tagSize, true);
    const list = world.people.map((p) => {
      const r = personRect(p);
      const s = camera.worldToScreen(r.x + r.w / 2, r.y + r.h * 0.02);
      const w = ctx.measureText(p.name.split(' ')[0]).width + 36;
      return { id: p.id, x: s.x - w / 2, y: s.y - TAG_H - 6, w };
    });
    ctx.restore();
    list.sort((a, b) => b.y - a.y);
    const placed = [];
    for (const t of list) {
      for (let n = 0; n < 6; n++) {
        const hit = placed.find((o) => t.x < o.x + o.w + 4 && o.x < t.x + t.w + 4 && t.y < o.y + TAG_H + 4 && o.y < t.y + TAG_H + 4);
        if (!hit) break;
        t.y = hit.y - TAG_H - 6;
      }
      placed.push(t);
      tags.set(t.id, t);
    }
  }
  function drawTag(ctx, p) {
    const t = tags.get(p.id);
    if (!t || t.y + TAG_H < camera.viewY || t.y > camera.viewY + camera.viewH) return;
    const label = p.name.split(' ')[0];
    const { x, y, w } = t;
    const s = { x: x + w / 2 };
    ctx.save();
    ctx.font = font(PERSON.tagSize, true);
    ctx.fillStyle = p.kind === 'resident' ? '#FFFFFF' : palette.hex;
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, TAG_H, TAG_H / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.kind === 'resident' ? C.text : '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, s.x, y + TAG_H / 2 + 1);
    ctx.restore();
  }
  // A small status icon over each staff member's head (Milestone 4's task markers; Milestone 5 adds resting and tired)
  // and the bell over a resident whose call bell is ringing. Screen space, above the name tag, the same size at any zoom.
  const MARK_R = 34;
  let markT = 0;
  function markerAt(p) {
    const r = personRect(p);
    const s = camera.worldToScreen(r.x + r.w / 2, r.y + r.h * 0.02);
    const tagY = tags.get(p.id)?.y ?? s.y - TAG_H - 6;
    return { x: s.x, y: tagY - 12 - MARK_R * 1.35 };
  }
  const statusIcon = (p) => {
    const t = world.taskOf(p);
    if (t) return { icon: TASK_TYPES[t.type].icon, ring: t.status === 'working' ? C.good : C.outline };
    if (p.model.status.tired) return { icon: 'tired', ring: C.warn };
    if (p.mode === 'resting') return { icon: 'rest', ring: C.progress };
    return null;
  };
  function drawMarkers(ctx) {
    markT = performance.now() / 1000;
    const onScreen = (m) => m.y > camera.viewY - MARK_R && m.y < camera.viewY + camera.viewH;
    for (const p of world.staff) {
      const st = statusIcon(p);
      if (!st) continue;
      const m = markerAt(p);
      if (onScreen(m)) drawTaskMarker(ctx, m.x, m.y, MARK_R, st.icon, { ring: st.ring });
    }
    if (world.bell) {
      const m = markerAt(world.resident);
      if (onScreen(m)) drawBellMarker(ctx, m.x, m.y, MARK_R * 1.15, markT);
    }
  }
  // Where a person's marker is drawn, and which status icon they show (tests).
  screen.markerPoint = (id) => markerAt(world.byId(id));
  screen.statusIconOf = (id) => statusIcon(world.byId(id))?.icon ?? null;
  screen.poseStateOf = (id) => stateOf(world.byId(id));

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
