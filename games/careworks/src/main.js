// CAREWORKS — boot (Milestone 0: project shell + campaign slots + Facility Setup; Milestone 2: the open campaign's
// world — the game clock and Arthur's day — saved by the series Autosave, plus a save at every band change).
// Starts the shared series engine from core/ (renderer, safe areas, fixed-step loop, input, router, assets, debug
// overlay, saves) and opens the Main Menu: Continue (the last-used slot) · Campaign Slots · New Game · Settings.
// New Game / an empty slot → Facility Setup → START FACILITY writes the slot's summary record and an empty campaign
// save (core/CampaignSlots, keys campaign_1 … campaign_4) and opens the placeholder home. Starting into an occupied
// slot asks first, naming that slot's facility and year.
// Milestone 5: the home gets the shared series bars (core/ui TopBar and BottomBar): date, Credits, Care Tokens, Rank,
// Pause / 1× (2× and 4× locked), Inbox and Help on top; Care · Staff · Develop · Quality · Business below (Care opens the
// resident list, Staff the team roster, the rest a sheet saying what will live there), a red dot on Care while a call
// bell rings or a missed task hasn't been looked at. Care pops (core/VfxSystem) and the end-of-day beat.
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
import { Autosave } from '../../../core/Autosave.js';
import { TextPrompt } from '../../../core/ui/TextPrompt.js';
import { BottomSheet } from '../../../core/ui/BottomSheet.js';
import { Dialog } from '../../../core/ui/Modal.js';
import { drawButton, hitRect, setPressPoint, clearPress } from '../../../core/ui/Button.js';
import { createTopBar } from '../../../core/ui/TopBar.js';
import { createBottomBar } from '../../../core/ui/BottomBar.js';
import { VfxSystem } from '../../../core/VfxSystem.js';
import { BOTTOM_SLOTS, bottomRoute, TOP_ICONS, RANK_NONE, CARE_ICONS, TOP_SHEETS, SPEED_LOCKED, PORTRAIT_CROP } from '../data/bars.js';
import { ECONOMY_START } from '../data/balance.js';
import { createCarePops, createDayBeat } from './ui/carePops.js';
import { ASSETS } from '../data/assets.js';
import { SAVE } from '../data/save.js';
import { createCampaigns } from './app/campaigns.js';
import { paletteById } from '../data/setup.js';
import { NEEDS, OUTCOMES, RESIDENTS, validateResidents, supportLevel, ROOM_TEMPLATES } from '../data/residents.js';
import { DataValidator } from '../../../core/DataValidator.js';
import { ROUTINE, LOG_SHOWN, BANDS } from '../data/routine.js';
import { ROLES, STATS, TIERS } from '../data/roles.js';
import { TRAITS, STAFF, validateStaff } from '../data/staff.js';
import { SHIFTS, FEES } from '../data/balance.js';
import { ADMISSION } from '../data/admissions.js';
import { ROOM_IDS } from '../data/home.js';
import { FOUNDERS } from '../data/setup.js';
import { DOMAINS, CARE_OPTIONS, optionById, optionsFor, validateCarePlans } from '../data/carePlans.js';
import { TASK_TYPES, BELL } from '../data/tasks.js';
import { familiarityOf } from './systems/careTasks.js';
import { clockText } from './systems/residentNeeds.js';
import { yearsEmployed } from './systems/staffTeam.js';
import { createHomeWorld, makeClock, theirOf } from './systems/homeWorld.js';
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
    router.update(dt); // on the home: the clock and everyone in it move
    if (open && router.currentName === 'home') open.data.playSec = (open.data.playSec ?? 0) + dt;
    vfx.update(dt); // real seconds: pops keep their pace at any game speed
    carePops.update(dt);
    dayBeat.update(dt);
    autosave.tick(dt);
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
    // On the home a tap on the top bar still reaches it (Pause, Inbox and Help work with a sheet up).
    handleInput: (hook, p) => (hook === 'onTap' && router.currentName === 'home' && !homeScreen.buildMode && topBar.contains(p) ? false : sheet.handleInput(hook, p)),
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
let open = null; // { n, data, world } — the campaign on screen and its home world

