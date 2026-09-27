// CAREWORKS — boot (Milestone 0: project shell + campaign slots + Facility Setup).
// Starts the shared series engine from core/ (renderer, safe areas, fixed-step loop, input, router, assets, debug
// overlay, saves) and opens the Main Menu: Continue (the last-used slot) · Campaign Slots · New Game · Settings.
// New Game / an empty slot → Facility Setup → START FACILITY writes the slot's summary record and an empty campaign
// save (core/CampaignSlots, keys campaign_1 … campaign_4) and opens the placeholder home. Starting into an occupied
// slot asks first, naming that slot's facility and year.
// Add ?debug=1 for the FPS/state overlay, ?screen=test for the scaling / tap / asset-loader test screen.
import { THEME, font } from '../../../core/Theme.js';
import { EventBus } from '../../../core/EventBus.js';
import { Rng } from '../../../core/Rng.js';
import { Renderer } from '../../../core/Renderer.js';
import { UiLayout } from '../../../core/UiLayout.js';
import { Input } from '../../../core/Input.js';
import { ScreenRouter } from '../../../core/ScreenRouter.js';
import { AssetManager } from '../../../core/AssetManager.js';
import { FixedStepLoop } from '../../../core/FixedStepLoop.js';
import { DebugOverlay } from '../../../core/DebugOverlay.js';
import { SystemBack } from '../../../core/SystemBack.js';
import { createStorageAdapter } from '../../../core/StorageAdapter.js';
import { TextPrompt } from '../../../core/ui/TextPrompt.js';
import { BottomSheet } from '../../../core/ui/BottomSheet.js';
import { Dialog } from '../../../core/ui/Modal.js';
import { drawButton, hitRect, setPressPoint, clearPress } from '../../../core/ui/Button.js';
import { ASSETS } from '../data/assets.js';
import { SAVE } from '../data/save.js';
import { createCampaigns } from './app/campaigns.js';
import { paletteById } from '../data/setup.js';
import { createMenuScreen } from './screens/MenuScreen.js';
import { createSlotsScreen } from './screens/SlotsScreen.js';
import { createSetupScreen } from './screens/SetupScreen.js';
import { createHomeScreen } from './screens/HomeScreen.js';
import { createTestScreen } from './screens/TestScreen.js';
const COL = THEME.color;

const W = 1080;
const BASE_H = 1920; // 9:16; taller phones grow the height (see Renderer)
const MAX_H = 2640; // up to 9:22 fills edge to edge; taller still gets thin bars top and bottom
const PARAMS = new URLSearchParams(window.location.search);
const START_SCREEN = PARAMS.get('screen') === 'test' ? 'test' : 'menu';

const bus = new EventBus();
const rng = new Rng('careworks-m0');
const renderer = new Renderer(document.getElementById('game'), { width: W, height: BASE_H, maxHeight: MAX_H, maxDpr: 2, bus });
const layout = new UiLayout(renderer);
bus.on('renderer:resize', () => layout.refresh());
const input = new Input(renderer, bus);
const assets = new AssetManager({ bus });
const router = new ScreenRouter(bus, { roots: ['menu', 'test', 'home'] });
const dialog = new Dialog({ layout, assets }); // confirm boxes (delete / replace a slot)
const sheet = new BottomSheet({ layout, assets, onClose: () => homeScreen.selection.clear() }); // the home's ring goes with its sheet
const textPrompt = new TextPrompt({ renderer });
bus.on('screen:change', () => textPrompt.close());
bus.on('screen:change', () => sheet.close());
bus.on('renderer:resize', () => textPrompt.close());

// Sprites are cached at the screen's real pixel size: remake them when that changes.
assets.setPixelScale(renderer.pixelScale);
bus.on('renderer:resize', () => {
  assets.setPixelScale(renderer.pixelScale);
  debug.top = debugTop();
  if (router.currentName === 'home') homeScreen.resize();
});

// Pressed button look: any button under a finger that is down.
bus.on('input:down', (p) => setPressPoint(p, renderer.pixelScale));
bus.on('input:up', () => clearPress());
bus.on('input:dragstart', () => clearPress());

const onTestScreen = () => router.currentName === 'test';
const loop = new FixedStepLoop({
  stepHz: 60,
  bus,
  update: (dt) => {
    router.update(dt);
    dialog.update(dt);
    sheet.update(dt);
  },
  render: (alpha) => {
    const ctx = renderer.begin(COL.bg);
    router.render(ctx, alpha);
    sheet.render(ctx);
    dialog.render(ctx);
    if (onTestScreen()) drawButton(ctx, pauseButton(), loop.paused ? 'RESUME' : 'PAUSE', { selected: loop.paused });
    if (loop.paused) drawPaused(ctx);
    debug.compact = sheet.active || !onTestScreen(); // one FPS line on the menus, the full box on the test screen
    debug.render(ctx);
  },
});
const debugTop = () => layout.safeRect.h - 600;
const debug = new DebugOverlay({ loop, renderer, layout, input, bus, top: debugTop(), maxLines: 3 });
bus.on('loop:pause', () => input.reset());
debug.log(`seeded rng check: ${rng.int(0, 9999)} (same every reload)`);

// ---------------------------------------------------------------------------
// Pause: the test screen's button pauses the whole loop (P / Space too); while paused any tap resumes. Hiding the app
// pauses the loop (core).
const pauseButton = () => layout.anchor('top-right', 240, THEME.button.minH, 80);
router.modal = {
  get active() {
    return loop.paused || dialog.active;
  },
  onTap: (p) => (loop.paused ? loop.resume('tap') : dialog.onTap(p)),
  onDown: (p) => dialog.active && dialog.onDown?.(p),
  onUp: (p) => dialog.active && dialog.onUp?.(p),
  onBack: () => (loop.paused ? loop.resume('back') : dialog.onBack()),
};
window.addEventListener('keydown', (e) => {
  if (e.key !== 'p' && e.key !== 'P' && e.key !== ' ') return;
  if (textPrompt.active || dialog.active || !onTestScreen()) return;
  loop.togglePause();
});
function drawPaused(ctx) {
  const H = renderer.height;
  ctx.fillStyle = COL.overlay;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COL.chip;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 300, H / 2 - 90, 600, 220, THEME.panel.radius);
  ctx.fill();
  ctx.fillStyle = COL.textOnDark;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(96, true);
  ctx.fillText('PAUSED', W / 2, H / 2);
  ctx.font = font(THEME.size.body);
  ctx.fillText('tap to resume', W / 2, H / 2 + 80);
}

// The sheet is asked before the screen; the test screen's pause button before both.
router.layers.push(
  {
    get active() {
      return onTestScreen();
    },
    handleInput: (hook, p) => {
      if (hook !== 'onTap' || !hitRect(p, pauseButton())) return false;
      loop.pause('button');
      return true;
    },
  },
  {
    get active() {
      return sheet.active;
    },
    handleInput: (hook, p) => sheet.handleInput(hook, p),
    onBack: () => sheet.onBack(),
  },
);

// Back (phone/browser Back, Esc, "‹ Back"): resume a paused loop, close the dialog / sheet, or go back a screen.
// Returns false at the Main Menu with nothing open, so the next Back leaves the app.
function back() {
  if (loop.paused) {
    loop.resume('back');
    return true;
  }
  return router.back();
}
const systemBack = new SystemBack({ onBack: back });
bus.on('input:up', () => systemBack.rearm()); // re-arm after any tap, in case a Back at the menu let it go

// ---------------------------------------------------------------------------
// Campaign slots (bible §3.5.9): four slots, each its own save + summary record; the account store is separate.
let campaigns = null;
let open = null; // { n, data } — the campaign on screen

async function prepareSaves() {
  const adapter = await createStorageAdapter({ dbName: SAVE.dbName, prefix: SAVE.localPrefix });
  campaigns = createCampaigns({ adapter, save: SAVE, bus });
  if (debug.enabled && PARAMS.get('reset') === '1') for (const n of campaigns.slots.numbers()) await campaigns.slots.remove(n);
  await campaigns.refresh();
}
const cards = () => campaigns?.cards ?? [];