// A campaign's world (Milestone 2): its clock and the residents' saved states, the team from its Founder; Milestone 6:
// the applicant board and the ledger (an older save's ledger opens with its saved Credits).
function openRun(n, data) {
  const clock = makeClock(bus);
  if (data.clock) clock.load(data.clock);
  const world = createHomeWorld({ founderId: data.facility.founder?.id, clock, residents: data.residents, staff: data.staff, care: data.care, seed: data.seed, bus, admissions: data.admissions, ledger: data.ledger, startCredits: data.economy?.credits ?? ECONOMY_START.credits });
  if (debug.enabled && PARAMS.get('paused') === '1') clock.speed = 0; // ?debug=1&paused=1: open exactly as saved (tests)
  data.economy ??= { ...ECONOMY_START };
  open = { n, data, world, seenMissed: new Set() };
  vfx.clear();
  carePops.clear();
  dayBeat.current = null;
}
// The run save: the page's campaign data with the world's clock and residents written in (and the slot's summary).
function saveRun() {
  const o = open;
  if (!o) return Promise.resolve();
  const c = o.world.clock;
  o.data = { ...o.data, ...o.world.serialize(), date: { year: c.year, month: c.month, day: c.day } };
  o.data.economy = { ...(o.data.economy ?? ECONOMY_START), credits: o.world.ledger.balance }; // (the ledger is the truth; this is the summary)
  return campaigns.save(o.n, o.data);
}
// Autosave (core/Autosave): the series cadence (every game day, a rolling save, and when the app goes to the
// background) plus every band change, each routine step and a pause.
const autosave = new Autosave({
  bus,
  triggers: ['clock:day', 'care:band', 'care:step', 'care:task', 'care:bell', 'care:plan', 'clock:speed', 'staff:onShift', 'staff:offShift', 'care:admit', 'care:joined', 'admissions:change', 'ledger:close', 'admissions:action'],
  save: () => saveRun(),
  stamp: () => (open ? JSON.stringify(open.world.serialize()) : null),
  running: () => !!open && router.currentName === 'home' && !open.world.clock.paused,
  enabled: () => !!open,
});
autosave.installBackground();
bus.on('autosave:failed', ({ error }) => debug.log(`save failed: ${error?.message ?? error}`));
bus.on('care:band', ({ band }) => debug.log(`band: ${band}`));