// Reload mid-game (Milestone 1): this browser tab remembers which slot's home is open, so a reload comes straight back
// to it (the people start their loops again). A fresh launch of the app still opens the Main Menu.
const HOME_KEY = 'careworks:home';
function rememberHome(n) {
  try {
    if (n) sessionStorage.setItem(HOME_KEY, String(n));
    else sessionStorage.removeItem(HOME_KEY);
  } catch {}
}
function homeToResume() {
  try {
    const n = Number(sessionStorage.getItem(HOME_KEY));
    return n && campaigns?.card(n)?.summary ? n : null;
  } catch {
    return null;
  }
}

async function playSlot(n) {
  let data = null;
  try {
    data = await campaigns.open(n);
  } catch (err) {
    console.error('[CAREWORKS] could not load slot', n, err);
  }
  if (!data) {
    debug.log(`slot ${n}: nothing to load`);
    await campaigns.refresh();
    router.go('slots', { mode: 'browse' });
    return;
  }
  open = { n, data };
  debug.log(`slot ${n} opened: ${data.facility.name}`);
  rememberHome(n);
  router.go('home');
}

// START FACILITY. An occupied slot (read fresh, in case it changed) asks first, naming its facility and year.
async function startFacility(n, setup) {
  await campaigns.refresh();
  const old = campaigns.card(n);
  const write = async () => {
    const data = await campaigns.start(n, setup);
    open = { n, data };
    debug.log(`new facility in slot ${n}: ${setup.facility}, founder ${setup.founder}`);
    rememberHome(n);
    router.go('home');
  };
  if (old && !old.empty) {
    const was = old.summary ? `"${old.summary.facility}" (Year ${old.summary.year}, Month ${old.summary.month})` : 'the save in it';
    dialog.confirm({
      title: `Replace Slot ${n}?`,
      body: `Slot ${n} holds ${was}. Starting "${setup.facility}" here replaces it for good. Your account progress is kept.`,
      yes: 'Replace',
      danger: true,
      onYes: write,
    });
    return;
  }
  await write();
}

function deleteSlot(n) {
  const name = campaigns.card(n)?.summary?.facility;
  dialog.confirm({
    title: `Delete Slot ${n}?`,
    body: name ? `"${name}" will be gone for good. This can't be undone.` : 'This save will be gone for good.',
    yes: 'Delete',
    danger: true,
    onYes: async () => {
      await campaigns.remove(n);
      if (open?.n === n) open = null;
      debug.log(`slot ${n} deleted`);
    },
  });
}

// New Game: the first empty slot; when all four are full, pick one to replace.
function newGame() {
  const n = campaigns.firstEmpty();
  if (n != null) router.go('setup', { slot: n });
  else router.go('slots', { mode: 'new', note: 'All 4 slots are full. Pick one to replace.' });
}
function setupFor(n) {
  const c = campaigns.card(n);
  router.go('setup', { slot: n, replacing: c?.summary ?? null });
}