async function prepareSaves() {
  const adapter = await createStorageAdapter({ dbName: SAVE.dbName, prefix: SAVE.localPrefix });
  campaigns = createCampaigns({ adapter, save: SAVE, bus });
  if (debug.enabled && PARAMS.get('reset') === '1') for (const n of campaigns.slots.numbers()) await campaigns.slots.remove(n);
  await campaigns.refresh();
  if (debug.enabled) {
    const r = validateResidents(new DataValidator(), RESIDENTS, ROUTINE.map((x) => x.id)).report();
    debug.log(r.ok ? `residents: ${RESIDENTS.length} checked` : `resident data: ${r.errors.join('; ')}`);
    if (!r.ok) console.error('[CAREWORKS] resident data', r.errors);
    const s = validateStaff(new DataValidator(), STAFF).report();
    debug.log(s.ok ? `staff: ${STAFF.length} checked` : `staff data: ${s.errors.join('; ')}`);
    if (!s.ok) console.error('[CAREWORKS] staff data', s.errors);
    const known = { taskTypes: Object.keys(TASK_TYPES), steps: ROUTINE.map((x) => x.id), bands: BANDS.map((b) => b.id), needs: NEEDS.map((n) => n.id), outcomes: OUTCOMES.map((o) => o.id), roles: Object.keys(ROLES) };
    const c = validateCarePlans(new DataValidator(), known).report();
    debug.log(c.ok ? `care options: ${CARE_OPTIONS.length} checked` : `care plan data: ${c.errors.join('; ')}`);
    if (!c.ok) console.error('[CAREWORKS] care plan data', c.errors);
  }
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
  openRun(n, data);
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
    openRun(n, data);
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
// The home (Milestones 1–4). Tapping Arthur, a staff member or a place opens its sheet (rebuilt every frame, so it stays
// live). Arthur's card (Milestone 2): what he is doing now, his six needs and five outcomes as bars, today's log and
// his likes and dislikes; Milestone 3 adds who helps with each step (a picker, which since Milestone 4 pins that step's
// task). Milestone 4: the Care Plan section (six rows, each opening its domain's options), today's care tasks, the call
// bells (the last five and the average response) and Familiar Care. The room card names its resident.
// Milestone 5: the shared bars. The top bar reads the open run's clock through this stand-in (there is no run on the
// menus, and each campaign has its own clock).
const runClock = () => open?.world.clock ?? null;
const barClock = {
  get paused() {
    return runClock()?.paused ?? true;
  },
  get speed() {
    return runClock()?.speed ?? 0;
  },
  get speeds() {
    return runClock()?.speeds ?? [1, 2, 4];
  },
  get totalDays() {
    return runClock()?.totalDays ?? 0;
  },
  canUseSpeed: (s) => runClock()?.canUseSpeed(s) ?? false,
  togglePause: () => runClock()?.togglePause(),
  setSpeed: (s) => runClock()?.setSpeed(s),
  dateOf: (d) => runClock()?.dateOf(d) ?? { year: 1, month: 1, day: 1 },
};
const credits = (n) => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('en-GB')}`;
// Milestone 6: Credits from the ledger (red below zero — no debt system yet).
const balanceNow = () => open?.world.ledger.balance ?? ECONOMY_START.credits;
const topBar = createTopBar({
  layout,
  assets,
  clock: barClock,
  home: true,
  stats: () => {
    const e = open?.data.economy ?? ECONOMY_START;
    const b = balanceNow();
    return [
      { icon: TOP_ICONS.credits, text: credits(b), color: b < 0 ? COL.bad : COL.text, gap: 18 },
      { icon: TOP_ICONS.careTokens, text: String(e.careTokens ?? 0), gap: 18 },
      { text: `Rank ${RANK_NONE}` },
    ];
  },
  onStats: () => openLedger(),
  onInbox: () => openTopSheet('inbox'),
  onHelp: () => openTopSheet('help'),
  onLockedSpeed: (speed) => sheet.open(() => ({ title: `${speed}× speed`, subtitle: SPEED_LOCKED, accent: COL.progress, sections: [] })),
});
// Care's badge (Milestone 6: a count): the call bells ringing now plus the missed tasks today the player hasn't looked
// at yet (opening the resident list or a resident's card counts as looking).
const missedToday = () => open?.world.missedToday() ?? [];
function careBadge() {
  if (!open) return null;
  const n = open.world.bells.length + missedToday().filter((t) => !open.seenMissed.has(t.id)).length;
  return n || null;
}
const markMissedSeen = (residentId = null) => {
  for (const t of missedToday()) if (!residentId || t.resident === residentId) open?.seenMissed.add(t.id);
};
const bottomBar = createBottomBar({
  layout,
  assets,
  items: BOTTOM_SLOTS.map((s) => ({ id: s.id, label: s.label, icon: s.icon, badge: s.id === 'care' ? careBadge : null })),
  open: (id) => openBottom(id),
});
const vfx = new VfxSystem({ assets, width: W, height: renderer.height, font: THEME.family, maxTexts: 4, maxEffects: 16 });
const dayBeat = createDayBeat();
const homeScreen = createHomeScreen({ renderer, layout, assets, bus, sheet, campaign: () => open, world: () => open?.world ?? null, openSheet: (kind, id) => openHomeSheet(id), onMenu: () => leaveHome(), topBar, bottomBar, vfx, dayBeat, debug });
const carePops = createCarePops({ bus, world: () => open?.world ?? null, vfx, screen: homeScreen, isVisible: () => router.currentName === 'home' && !!open && !homeScreen.buildMode && !loop.paused });
// The end of each day: the medium beat ("Day 3 — all routine care done" / "2 tasks missed").
bus.on('care:dayEnd', (summary) => {
  if (!open || router.currentName !== 'home') return;
  const d = open.world.clock.dateOf(summary.day);
  dayBeat.show(summary, `Day ${d.day}`);
  debug.log(`day ${summary.day}: ${summary.done} done, ${summary.missed} missed`);
});
// Milestone 6: a new resident moves in — the medium beat "Welcome, Betty Finch".
bus.on('care:admit', ({ name }) => {
  if (open && router.currentName === 'home') dayBeat.showText(`Welcome, ${name}`, true);
  debug.log(`admitted: ${name}`);
});

// Where each bottom-bar slot goes (data/bars.js).
function openBottom(id) {
  const r = bottomRoute(id);
  if (!r || !open) return;
  if (r.sheet === 'residents') openResidents();
  else if (r.sheet === 'roster') openRoster();
  else if (r.slot.id === 'business') openBusiness();
  else openPlaceholder(r.slot);
  lastRoute = r.sheet;
}
let lastRoute = null;
const accentNow = () => (open ? paletteById(open.data.facility.palette).hex : COL.progress);
const first = (name) => name.split(' ')[0];
const needName = (id) => NEEDS.find((n) => n.id === id)?.name ?? id;
const stepName = (id) => ROUTINE.find((s) => s.id === id)?.name ?? id;
// Care: every resident (portrait; the call-bell icon while theirs rings) and the Admissions row (Milestone 6).
function openResidents() {
  markMissedSeen();
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const missedBy = (id) => missedToday().filter((t) => t.resident === id).length;
    const rows = w.residents.map((a) => {
      const bell = w.bellFor(a.id);
      const missed = missedBy(a.id);
      const sub = bell ? `Call bell ringing · ${w.stateOf(a)}` : missed ? `${missed} missed today · ${w.stateOf(a)}` : w.stateOf(a);
      return { id: `resident:${a.id}`, label: a.name, sub, icon: a.art, iconCrop: PORTRAIT_CROP, iconBadge: bell ? CARE_ICONS.bell : null, accent: bell || missed ? COL.action : COL.progress, onTap: () => openFrom(a.id, 'residents') };
    });
    const adm = w.admissions;
    const free = w.freeRooms().length;
    const n = w.residents.length;
    return {
      title: 'Residents',
      subtitle: `${n} resident${n === 1 ? '' : 's'} · ${free} of ${w.rooms.length} rooms free · tap someone for their card and care plan`,
      art: 'care_ui_01',
      accent: accentNow(),
      sections: [
        { columns: 1, buttons: rows },
        { title: 'Admissions', columns: 1, buttons: [{ id: 'admissions', label: 'Admissions', sub: `${adm.board.length} applying · ${adm.waiting.length} on the waiting list`, icon: CARE_ICONS.admissions, badge: adm.board.length || null, accent: COL.action, onTap: () => openAdmissions() }] },
      ],
    };
  });
}
// Staff: the team roster — portrait, role badge, Energy and Morale; each opens their staff card.
function openRoster() {
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    return {
      title: 'Your team',
      subtitle: `${w.staff.length} staff · Morning shift 06:00–17:00 · tap someone for their card`,
      art: 'care_ui_02',
      accent: accentNow(),
      sections: [
        {
          columns: 1,
          buttons: w.staff.map((p) => {
            const m = p.model;
            const founder = w.staffState.founder.id === p.id ? ' · Founder' : '';
            return { id: `staff:${p.id}`, label: p.name, sub: `${ROLES[m.role].short}${founder} · Energy ${Math.round(m.energy)} · Morale ${Math.round(m.morale)}`, icon: p.art, iconCrop: PORTRAIT_CROP, iconBadge: ROLES[m.role].badge, accent: m.status.tired || m.status.stressed ? COL.action : COL.progress, onTap: () => openFrom(p.id, 'roster') };
          }),
        },
      ],
    };
  });
}
// Develop / Quality: what will live there.
function openPlaceholder(slot) {
  sheet.open(() => ({ title: slot.title, subtitle: slot.text, art: slot.icon, accent: accentNow(), sections: [] }));
}
// Business (Milestone 6): the Ledger, and Save and Main Menu (the run is saved first).
function openBusiness() {
  const slot = BOTTOM_SLOTS.find((s) => s.id === 'business');
  sheet.open(() => {
    const b = balanceNow();
    return {
      title: slot.title,
      subtitle: slot.text,
      art: slot.icon,
      accent: accentNow(),
      sections: [
        {
          columns: 1,
          lines: ['Your home saves itself as you play.'],
          buttons: [
            { id: 'ledger', label: 'Ledger', sub: `Balance ${credits(b)} Credits · fees, funding and wages each month`, accent: COL.action, onTap: () => openLedger() },
            { id: 'mainMenu', label: 'Save and Main Menu', accent: COL.progress, onTap: () => leaveHome() },
          ],
        },
      ],
    };
  });
}
// The Ledger (Milestone 6): the balance, this month so far (what the close will bring) and the last month's close.
function ledgerLines(lines) {
  const out = lines.map((l) => ({ text: `${l.amount < 0 ? '−' : '+'}${credits(Math.abs(l.amount))}  ${l.reason}`, color: l.amount < 0 ? COL.bad : COL.good }));
  const inc = lines.filter((l) => l.amount > 0).reduce((t, l) => t + l.amount, 0);
  const cost = lines.filter((l) => l.amount < 0).reduce((t, l) => t + l.amount, 0);
  out.push({ text: `Income ${credits(inc)} · Costs ${credits(-cost)} · Net ${inc + cost < 0 ? '−' : '+'}${credits(Math.abs(inc + cost))}`, color: COL.actionDark });
  return out;
}
function openLedger() {
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const b = w.ledger.balance;
    const c = w.clock;
    const range = w.monthRange();
    const soFar = w.ledger.forecast({ ...range, day: c.totalDays, residents: w.payers(), staff: w.payroll() });
    const last = w.ledger.lastClose;
    const sections = [
      { lines: [{ text: `Balance: ${credits(b)} Credits`, color: b < 0 ? COL.bad : COL.actionDark }, ...(b < 0 ? [{ text: 'Below zero. There is no debt system yet: the home carries on.', color: COL.bad }] : [])] },
      { title: `This month so far (Month ${c.month}, Year ${c.year})`, lines: [{ text: 'Paid at the month\'s close: fees and funding for each resident\'s days here, wages in full.', color: COL.textMuted }, ...ledgerLines(soFar)] },
      last ? { title: `Last close: ${last.month}`, lines: ledgerLines(last.lines) } : { title: 'Last close', lines: [{ text: 'No month has closed yet.', color: COL.textMuted }] },
      { columns: 1, buttons: [{ id: 'ledger:back', label: '‹ Back to Business', accent: COL.progress, onTap: () => openBusiness() }] },
    ];
    return { title: 'Ledger', subtitle: `Credits · Month ${c.month}, Year ${c.year}`, art: 'care_ui_05', accent: accentNow(), sections };
  });
}
function openTopSheet(id) {
  const t = TOP_SHEETS[id];
  sheet.open(() => ({ title: t.title, subtitle: t.text, accent: COL.progress, sections: [] }));
}
// A card opened from a list gets a way back to that list, and the person's ring in the home.
function openFrom(id, list) {
  const it = open?.world.byId(id);
  if (it) homeScreen.selection.select(it);
  openHomeSheet(id, list);
}

// --- Admissions (Milestone 6, bible §8) -----------------------------------------------------------------------------
const admitCtxNow = () => open.world.admitCtx();
function openAdmissions() {
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const adm = w.admissions;
    const ctx = admitCtxNow();
    const row = (app, wait) => {
      const def = adm.defOf(app);
      const p = adm.prereq(app, ctx);
      const days = adm.daysLeft(app, ctx.day);
      const status = wait ? `${days} day${days === 1 ? '' : 's'} left on the list` : `${def.urgency} urgency`;
      return { id: `app:${app.id}`, label: `${def.name}, ${def.age}`, sub: `${def.support} · ${status} · ${p.ok ? 'Ready' : p.text}`, icon: def.art, iconCrop: PORTRAIT_CROP, accent: p.ok ? COL.progress : COL.textFaint, onTap: () => openApplicant(app.id) };
    };
    const free = w.freeRooms().length;
    return {
      title: 'Admissions',
      subtitle: `${free} of ${w.rooms.length} Standard Rooms free · new applicants every few days`,
      art: CARE_ICONS.admissions,
      accent: accentNow(),
      sections: [
        adm.board.length ? { title: 'Applicants', columns: 1, buttons: adm.board.map((a) => row(a, false)) } : { title: 'Applicants', lines: [{ text: 'Nobody is applying right now. New applicants arrive every few days.', color: COL.textMuted }] },
        adm.waiting.length ? { title: 'Waiting list', columns: 1, buttons: adm.waiting.map((a) => row(a, true)) } : { title: 'Waiting list', lines: [{ text: 'Nobody is waiting.', color: COL.textMuted }] },
        { columns: 1, buttons: [{ id: 'adm:back', label: '‹ Back to residents', accent: COL.progress, onTap: () => openResidents() }] },
      ],
    };
  });
}
// One applicant's card (bible §8): who they are, their needs, what they want and need, and the four choices. A choice
// that can't be made now is greyed with the reason in plain words — never a hidden fail.
function openApplicant(id) {
  let message = null;
  sheet.open(() => {
    const w = open?.world;
    const adm = w?.admissions;
    const app = adm?.get(id);
    if (!app) return { title: 'No longer applying', subtitle: 'They have found a place elsewhere.', accent: COL.progress, sections: [{ columns: 1, buttons: [{ id: 'app:back', label: '‹ Back to admissions', accent: COL.progress, onTap: () => openAdmissions() }] }] };
    const def = adm.defOf(app);
    const ctx = admitCtxNow();
    const p = adm.prereq(app, ctx);
    const can = adm.canAdmit(app, ctx);
    const level = supportLevel(def);
    const days = adm.daysLeft(app, ctx.day);
    const wait = app.status === 'wait';
    const nextRoom = w.freeRooms()[0];
    const act = (fn, ok) => {
      const r = fn();
      if (!r.ok) {
        message = r.reason;
        return;
      }
      bus.emit('admissions:action', { id });
      ok?.();
    };
    const lines = [];
    if (message) lines.push({ text: message, color: COL.bad });
    lines.push({ text: p.ok ? 'Ready: the home can meet their needs' : p.text, color: p.ok ? COL.good : COL.bad });
    if (!p.ok) lines.push({ text: p.reason, color: COL.bad });
    lines.push(`Wants: ${ROOM_TEMPLATES[def.room].name} · Urgency: ${def.urgency} · ${def.stay}`);
    lines.push(`Support Level ${level} · Care Support Funding ${credits(FEES.careSupportFundingByLevel[level])} a month · fee ${credits(FEES.accommodationPerMonth)} a month`);
    lines.push(`Visitors: ${def.visitors} · ${def.personality} · enjoys ${def.interest}`);
    lines.push({ text: wait ? `On the waiting list: ${days} day${days === 1 ? '' : 's'} left before they look elsewhere` : `Applying: ${days} day${days === 1 ? '' : 's'} before they look elsewhere if nobody answers`, color: COL.textMuted });
    if (app.assessReady != null && ctx.day < app.assessReady) lines.push({ text: 'Assessment update under way: back tomorrow.', color: COL.actionDark });
    else if (app.assessed) lines.push({ text: 'Assessment updated.', color: COL.textMuted });
    return {
      title: def.name,
      subtitle: `${def.age} · ${def.support} · ${def.stay}`,
      art: def.art,
      accent: accentNow(),
      sections: [
        { lines },
        { title: 'Needs', lines: [{ text: 'How much support they need now (their assessment)', color: COL.textMuted }], bars: NEEDS.map((n) => ({ label: n.name, value: app.needs[n.id], color: COL.progress })) },
        {
          columns: 1,
          buttons: [
            { id: 'act:admit', label: 'Admit now', sub: can.ok ? `Room ${ROOM_IDS.indexOf(nextRoom?.id) + 1} · walks in now, joins the routine from the next band` : can.reason, disabled: !can.ok, accent: COL.good, onTap: () => act(() => w.admit(id), () => {
              sheet.close();
              const person = w.residentById(id);
              if (person) homeScreen.selection.select(person);
            }) },
            { id: 'act:wait', label: 'Wait-list', sub: wait ? 'Already on the waiting list' : `Keeps their place for ${ADMISSION.waitDays} days`, disabled: wait, accent: COL.progress, onTap: () => act(() => adm.waitlist(id, ctx.day)) },
            { id: 'act:decline', label: 'Decline / refer elsewhere', sub: 'They look for a place elsewhere (and may apply again later)', accent: COL.progress, onTap: () => act(() => adm.decline(id, ctx.day), () => openAdmissions()) },
            { id: 'act:assess', label: 'Request assessment update', sub: app.assessed ? 'Already updated once' : 'A fresh look at their needs · takes a day', disabled: app.assessed, accent: COL.progress, onTap: () => act(() => adm.requestAssessment(id, ctx.day)) },
            { id: 'app:back', label: '‹ Back to admissions', accent: COL.progress, onTap: () => openAdmissions() },
          ],
        },
      ],
    };
  });
}

// --- a resident's card (Milestones 2–6) --------------------------------------------------------------------------------
// What they are doing now, their six needs and five outcomes as bars, today's log and their likes; who helps with each
// step (a picker, which since Milestone 4 pins that step's task); the Care Plan section (six rows, each opening its
// domain's options), today's care tasks, the call bells and Familiar Care. Milestone 6: any resident, not only Arthur.
function residentSections(w, it) {
  const st = it.state;
  const step = st.step && w.joined(it) ? stepName(st.step.id) : null;
  const log = st.log.slice(-LOG_SHOWN).map((e) => `${e.t}  ${e.text}`);
  const pick = (p) => ROUTINE.filter((s) => (st.prefs[s.id] ?? 'accept') === p).map((s) => (s.activity ? s.name : s.name.toLowerCase()));
  const likes = [pick('prefer').length && `Enjoys: ${pick('prefer').join(', ')}`, pick('dislike').length && `Would rather not: ${pick('dislike').join(', ')}`, pick('refuse').length && `Says no to: ${pick('refuse').join(', ')}`].filter(Boolean);
  const bell = w.bellFor(it.id);
  const they = theirOf(it.id) === 'her' ? 'she' : 'he';
  return [
    { lines: [{ text: step ? `${step}: ${w.stateOf(it)}` : w.stateOf(it), color: COL.actionDark }, ...(bell ? [{ text: `Call bell ringing (${needName(bell.need)})`, color: COL.bad }] : []), `Room ${ROOM_IDS.indexOf(st.room) + 1} · Support Level ${supportLevel(it.def)} · ${it.def.stay}`] },
    { title: 'Care Plan', lines: [{ text: 'Tap a row to change it. A change shapes tomorrow\'s tasks, and today\'s where that part hasn\'t happened yet.', color: COL.textMuted }], buttons: planButtons(it), columns: 1 },
    { title: 'Tasks today', lines: taskLines(w, it) },
    { title: 'Call bells', lines: bellLines(w, it, they) },
    { title: 'Familiar Care', lines: familiarLines(w, it) },
    { title: 'Needs', lines: [{ text: `How much support ${they} needs right now`, color: COL.textMuted }], bars: NEEDS.map((n) => ({ label: n.name, value: st.needs[n.id], color: COL.progress })) },
    { title: 'Outcomes', bars: OUTCOMES.map((o) => ({ label: o.name, value: st.outcomes[o.id], color: COL.good })) },
    { title: 'Today', lines: log.length ? log : ['Nothing yet today'] },
    { title: 'Likes and dislikes', lines: likes },
    { title: 'Who helps', lines: [{ text: 'Staff pick their own tasks. Tap a step to pin it to one person (Auto: whoever scores best).', color: COL.textMuted }], buttons: helpButtons(w, it), columns: 2 },
  ];
}
// Milestone 4: the Care Plan section — one row per domain (bible §9), tap → that domain's options.
function planButtons(it) {
  return DOMAINS.map((d) => {
    const o = optionById(it.state.plan?.[d.id]);
    return { id: `plan:${d.id}`, label: d.name, sub: o ? o.name : 'Not set', accent: COL.progress, onTap: () => openPlanPicker(d.id, it.id) };
  });
}
// "07:00  Wake up · done with Ruby"
const TASK_WORDS = { open: 'to do', claimed: 'on the way', working: 'being helped', done: 'done', missed: 'missed', refused: 'said no', self: 'on their own', unstaffed: 'no one on shift' };
function taskLines(w, it) {
  if (!w.joined(it)) return [{ text: 'Settling in: care tasks start from the next band.', color: COL.textMuted }];
  const tasks = w.tasksToday(it.id).filter((t) => t.type !== 'bell');
  if (!tasks.length) return [{ text: 'No care tasks planned for this band (no one is on shift).', color: COL.textMuted }];
  return tasks.sort((a, b) => (a.at ?? a.opens % 24) - (b.at ?? b.opens % 24)).map((t) => {
    const who = t.slots[0] ? ` · ${first(w.byId(t.slots[0])?.name ?? t.slots[0])}` : '';
    const at = t.at ?? t.opens % 24;
    const word = t.status === 'open' && t.opens > w.clock.totalDays * 24 + w.hour ? 'later' : TASK_WORDS[t.status];
    const color = t.status === 'missed' ? COL.bad : t.status === 'done' ? COL.good : t.status === 'open' ? COL.textMuted : COL.actionDark;
    return { text: `${clockText(at)}  ${t.name} · ${word}${who}`, color };
  });
}
function bellLines(w, it, they) {
  const b = w.bellSummary(it.id);
  const lines = [];
  if (!b.last.length) lines.push({ text: 'No call bells yet.', color: COL.textMuted });
  else {
    lines.push(`Last ${b.last.length}: ${b.last.map((r) => `${r.minutes} min`).join(' · ')}`);
    lines.push({ text: `Average response: ${Math.round(b.avg)} min (${b.count} bell${b.count === 1 ? '' : 's'} so far)`, color: COL.actionDark });
  }
  const cap = they.charAt(0).toUpperCase() + they.slice(1);
  lines.push({ text: `${cap} rings when a need reaches ${BELL.line}; the time counts until someone is at ${theirOf(it.id)} side.`, color: COL.textMuted });
  return lines;
}
function familiarLines(w, it) {
  const top = w.mostFamiliar(it.id);
  const counts = w.staff.map((p) => `${first(p.name)} ${familiarityOf(w.care, it.id, p.id)}`).join(' · ');
  return [{ text: top ? `Most familiar: ${w.byId(top).name}` : 'Most familiar: nobody yet', color: COL.actionDark }, { text: `Care together: ${counts}`, color: COL.textMuted }];
}
// "Mobility for Betty": the domain's options (two each until Milestone 8), the current one marked.
function openPlanPicker(domainId, residentId) {
  sheet.open(() => {
    const w = open?.world;
    const d = DOMAINS.find((x) => x.id === domainId);
    const it = w?.residentById(residentId);
    if (!w || !d || !it) return { title: '', sections: [] };
    const current = it.state.plan?.[d.id];
    const choose = (id) => {
      const r = w.changePlan(d.id, id, residentId);
      if (r.ok && r.changed) autosave.request('plan');
      openHomeSheet(residentId);
    };
    return {
      title: `${d.name} for ${first(it.name)}`,
      subtitle: 'Care plan · pick one option. More options arrive later.',
      art: it.art,
      accent: paletteById(open.data.facility.palette).hex,
      sections: [
        { lines: optionsFor(d.id).map((o) => ({ text: `${o.name}: ${o.text}`, color: o.id === current ? COL.actionDark : COL.text })) },
        {
          columns: 1,
          buttons: [
            ...optionsFor(d.id).map((o) => ({
              id: `option:${o.id}`,
              label: o.name,
              sub: `${o.roles.map((r) => ROLES[r].short).join(' / ')} · about ${o.minutesPerDay} min a day${o.id === current ? ' · current' : ''}`,
              accent: o.id === current ? COL.good : COL.progress,
              onTap: () => choose(o.id),
            })),
            { id: 'option:back', label: `‹ Back to ${first(it.name)}`, accent: COL.progress, onTap: () => openHomeSheet(residentId) },
          ],
        },
      ],
    };
  });
}
// Milestone 3: one button per routine step — who will help with it.
const onMorningShift = (step) => step.at >= SHIFTS.morning.from && step.at < SHIFTS.morning.to;
function helpButtons(w, it) {
  return ROUTINE.map((step) => {
    const chosen = w.chosenFor(step.id, it.id);
    const who = (id) => w.byId(id)?.name.split(' ')[0];
    let sub;
    if (!onMorningShift(step)) sub = chosen ? `${who(chosen)} · off shift then` : 'Off shift: on their own';
    else if (chosen) sub = `${who(chosen)} (chosen)`;
    else {
      // Auto names who normally does it: the first team member whose role fits (busy right now or not).
      const fit = w.staff.find((p) => step.roles.includes(p.role));
      sub = fit ? `Auto · ${who(fit.id)}` : 'Auto · no one on the team fits';
    }
    return { id: `help:${step.id}`, label: step.name, sub, accent: chosen ? COL.action : COL.progress, onTap: () => openPicker(step.id, it.id) };
  });
}
// "Who helps with breakfast?": Auto, or any team member. A role that doesn't fit is refused in plain words.
function openPicker(stepId, residentId) {
  let message = null;
  sheet.open(() => {
    const w = open?.world;
    const step = ROUTINE.find((s) => s.id === stepId);
    const it = w?.residentById(residentId);
    if (!w || !step || !it) return { title: '', sections: [] };
    const needs = step.roles.map((r) => ROLES[r].name).join(' or ');
    const lines = [];
    if (message) lines.push({ text: message, color: COL.bad });
    if (!onMorningShift(step)) lines.push({ text: `No one is on shift at ${clockText(step.at)}: ${first(it.name)} manages on their own until more shifts arrive.`, color: COL.textMuted });
    const chosen = w.chosenFor(stepId, residentId);
    const pick = (id) => {
      const r = w.assign(stepId, id, residentId);
      if (!r.ok) {
        message = r.reason;
        return;
      }
      autosave.request('assign');
      openHomeSheet(residentId);
    };
    return {
      title: `Who helps ${first(it.name)} with ${step.activity ? step.name : step.name.toLowerCase()}?`,
      subtitle: `Needs a ${needs} · ${step.task.replace(/\bhim\b/g, theirOf(it.id) === 'her' ? 'her' : 'him')} · from ${clockText(step.at)}`,
      art: it.art,
      accent: paletteById(open.data.facility.palette).hex,
      sections: [
        { lines },
        {
          columns: 1,
          buttons: [
            { id: 'pick:auto', label: 'Auto', sub: 'Staff pick it themselves by urgency, role, familiarity and distance', accent: chosen ? COL.progress : COL.good, onTap: () => pick(null) },
            ...w.staff.map((p) => {
              const fits = step.roles.includes(p.role);
              return { id: `pick:${p.id}`, label: p.name, sub: `${ROLES[p.role].name}${fits ? '' : ' · role does not fit'}${chosen === p.id ? ' · chosen' : ''}`, icon: p.art, accent: !fits ? COL.textFaint : chosen === p.id ? COL.good : COL.progress, onTap: () => pick(p.id) };
            }),
            { id: 'pick:back', label: `‹ Back to ${first(it.name)}`, accent: COL.progress, onTap: () => openHomeSheet(residentId) },
          ],
        },
      ],
    };
  });
}
// The staff card (Milestone 3): portrait with the role badge, FOUNDER tag, tier and level, five stat bars, Energy and
// Morale, the trait, the shift and what they are doing now; Milestone 6: how familiar they are with each resident.
function staffMenu(w, p, accent) {
  const m = p.model;
  const cap = TIERS[m.tier]?.statCap ?? 220;
  const trait = TRAITS[m.traits[0]];
  const isFounder = w.staffState.founder.id === p.id;
  const h = w.staffState.founder.history;
  const status = [m.status.tired && 'Tired', m.status.stressed && 'Stressed'].filter(Boolean);
  const fam = w.residents.map((r) => `${first(r.name)} ${familiarityOf(w.care, r.id, p.id)}${w.mostFamiliar(r.id) === p.id ? ' (most familiar)' : ''}`).join(' · ');
  const sections = [
    { lines: [{ text: w.stateOf(p), color: COL.actionDark }, w.roster.label(p.id), `Tasks helped with: ${m.counters.tasks ?? 0} · Salary ${m.salary} Credits a month`, `Familiar with: ${fam}`] },
    { title: 'Stats', bars: STATS.map((s) => ({ label: s.name, value: m.stats[s.id], max: cap, color: s.id === ROLES[m.role].primaryStat ? COL.action : COL.progress })) },
    { title: status.length ? `Energy and Morale · ${status.join(', ')}` : 'Energy and Morale', bars: [{ label: 'Energy', value: m.energy, color: m.energy < 25 ? COL.bad : COL.good }, { label: 'Morale', value: m.morale, color: m.morale < 25 ? COL.bad : COL.gold }] },
    { title: 'Trait', lines: [trait ? `${trait.name}: ${trait.text}` : 'None'] },
  ];
  if (isFounder) {
    const f = FOUNDERS.find((x) => x.id === p.id);
    sections.push({ title: 'Founding Staff', lines: [`${f.perk.name}: ${f.perk.text}`, `With you since Day 1 · ${h.daysEmployed} days (${yearsEmployed(h)} years) · ${h.careTasks} care tasks`] });
  }
  return { title: p.name, subtitle: `${ROLES[m.role].name} · ${TIERS[m.tier]?.name ?? m.tier} · Lv ${m.level}`, art: p.art, badge: ROLES[m.role].badge, tag: isFounder ? { text: 'FOUNDER' } : null, accent, sections };
}
// from: 'residents' / 'roster' when opened from a bottom-bar list (Milestone 5) — the card then has a way back to it.
const BACK_TO = { residents: { label: '‹ Back to residents', open: () => openResidents() }, roster: { label: '‹ Back to the team', open: () => openRoster() } };
function openHomeSheet(id, from = null) {
  if (open?.world.residentById(id)) markMissedSeen(id);
  const back = BACK_TO[from];
  const withBack = (menu) => (back ? { ...menu, sections: [{ columns: 1, buttons: [{ id: 'back', label: back.label, accent: COL.progress, onTap: back.open }] }, ...menu.sections] } : menu);
  sheet.open(() => {
    const w = open?.world;
    const it = w?.byId(id);
    if (!it) return { title: '', sections: [] };
    const accent = paletteById(open.data.facility.palette).hex;
    if (it.kind === 'resident') return withBack({ title: it.name, subtitle: it.line, art: it.art, accent, sections: residentSections(w, it) });
    if (it.kind === 'staff') return withBack(staffMenu(w, it, accent));
    const here = w.people.filter((p) => w.whereIs(p) === it.id).map((p) => p.name.split(' ')[0]);
    const lines = [here.length ? `Here now: ${here.join(' and ')}` : 'Nobody here right now'];
    let sub = it.def.text;
    const sections = [{ lines }];
    if (it.kind === 'room') {
      const who = it.residentId ? w.byId(it.residentId) : null;
      const n = ROOM_IDS.indexOf(it.id) + 1;
      sub = who ? `Room ${n} · ${who.name}'s room` : `Room ${n} · Empty`;
      lines.unshift(who ? `Resident: ${who.name} (${who.def.support})` : 'Empty: ready for a new resident. Admit one from Care → Admissions.');
      if (!who) sections.push({ columns: 1, buttons: [{ id: 'room:admissions', label: 'Admissions', sub: `${w.admissions.board.length} applying`, icon: CARE_ICONS.admissions, accent: COL.action, onTap: () => openAdmissions() }] });
    }
    return { title: it.def.name, subtitle: sub, art: it.def.art, accent, sections };
  });
}
// Leaving the home for the Main Menu: save the run first; a reload after this opens the menu again.
async function leaveHome() {
  rememberHome(null);
  router.go('menu');
  await autosave.flush();
  await campaigns.refresh();
  open = null;
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
  window.__cw = { renderer, layout, input, loop, router, assets, sheet, dialog, systemBack, textPrompt, menuScreen, slotsScreen, setupScreen, homeScreen, topBar, topBarCredits: () => balanceNow(), bottomBar, vfx, carePops, dayBeat, openBottom, get lastRoute() { return lastRoute; }, playSlot, startFacility, deleteSlot, newGame, taps: [], autosave, saveRun, get campaigns() { return campaigns; }, get open() { return open; } };
}

router.go('boot');
loop.start();