const menuScreen = createMenuScreen({
  layout,
  continueInfo: () => {
    const n = campaigns?.last;
    return n ? { n, summary: campaigns.card(n).summary } : null;
  },
  onContinue: (n) => playSlot(n),
  onSlots: () => router.go('slots', { mode: 'browse' }),
  onNewGame: () => newGame(),
  onSettings: () =>
    sheet.open(() => ({
      title: 'Settings',
      subtitle: 'Sound, text size and other options will live here.',
      accent: COL.progress,
      sections: [{ buttons: [{ id: 'test', label: 'Display test', accent: COL.progress, onTap: () => router.go('test') }] }],
    })),
});
const slotsScreen = createSlotsScreen({
  layout,
  cards,
  last: () => campaigns?.last ?? null,
  onBack: () => router.go('menu'),
  onPlay: (n) => playSlot(n),
  onDelete: (n) => deleteSlot(n),
  onNewInSlot: (n) => setupFor(n),
});
// Setup's Back: wherever it was opened from (the menu or the slot list). Not router.back(): that asks setup again.
function leaveSetup() {
  const to = router.backTarget;
  router.go(to?.name ?? 'menu', to?.params ?? {});
}
const setupScreen = createSetupScreen({ layout, assets, textPrompt, onBack: () => leaveSetup(), onStart: (n, setup) => startFacility(n, setup) });
// The home (Milestone 1). Tapping Arthur, the worker or a place opens its sheet — header only for now: picture, name,
// one line, and what a person is doing right now (the sheet is rebuilt every frame, so that stays live).
const homeScreen = createHomeScreen({ renderer, layout, assets, bus, sheet, campaign: () => open, openSheet: (kind, id) => openHomeSheet(id), onMenu: () => leaveHome(), debug });
function openHomeSheet(id) {
  sheet.open(() => {
    const w = homeScreen.world;
    const it = w?.byId(id);
    if (!it) return { title: '', sections: [] };
    const accent = paletteById(open?.data.facility.palette).hex;
    if (it.kind === 'resident' || it.kind === 'staff') {
      return { title: it.name, subtitle: it.line, art: it.art, accent, sections: [{ lines: [w.stateOf(it)] }] };
    }
    const here = w.people.filter((p) => p.agent.state !== 'walking' && p.loop[p.stop].at.startsWith(`${it.id}.`)).map((p) => p.name.split(' ')[0]);
    const sub = it.kind === 'room' ? `Arthur Lane's room · ${it.def.text.toLowerCase()}` : it.def.text;
    return { title: it.def.name, subtitle: sub, art: it.def.art, accent, sections: [{ lines: [here.length ? `Here now: ${here.join(' and ')}` : 'Nobody here right now'] }] };
  });
}
// Leaving the home for the Main Menu: a reload after this opens the menu again.
function leaveHome() {
  rememberHome(null);
  router.go('menu');
}

// ---------------------------------------------------------------------------
// Boot screen: shows while the images and the saves load, then the Main Menu (or the test screen).
const bootScreen = {
  progress: 0,
  enter() {
    this.progress = 0;
    Promise.all([
      assets.loadImages(ASSETS, (done, total) => (this.progress = done / total)).then((r) => debug.log(`assets: ${r.loaded} loaded, ${r.missing.length} missing`)),
      prepareSaves().catch((err) => console.error('[CAREWORKS] saves unavailable', err)),
    ]).then(() => {
      const n = START_SCREEN === 'menu' ? homeToResume() : null;
      if (n) playSlot(n);
      else router.go(START_SCREEN);
    });
  },
  render(ctx) {
    const H = renderer.height;
    ctx.fillStyle = COL.text;
    ctx.font = font(THEME.size.major, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CAREWORKS', W / 2, H / 2 - 60);
    ctx.fillStyle = COL.track;
    ctx.fillRect(W / 2 - 300, H / 2 + 20, 600, 24);
    ctx.fillStyle = COL.progress;
    ctx.fillRect(W / 2 - 300, H / 2 + 20, 600 * this.progress, 24);
  },
};

// The Milestone 0 placeholder sheet (test screen).
const testSheet = () => ({
  title: 'Test sheet',
  subtitle: 'Placeholder bottom sheet for Milestone 0.',
  art: 'm0Real',
  sections: [
    {
      lines: ['Close it with ✕, by tapping above it, with Close, or with the phone Back button.'],
      buttons: [
        { id: 'menu', label: 'Main Menu', onTap: () => router.go('menu') },
        { id: 'close', label: 'Close', accent: COL.progress, onTap: () => sheet.close() },
      ],
    },
  ],
});

router
  .register('boot', bootScreen)
  .register('menu', menuScreen)
  .register('slots', slotsScreen)
  .register('setup', setupScreen)
  .register('home', homeScreen)
  .register('test', createTestScreen({ renderer, layout, assets, openSheet: () => sheet.open(testSheet), onTapLogged: (p) => window.__cw?.taps.push({ x: p.x, y: p.y }) }));

// ?debug=1: a test hook for automated checks.
if (debug.enabled) {
  window.__cw = { renderer, layout, input, loop, router, assets, sheet, dialog, systemBack, textPrompt, menuScreen, slotsScreen, setupScreen, homeScreen, playSlot, startFacility, deleteSlot, newGame, taps: [], get campaigns() { return campaigns; }, get open() { return open; } };
}

router.go('boot');
loop.start();
