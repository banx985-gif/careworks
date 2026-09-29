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
// Milestone 7: Staff opens the roster sheet — Morning / Afternoon / Night / Off columns (tap someone, then a column, to
// move them), a Safe Coverage bar per shift, Float toggles, the Night on-call flag and the coverage log; a red badge on
// Staff (and a banner in the home) while a shift is short or about to start short. The Ledger shows agency fees, care
// recovery and the unsafe-shift counter.
// Milestone 8: the Care Plan picker shows all eight options of a domain — greyed with the reason when not eligible,
// the resident's like / dislike / refusal marked; tapping one shows what it does and a Choose button (a disliked
// option says its Mood cost first). A plan due for review gets an amber dot on the card's Care Plan header, counts on
// Care's badge and is listed under Care → "Plans to review"; Reviewed clears it.
// Milestone 9: all 60 residents. Applicant and resident cards show the stay type and its length (Respite / Rehab end
// with "Arthur heads home", the room freed), a Returning tag, the life-story line and tags. ?debug=1 adds "Spawn all 60"
// under Care: a test home (never saved) where every resident comes in, walks to a spot and has their card opened once.
// Milestone 10: Develop opens Build Mode (rooms and facilities: place, move, sell for 50% back) and the home's stage
// (S2 "Locked — needs Rank D"; ?debug=1 upgrades now, and unlocks every room and facility). The Build list is a sheet
// of every room and facility with its picture, cost and effect (locked ones greyed with the reason; the two secret
// ones never listed). Selling asks first. Growing to Stage 2 plays the big "Expanded Care Home" moment.
// Milestone 11: Staff → Recruit (or the Reception / Family Desk): a board of three candidates from the channels (Local
// Applicants open; the ranked ones locked with the reason, ?debug=1 opens them), a free new board every 56 days and
// paid ones; each candidate's card (portrait, role, tier, level, stats, salary, trait, shift preference) with Hire —
// greyed at the Rank E cap of 12. The staff card gains Specialties, Training (a course list with what each would add,
// "Would reach cap" when the tier cap trims it) and Let go (asks first; the Founder twice).
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
import { NEEDS, OUTCOMES, RESIDENTS, validateResidents, supportLevel, ROOM_TEMPLATES, STAYS } from '../data/residents.js';
import { DataValidator } from '../../../core/DataValidator.js';
import { ROUTINE, LOG_SHOWN, BANDS } from '../data/routine.js';
import { ROLES, STATS, TIERS } from '../data/roles.js';
import { TRAITS, STAFF, validateStaff } from '../data/staff.js';
import { SHIFTS, FEES, SHORT_STAFFING, ON_CALL } from '../data/balance.js';
import { SHIFT_IDS, OFF, WINGS } from '../data/shifts.js';
import { ADMISSION } from '../data/admissions.js';
import { STAGES } from '../data/home.js';
import { CHANNELS, RANK_NOW } from '../data/recruitment.js';
import { SPECIALTIES } from '../data/training.js';
import { ROOMS } from '../data/rooms.js';
import { BUILDABLE_FACILITIES } from '../data/facilities.js';
import { FOUNDERS } from '../data/setup.js';
import { DOMAINS, CARE_OPTIONS, optionById, optionsFor, validateCarePlans, OPTION_PREF_MOOD } from '../data/carePlans.js';
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
    tickSpawnCheck(dt); // (?debug=1 "Spawn all 60", Milestone 9)
    if (open && router.currentName === 'home') open.data.playSec = (open.data.playSec ?? 0) + dt;
    vfx.update(dt); // real seconds: pops keep their pace at any game speed
    carePops.update(dt);
    dayBeat.update(dt);
    if (bigBeat && (bigBeat.age += dt) >= BIG_BEAT_LIFE) bigBeat = null;
    autosave.tick(dt);
    dialog.update(dt);
    sheet.update(dt);
  },
  render: (alpha) => {
    const ctx = renderer.begin(COL.bg);
    router.render(ctx, alpha);
    sheet.render(ctx);
    if (router.currentName === 'home') drawBigBeat(ctx);
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
  // Milestone 11: a double-tap on a station jumps the camera to it, even when its sheet has just slid up under the finger
  {
    get active() {
      return router.currentName === 'home';
    },
    handleInput: (hook, p) => hook === 'onTap' && homeScreen.doubleTap(p),
  },
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
let spawn = null; // Milestone 9: ?debug=1 "Spawn all 60" while it runs: { real (the campaign's world), world, ids, i, t, phase, errors, starts, report }

// A campaign's world (Milestone 2): its clock and the residents' saved states, the team from its Founder; Milestone 6:
// the applicant board and the ledger (an older save's ledger opens with its saved Credits).
function openRun(n, data) {
  const clock = makeClock(bus);
  if (data.clock) clock.load(data.clock);
  const world = createHomeWorld({ founderId: data.facility.founder?.id, clock, residents: data.residents, staff: data.staff, care: data.care, seed: data.seed, bus, admissions: data.admissions, ledger: data.ledger, layout: data.layout, startCredits: data.economy?.credits ?? ECONOMY_START.credits });
  if (world.fixedUp.length) debug.log(`layout fix-up: ${world.fixedUp.map((m) => m.id).join(', ')} moved`);
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
  if (!o || spawn) return Promise.resolve(); // (the spawn check's test home is never saved)
  const c = o.world.clock;
  o.data = { ...o.data, ...o.world.serialize(), date: { year: c.year, month: c.month, day: c.day } };
  o.data.economy = { ...(o.data.economy ?? ECONOMY_START), credits: o.world.ledger.balance }; // (the ledger is the truth; this is the summary)
  return campaigns.save(o.n, o.data);
}
// Autosave (core/Autosave): the series cadence (every game day, a rolling save, and when the app goes to the
// background) plus every band change, each routine step and a pause.
const autosave = new Autosave({
  bus,
  triggers: ['clock:day', 'care:band', 'care:step', 'care:task', 'care:bell', 'care:plan', 'clock:speed', 'staff:onShift', 'staff:offShift', 'care:admit', 'care:joined', 'admissions:change', 'ledger:close', 'admissions:action', 'care:review', 'coverage:shift', 'coverage:warning', 'staff:agencyLeft', 'care:leaving', 'care:left', 'home:layout', 'home:stage', 'staff:hired', 'staff:letGo', 'staff:training', 'staff:trained', 'staff:left'],
  save: () => saveRun(),
  stamp: () => (open && !spawn ? JSON.stringify(open.world.serialize()) : null),
  running: () => !!open && !spawn && router.currentName === 'home' && !open.world.clock.paused,
  enabled: () => !!open && !spawn,
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
  const n = open.world.bells.length + missedToday().filter((t) => !open.seenMissed.has(t.id)).length + open.world.stalePlans().length; // Milestone 8: + plans to review
  return n || null;
}
// Staff's badge (Milestone 7): the shifts short now, or about to start short (from the band before).
const staffBadge = () => (open ? open.world.coverage.warnings().length || null : null);
const markMissedSeen = (residentId = null) => {
  for (const t of missedToday()) if (!residentId || t.resident === residentId) open?.seenMissed.add(t.id);
};
const bottomBar = createBottomBar({
  layout,
  assets,
  items: BOTTOM_SLOTS.map((s) => ({ id: s.id, label: s.label, icon: s.icon, badge: s.id === 'care' ? careBadge : s.id === 'staff' ? staffBadge : null })),
  open: (id) => openBottom(id),
});
const vfx = new VfxSystem({ assets, width: W, height: renderer.height, font: THEME.family, maxTexts: 4, maxEffects: 16 });
const dayBeat = createDayBeat();
const homeScreen = createHomeScreen({ renderer, layout, assets, bus, sheet, campaign: () => open, world: () => open?.world ?? null, openSheet: (kind, id) => openHomeSheet(id), onMenu: () => leaveHome(), topBar, bottomBar, vfx, dayBeat, debug, onStaffWarning: () => openRoster(), onShop: () => openBuildList(), onSell: (it) => confirmSell(it) });
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

// Milestone 9: a respite / short-stay resident heads home at the end of their stay — a good outcome (medium beat).
bus.on('care:leaving', ({ name }) => {
  if (open && router.currentName === 'home') dayBeat.showText(`${first(name)} heads home`, true);
  debug.log(`went home: ${name}`);
});

// Milestone 11: a new hire walks in (medium beat); a course is finished.
bus.on('staff:hired', ({ name }) => {
  if (open && router.currentName === 'home') dayBeat.showText(`Welcome to the team, ${first(name)}`, true);
  debug.log(`hired: ${name}`);
});
bus.on('staff:trained', ({ name, course, specialty }) => {
  if (open && router.currentName === 'home') dayBeat.showText(`${first(name)} finished ${course}${specialty ? ` · ${SPECIALTIES[specialty].name}` : ''}`, true);
  debug.log(`trained: ${name} · ${course}`);
});

// Where each bottom-bar slot goes (data/bars.js).
function openBottom(id) {
  const r = bottomRoute(id);
  if (!r || !open) return;
  if (r.sheet === 'residents') openResidents();
  else if (r.sheet === 'roster') openRoster();
  else if (r.slot.id === 'business') openBusiness();
  else if (r.slot.id === 'develop') openDevelop();
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
        ...(() => {
          const stale = w.stalePlans();
          return stale.length
            ? [{ title: 'Plans to review', titleDot: COL.warn, columns: 1, buttons: stale.map((x) => {
              const r = w.residentById(x.resident);
              return { id: `review:${r.id}`, label: r.name, sub: x.reasons[0].text + (x.reasons.length > 1 ? ` (+${x.reasons.length - 1} more)` : ''), icon: r.art, iconCrop: PORTRAIT_CROP, accent: COL.warn, onTap: () => openFrom(r.id, 'residents') };
            }) }]
            : [];
        })(),
        { title: 'Admissions', columns: 1, buttons: [{ id: 'admissions', label: 'Admissions', sub: `${adm.board.length} applying · ${adm.waiting.length} on the waiting list`, icon: CARE_ICONS.admissions, badge: adm.board.length || null, accent: COL.action, onTap: () => openAdmissions() }] },
        ...(debug.enabled && !spawn ? [{ title: 'Debug', columns: 1, buttons: [{ id: 'debug:spawn60', label: 'Spawn all 60', sub: 'A test home (never saved): everyone comes in, walks to a spot, has their card opened once, then it clears', accent: COL.progress, onTap: () => startSpawnCheck() }] }] : []),
      ],
    };
  });
}
// Staff (Milestone 7): the roster sheet. Three shift columns and Off, each with who is on it (portrait + role badge);
// tap someone, then a column, to move them. A Safe Coverage bar per shift (green ≥ 100%, amber 80–99%, red below), the
// warnings, a Float toggle and card per team member, the Night on-call flag and the coverage log.
const shiftTime = (sid) => `${clockText(SHIFTS[sid].from)}–${clockText(SHIFTS[sid].to)}`;
const COVER_COLOUR = { good: COL.good, amber: COL.gold, red: COL.bad };
const PREF_WORD = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' };
const PEAK_WORDS = { wake: 'wake-ups', meal: 'meals', meds: 'medicine rounds', personal: 'personal care', activity: 'activities', observation: 'health checks', settle: 'settling', bell: 'call bells', roomCheck: 'room checks' };
let rosterPick = null; // the team member picked to move
function openRoster() {
  rosterPick = null;
  let message = null;
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const r = w.roster;
    const cov = w.coverage;
    const status = cov.status();
    const warns = cov.warnings();
    const t = w.clock.totalDays * 24 + w.hour;
    const picked = rosterPick && w.byId(rosterPick);
    const lines = [];
    if (message) lines.push({ text: message, color: COL.bad });
    for (const a of warns) lines.push({ text: `${SHIFTS[a.shift].name} ${a.running ? 'is running short' : `starts short at ${clockText(SHIFTS[a.shift].from)}`}: ${a.reasons.join(', ')}.`, color: COL.bad });
    lines.push({ text: picked ? `Moving ${first(picked.name)}: tap Morning, Afternoon, Night or Off.` : 'Tap someone, then a shift (or Off), to move them. Off shift they rest in the Staff Room.', color: COL.textMuted });
    // One card per person working (or rostered on) each shift; agency workers and float cover for the shift now / next.
    const card = (p, sid) => {
      const ag = r.agencyOf(p.id);
      const cover = !ag && sid !== OFF && r.shiftOf(p.id)?.id !== sid;
      const tag = r.isTraining(p.id) ? 'TRAINING' : ag ? 'AGENCY' : cover ? 'COVER' : r.isFloat(p.id) ? 'FLOAT' : null;
      return {
        id: `roster:${sid}:${p.id}`,
        label: first(p.name),
        sub: `${ROLES[p.role].short} · E ${Math.round(p.model.energy)}`,
        icon: p.art,
        iconCrop: PORTRAIT_CROP,
        iconBadge: ROLES[p.role].badge,
        tag,
        selected: rosterPick === p.id,
        accent: p.model.status.tired || p.model.status.stressed ? COL.action : COL.progress,
        onTap: () => {
          message = null;
          if (ag || cover) message = ag ? 'Agency cover is booked for this shift only: they leave when it ends.' : `${first(p.name)} is covering this shift as a float; their own shift is ${r.shiftOf(p.id)?.name ?? 'Off'}.`;
          else rosterPick = rosterPick === p.id ? null : p.id;
        },
      };
    };
    const lanes = [...SHIFT_IDS, OFF].map((sid) => {
      const a = status.find((x) => x.shift === sid);
      const ids = sid === OFF ? w.team.filter((p) => !r.shiftOf(p.id) || r.isTraining(p.id)).map((p) => p.id) : a.staff; // (Milestone 11: trainees under Off)
      const people = ids.map((id) => w.byId(id)).filter(Boolean);
      return {
        id: `lane:${sid}`,
        title: sid === OFF ? 'Off' : SHIFTS[sid].name,
        sub: sid === OFF ? `${people.length} resting` : `${shiftTime(sid)} · ${a.pct}%`,
        accent: sid === OFF ? COL.progress : COVER_COLOUR[a.safe ? 'good' : a.colour === 'good' ? 'red' : a.colour],
        selected: !!picked && (sid === OFF ? !r.shiftOf(picked.id) : r.shiftOf(picked.id)?.id === sid),
        empty: sid === OFF ? 'Nobody off' : 'Nobody on',
        items: people.map((p) => card(p, sid)),
        onTap: () => {
          message = null;
          if (!rosterPick) {
            message = 'Tap someone first, then the shift to move them to.';
            return;
          }
          const res = w.moveStaff(rosterPick, sid);
          if (!res.ok) message = res.reason;
          else autosave.request('roster');
          rosterPick = null;
        },
      };
    });
    const bars = status.map((a) => ({ label: `${SHIFTS[a.shift].name} ${shiftTime(a.shift)}`, value: a.provided, max: Math.max(a.required, 0.1), color: COVER_COLOUR[a.colour], text: `${a.pct}%` }));
    const detail = status.map((a) => {
      const T = SHIFTS[a.shift];
      const rn = a.rnOn ? 'RN on shift' : a.onCallUsed ? 'RN on call' : T.clinical?.rn ? 'no RN' : 'no RN needed';
      const call = a.onCallPoints ? ` (${a.onCallPoints.toFixed(1)} from the nurse on call)` : '';
      return { text: `${T.name}: needs ${a.required.toFixed(1)} points, has ${a.provided.toFixed(1)}${call} · ${rn} · busiest with ${T.peaks.map((k) => PEAK_WORDS[k] ?? k).join(', ')}`, color: a.safe ? COL.textMuted : COL.bad };
    });
    const teamRows = [];
    for (const p of w.team) {
      const m = p.model;
      const pref = STAFF.find((d) => d.id === p.id)?.shiftPref;
      const shift = r.shiftOf(p.id);
      teamRows.push({ id: `staff:${p.id}`, label: p.name, sub: `${shift ? shift.name : 'Off'} · likes ${PREF_WORD[pref] ?? '—'} · E ${Math.round(m.energy)} · M ${Math.round(m.morale)}`, icon: p.art, iconCrop: PORTRAIT_CROP, iconBadge: ROLES[m.role].badge, accent: m.status.tired || m.status.stressed ? COL.action : COL.progress, onTap: () => openFrom(p.id, 'roster') });
      const float = r.isFloat(p.id);
      teamRows.push({ id: `float:${p.id}`, label: `Float: ${float ? 'On' : 'Off'}`, sub: float ? 'Not tied to a wing · covers short shifts' : `${WINGS.find((x) => x.id === r.wingOf(p.id))?.name ?? 'No'} wing`, accent: float ? COL.good : COL.progress, onTap: () => {
        w.setFloat(p.id, !float);
        autosave.request('roster');
      } });
    }
    const hist = [...cov.state.history].reverse().slice(0, 3).map((h) => ({ text: `Day ${w.clock.dateOf(h.day).day} ${SHIFTS[h.shift].name}: ${h.before}%${h.steps.length ? ` → ${h.steps.map((x) => ({ float: 'float', agency: 'agency', scaleBack: 'scaled back', unsafe: 'unsafe' })[x]).join(', ')} → ${h.after}%` : ''}`, color: h.safe ? COL.textMuted : COL.bad }));
    const log = [...cov.state.log].reverse().slice(0, 6).map((l) => ({ text: `Day ${w.clock.dateOf(l.day).day} ${l.t} · ${l.text}`, color: /Warning|Unsafe|scaled|No agency/.test(l.text) ? COL.bad : COL.text }));
    return {
      title: 'Roster',
      subtitle: `Staff ${w.team.length} / ${w.staffing.cap} · three shifts · Safe Coverage for each`,
      art: 'care_ui_02',
      accent: accentNow(),
      sections: [
        { lines, lanes },
        { columns: 1, buttons: [{ id: 'recruit', label: 'Recruit', sub: `${w.staffing.board.length} candidates · Staff ${w.team.length} / ${w.staffing.cap} (Rank ${RANK_NOW})`, icon: 'care_ui_02', accent: COL.action, onTap: () => openRecruit() }] },
        { title: 'Safe Coverage', bars, lines: detail },
        { title: 'Team', columns: 2, buttons: teamRows },
        {
          title: 'Nurse on call',
          lines: [{ text: `While the home is small and nobody needs much clinical care, a Registered Nurse on call covers the RN rule and adds cover. Afternoon: up to ${ON_CALL.maxResidents.afternoon} residents.`, color: COL.textMuted }],
          columns: 1,
          buttons: [
            { id: 'onCall', label: `RN on call at night: ${r.onCall ? 'On' : 'Off'}`, sub: r.onCall ? 'A Registered Nurse on the team answers the phone at night' : 'Night then needs an RN on shift', accent: r.onCall ? COL.good : COL.progress, onTap: () => {
              w.setOnCall(!r.onCall);
              autosave.request('roster');
            } },
            { id: 'onCallAfternoon', label: `RN on call in the afternoon: ${r.onCallFor('afternoon') ? 'On' : 'Off'}`, sub: r.onCallFor('afternoon') ? 'Covers the Afternoon while the home is small' : 'The Afternoon then needs an RN on shift', accent: r.onCallFor('afternoon') ? COL.good : COL.progress, onTap: () => {
              w.setOnCall(!r.onCallFor('afternoon'), 'afternoon');
              autosave.request('roster');
            } },
          ],
        },
        { title: 'Coverage log', lines: log.length ? [...hist, ...log] : [{ text: 'Nothing yet: every shift so far started safe.', color: COL.textMuted }] },
      ],
    };
  });
}
// Develop / Quality: what will live there.
// --- Develop and Build Mode (Milestone 10) -----------------------------------------------------------------------------
const stageOf = (n) => STAGES[n - 1];
// Develop: Build Mode, the home's stage and capacity, and (?debug=1) the upgrade and the unlock-all switch.
function openDevelop() {
  const slot = BOTTOM_SLOTS.find((s) => s.id === 'develop');
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const st = w.stage;
    const next = stageOf(st.n + 1);
    const stageRows = [{ id: 'dev:build', label: 'Build Mode', sub: 'Place, move and sell rooms and facilities (50% back when you sell)', icon: slot.icon, accent: COL.action, onTap: () => {
      sheet.close();
      homeScreen.setBuildMode(true);
    } }];
    if (next) stageRows.push({ id: 'dev:stage', label: `Stage ${next.n}: ${next.name}`, sub: `Locked — needs Rank ${next.unlock.value} · room for ${next.capacity} residents and more floor`, disabled: true, accent: COL.progress });
    const dbg = debug.enabled
      ? [{ title: 'Debug', columns: 1, buttons: [
        ...(next ? [{ id: 'dev:upgrade', label: `Upgrade to Stage ${next.n} now (debug)`, sub: 'Skips the Rank D rule for testing', accent: COL.progress, onTap: () => upgradeStage() }] : []),
        { id: 'dev:unlock', label: `Unlock all rooms and facilities (debug): ${w.layout.debugUnlock ? 'On' : 'Off'}`, sub: 'For testing (the two secret facilities stay hidden)', accent: w.layout.debugUnlock ? COL.good : COL.progress, onTap: () => {
          w.build.setDebugUnlock(!w.layout.debugUnlock);
          autosave.request('debug');
        } },
      ] }]
      : [];
    return {
      title: slot.title,
      subtitle: `Stage ${st.n}: ${st.name} · ${w.rooms.length} of ${st.capacity} rooms`,
      art: slot.icon,
      accent: accentNow(),
      sections: [
        { lines: [`Residents live one to a room: ${w.rooms.length} rooms built, ${w.freeRooms().length} free. Stage ${st.n} holds up to ${st.capacity}.`], columns: 1, buttons: stageRows },
        ...dbg,
      ],
    };
  });
}
// The Build list: every room and facility (not the two secret ones) with its picture, cost, what it does or why it is
// locked. Tap one to place it (a ghost in the home).
function openBuildList() {
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const row = (d, kind) => {
      const u = w.layout.unlock(d.id);
      const afford = w.ledger.balance >= d.cost;
      const full = kind === 'room' && w.rooms.length >= w.stage.capacity;
      const why = !u.ok ? u.reason : full ? `Stage ${w.stage.n} holds ${w.stage.capacity} residents` : !afford ? 'Not enough Credits' : null;
      const what = kind === 'room' ? `${d.bestFor} · ${d.effect.text}` : d.effect.text;
      return { id: `buy:${d.id}`, label: `${d.name} · ${credits(d.cost)}`, sub: why ? `${why} · ${what}` : what, icon: d.art, disabled: !!why, accent: kind === 'room' ? COL.action : COL.progress, onTap: () => {
        sheet.close();
        homeScreen.startPlacing(d.id);
      } };
    };
    return {
      title: 'Build',
      subtitle: `${credits(w.ledger.balance)} Credits · Stage ${w.stage.n}: ${w.rooms.length} of ${w.stage.capacity} rooms`,
      art: 'care_ui_03',
      accent: accentNow(),
      sections: [
        { title: 'Rooms', columns: 1, buttons: ROOMS.map((d) => row(d, 'room')) },
        { title: 'Facilities', columns: 1, buttons: BUILDABLE_FACILITIES.map((d) => row(d, 'facility')) },
      ],
    };
  });
}
// Selling asks first (50% back); a room with a resident, or the home's only Dining Room / Nurse Station …, can't go.
function confirmSell(it) {
  const w = open?.world;
  if (!w) return;
  const can = w.build.canSell(it.uid);
  if (!can.ok) return;
  dialog.confirm({
    title: `Sell the ${it.def.name}?`,
    body: `You get ${credits(can.refund)} Credits back (half its price).`,
    art: it.def.art,
    yes: 'Sell',
    danger: true,
    onYes: () => {
      const r = w.build.sell(it.uid);
      if (r.ok) {
        homeScreen.pick(null);
        homeScreen.build.message = { text: `Sold: ${it.def.name} (+${credits(r.refund)} Credits)`, good: true };
        autosave.request('sell');
      }
    },
  });
}
// Stage 1 → 2 (debug for now): the floor grows, nothing moves, and the big moment.
function upgradeStage() {
  const w = open?.world;
  if (!w) return;
  const r = w.build.upgrade();
  if (!r.ok) return;
  sheet.close();
  bigBeat = { title: r.stage.name, text: `Stage ${r.stage.n}: more floor and room for ${r.stage.capacity} residents`, art: r.stage.art, age: 0 };
  autosave.request('stage');
}
// The big feedback beat (style guide: big moments get a picture): shown over the home for a few seconds, tap to close.
let bigBeat = null;
const BIG_BEAT_LIFE = 4.5;
function drawBigBeat(ctx) {
  const b = bigBeat;
  if (!b) return;
  const H = renderer.height;
  const k = Math.min(1, b.age / 0.35) * Math.min(1, (BIG_BEAT_LIFE - b.age) / 0.5);
  ctx.save();
  ctx.globalAlpha = Math.max(0, k);
  ctx.fillStyle = 'rgba(30, 24, 18, 0.55)';
  ctx.fillRect(0, 0, W, H);
  const w = Math.min(W - 120, 820);
  const h = w / assets.aspect(b.art);
  const x = (W - w) / 2;
  const y = H / 2 - h / 2 - 120;
  assets.draw(ctx, b.art, x, y, w, h);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = font(THEME.size.major, true);
  ctx.fillText(b.title, W / 2, y + h + 110);
  ctx.font = font(THEME.size.body, false);
  ctx.fillText(b.text, W / 2, y + h + 190);
  ctx.restore();
}

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
    // Milestone 7: agency fees and care recovery post as they happen; the unsafe-shift counter
    const live = w.ledger.economy.ledger.filter((l) => l.day >= range.fromDay && (l.category === 'agency' || l.category === 'careRecovery'));
    const sum = (cat) => live.filter((l) => l.category === cat).reduce((t, l) => t + l.amount, 0);
    const nAgency = live.filter((l) => l.category === 'agency').length;
    const unsafe = w.staffState.coverage.unsafe;
    const shortLines = [
      { text: `Agency cover: ${nAgency} shift${nAgency === 1 ? '' : 's'} · ${nAgency ? '−' : ''}${credits(-sum('agency'))} (${SHORT_STAFFING.agencyFeePerShift} a shift)`, color: nAgency ? COL.bad : COL.textMuted },
      { text: `Care recovery for missed essential tasks: ${sum('careRecovery') ? '−' : ''}${credits(-sum('careRecovery'))} (${SHORT_STAFFING.careRecoveryPerMissed} each)`, color: sum('careRecovery') ? COL.bad : COL.textMuted },
      { text: `Unsafe shifts so far: ${unsafe} (run under minimum with no agency cover)`, color: unsafe ? COL.bad : COL.textMuted },
    ];
    const sections = [
      { lines: [{ text: `Balance: ${credits(b)} Credits`, color: b < 0 ? COL.bad : COL.actionDark }, ...(b < 0 ? [{ text: 'Below zero. There is no debt system yet: the home carries on.', color: COL.bad }] : [])] },
      { title: `This month so far (Month ${c.month}, Year ${c.year})`, lines: [{ text: 'Paid at the month\'s close: fees and funding for each resident\'s days here, wages in full.', color: COL.textMuted }, ...ledgerLines(soFar)] },
      { title: 'Short staffing this month (paid as it happens)', lines: shortLines },
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
      return { id: `app:${app.id}`, label: `${def.name}, ${def.age}${app.returning ? ' · Returning' : ''}`, sub: `${def.support} · ${stayWords(def, app.stayDays)} · ${status} · ${p.ok ? 'Ready' : p.text}`, icon: def.art, iconCrop: PORTRAIT_CROP, accent: p.ok ? COL.progress : COL.textFaint, onTap: () => openApplicant(app.id) };
    };
    const free = w.freeRooms().length;
    return {
      title: 'Admissions',
      subtitle: `${free} of ${w.rooms.length} rooms free (Stage ${w.stage.n} holds ${w.stage.capacity}) · new applicants every few days`,
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
    const nextRoom = w.roomsFor(id)[0];
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
    if (app.returning) lines.push({ text: `Returning: ${first(def.name)} stayed here before and went home. Familiar Care is kept.`, color: COL.good });
    lines.push({ text: `Stay: ${stayWords(def, app.stayDays, true)}`, color: COL.actionDark });
    lines.push(`Wants: ${ROOM_TEMPLATES[def.room].name} · Urgency: ${def.urgency}`);
    lines.push(`Support Level ${level} · Care Support Funding ${credits(FEES.careSupportFundingByLevel[level])} a month · fee ${credits(FEES.accommodationPerMonth)} a month`);
    lines.push(`Visitors: ${def.visitors} · ${def.personality} · enjoys ${def.interest}`);
    lines.push({ text: def.story, color: COL.textMuted });
    lines.push({ text: `Life story: ${def.tags.join(' · ')}`, color: COL.textMuted });
    lines.push({ text: wait ? `On the waiting list: ${days} day${days === 1 ? '' : 's'} left before they look elsewhere` : `Applying: ${days} day${days === 1 ? '' : 's'} before they look elsewhere if nobody answers`, color: COL.textMuted });
    if (app.assessReady != null && ctx.day < app.assessReady) lines.push({ text: 'Assessment update under way: back tomorrow.', color: COL.actionDark });
    else if (app.assessed) lines.push({ text: 'Assessment updated.', color: COL.textMuted });
    return {
      title: def.name,
      subtitle: `${def.age} · ${def.support} · ${stayWords(def, app.stayDays)}${app.returning ? ' · Returning' : ''}`,
      art: def.art,
      accent: accentNow(),
      sections: [
        { lines },
        { title: 'Needs', lines: [{ text: 'How much support they need now (their assessment)', color: COL.textMuted }], bars: NEEDS.map((n) => ({ label: n.name, value: app.needs[n.id], color: COL.progress })) },
        {
          columns: 1,
          buttons: [
            { id: 'act:admit', label: 'Admit now', sub: can.ok ? `Room ${w.roomNumber(nextRoom?.id)} · walks in now, joins the routine from the next band` : can.reason, disabled: !can.ok, accent: COL.good, onTap: () => act(() => w.admit(id), () => {
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

// Milestone 9: "Respite · 21 days" (long: "Respite · 21 days, then home"; Long Term: "Long Term").
function stayWords(def, days, long = false) {
  const t = STAYS[def.stay]?.text ?? def.stay;
  if (days == null) return long ? `${t} (stays)` : t;
  return long ? `${t} · ${days} days, then home (the room frees up)` : `${t} · ${days} days`;
}
// The resident card's stay line: how long is left, or Long Term.
function stayLine(w, it) {
  const st = it.state;
  const t = STAYS[it.def.stay]?.text ?? it.def.stay;
  if (st.leaving) return `${t}: the stay is over, heading home today`;
  if (!st.stay) return `${t}: no set end`;
  const left = w.stayDaysLeft(it.id);
  if (st.stay.opening && !w.residents.some((q) => q !== it && !q.state.leaving && !q.state.guest)) return `${t}: stays on while ${theirOf(it.id) === 'her' ? 'she is' : 'he is'} the only resident (${left} day${left === 1 ? '' : 's'} left once someone else moves in)`;
  const d = w.clock.dateOf(st.stay.leaveDay);
  return left === 0 ? `${t}: heads home today` : `${t}: heads home on Day ${d.day}, Month ${d.month} (${left} day${left === 1 ? '' : 's'} left)`;
}

// --- ?debug=1 "Spawn all 60" (Milestone 9) -----------------------------------------------------------------------------
// A test home in place of the campaign's (never saved, autosave off): every resident not in it comes in as a guest
// (ignoring rooms and capacity), walks to a spot, and each card is opened once and drawn. Then the test home clears
// and the campaign comes back as it was. Result: window.__cw.spawnReport and a sheet.
const SPAWN_WALK_SEC = 1.5; // walking before the cards
const SPAWN_CARD_FRAMES = 3; // frames each card stays open (it is drawn)
function startSpawnCheck() {
  if (!open || spawn) return;
  sheet.close();
  homeScreen.selection.clear();
  const real = open.world;
  const world = createHomeWorld({ founderId: open.data.facility.founder?.id, seed: 'spawn-check' });
  const guests = world.spawnGuests();
  const people = world.residents;
  spawn = { real, world, ids: people.map((p) => p.id), starts: new Map(people.map((p) => [p.id, { x: p.agent.x, y: p.agent.y }])), i: 0, t: 0, frames: 0, phase: 'walk', errors: [], cards: 0, guests: guests.length, started: performance.now() };
  open.world = world;
  homeScreen.enter(); // the home screen now draws and moves the test home (same slot: the view is kept)
  assets.startTracking();
  debug.log(`spawn check: ${people.length} residents in the test home`);
}
function tickSpawnCheck(dt) {
  const s = spawn;
  if (!s) return;
  s.t += dt;
  if (s.phase === 'walk') {
    if (s.t >= SPAWN_WALK_SEC) s.phase = 'cards';
    return;
  }
  if (s.phase === 'cards') {
    if (s.frames === 0) {
      const id = s.ids[s.i];
      const it = s.world.byId(id);
      try {
        if (!it) throw new Error('not in the test home');
        residentSections(s.world, it); // the card's content builds without an error
        homeScreen.selection.select(it);
        openHomeSheet(id);
        s.cards++;
      } catch (err) {
        s.errors.push(`${id}: ${err.message}`);
      }
    }
    if (++s.frames >= SPAWN_CARD_FRAMES) {
      s.frames = 0;
      if (++s.i >= s.ids.length) finishSpawnCheck();
    }
  }
}
function finishSpawnCheck() {
  const s = spawn;
  const track = assets.trackingReport();
  assets.stopTracking();
  const moved = s.world.residents.filter((p) => {
    const a = s.starts.get(p.id);
    return p.agent.state !== 'walking' || Math.hypot(p.agent.x - a.x, p.agent.y - a.y) > 1;
  }).length;
  const defs = s.ids.map((id) => s.world.byId(id)?.def).filter(Boolean);
  const artDrawn = defs.filter((d) => assets.has(d.art) && track?.drawn[d.art] && !track.fallbacks[d.art]).length;
  const missingArt = defs.filter((d) => !(assets.has(d.art) && track?.drawn[d.art] && !track.fallbacks[d.art])).map((d) => d.id);
  sheet.close();
  homeScreen.selection.clear();
  s.world.clearGuests();
  open.world = s.real;
  spawn = null;
  homeScreen.enter(); // back to the campaign's own home
  const report = { residents: s.ids.length, guests: s.guests, cards: s.cards, artDrawn, missingArt, walked: moved, errors: s.errors, seconds: +((performance.now() - s.started) / 1000).toFixed(1), ok: s.ids.length === RESIDENTS.length && s.cards === s.ids.length && artDrawn === s.ids.length && moved === s.ids.length && !s.errors.length };
  if (window.__cw) window.__cw.spawnReport = report;
  debug.log(`spawn check: ${report.cards}/${report.residents} cards, ${report.artDrawn} portraits, ${report.errors.length} errors`);
  sheet.open(() => ({
    title: 'Spawn check',
    subtitle: report.ok ? `All ${report.residents} residents spawned, walked, drew their portrait and card` : 'Problems found',
    accent: report.ok ? COL.good : COL.bad,
    sections: [
      { lines: [`Residents in the test home: ${report.residents} of ${RESIDENTS.length}`, `Cards opened and drawn: ${report.cards}`, `Portraits drawn: ${report.artDrawn}`, `Walked to a spot: ${report.walked}`, `Took ${report.seconds} s · the test home is cleared, your home is as it was`, ...report.errors.map((e) => ({ text: e, color: COL.bad })), ...(report.missingArt.length ? [{ text: `Art not drawn: ${report.missingArt.join(', ')}`, color: COL.bad }] : [])] },
      { columns: 1, buttons: [{ id: 'spawn:close', label: 'Close', accent: COL.progress, onTap: () => sheet.close() }] },
    ],
  }));
}

// --- Recruitment and training (Milestone 11) ---------------------------------------------------------------------------
const STAT_WORDS = Object.fromEntries(STATS.map((x) => [x.id, x.id]));
// Staff → Recruit: the board of three, the next free board, and a paid board from each channel (locked ones greyed with
// the reason; ?debug=1 opens them).
function openRecruit() {
  let message = null;
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const sf = w.staffing;
    const daysToFree = Math.max(0, sf.nextFreeDay - w.clock.totalDays);
    const full = w.team.length >= sf.cap;
    const cards = sf.board.map((c) => ({ id: `cand:${c.id}`, label: `${c.name} · ${TIERS[c.tier].name}`, sub: `${ROLES[c.role].name} · Lv ${c.level} · ${c.salary} a month · ${TRAITS[c.trait]?.name ?? ''}`, icon: c.art, iconCrop: PORTRAIT_CROP, iconBadge: ROLES[c.role].badge, accent: c.tier === 'rare' ? COL.gold : COL.progress, onTap: () => openCandidate(c.id) }));
    const chans = sf.channels().map(({ channel: c, ok, reason }) => ({ id: `chan:${c.id}`, label: c.id === 'special' ? c.name : `${c.name} · ${credits(c.cost)}`, sub: ok ? c.text : `${reason} · ${c.text}`, disabled: !ok || c.id === 'special', accent: COL.progress, onTap: () => {
      const r = sf.refresh(c.id);
      message = r.ok ? { text: `A new board from ${c.name}`, good: true } : { text: r.reason, good: false };
      if (r.ok) autosave.request('recruit');
    } }));
    const lines = [];
    if (message) lines.push({ text: message.text, color: message.good ? COL.good : COL.bad });
    lines.push({ text: `Staff ${w.team.length} / ${sf.cap} (Rank ${RANK_NOW})${full ? ': the team is full' : ''} · a free new board in ${daysToFree} day${daysToFree === 1 ? '' : 's'}`, color: full ? COL.bad : COL.textMuted });
    return {
      title: 'Recruit',
      subtitle: 'Candidates for the team · hire someone to have them walk in',
      art: 'care_ui_02',
      accent: accentNow(),
      sections: [
        { lines },
        cards.length ? { title: 'Candidates', columns: 1, buttons: cards } : { title: 'Candidates', lines: [{ text: 'Nobody on the board: try a new board.', color: COL.textMuted }] },
        { title: 'A new board now', columns: 1, buttons: chans },
        ...(debug.enabled ? [{ title: 'Debug', columns: 1, buttons: [{ id: 'chan:debug', label: `Open every channel and training without a room (debug): ${sf.debug ? 'On' : 'Off'}`, accent: sf.debug ? COL.good : COL.progress, onTap: () => sf.setDebug(!sf.debug) }] }] : []),
        { columns: 1, buttons: [{ id: 'recruit:back', label: '‹ Back to the roster', accent: COL.progress, onTap: () => openRoster() }] },
      ],
    };
  });
}
// One candidate: who they are, their stats against their tier cap, pay, trait, shift preference — and Hire.
function openCandidate(cardId) {
  let message = null;
  sheet.open(() => {
    const w = open?.world;
    const c = w?.staffing.card(cardId);
    if (!c) return { title: 'No longer on the board', subtitle: 'They took another job.', accent: COL.progress, sections: [{ columns: 1, buttons: [{ id: 'cand:back', label: '‹ Back to Recruit', accent: COL.progress, onTap: () => openRecruit() }] }] };
    const can = w.staffing.canHire(cardId);
    const cap = TIERS[c.tier].statCap;
    const trait = TRAITS[c.trait];
    return {
      title: c.name,
      subtitle: `${ROLES[c.role].name} · ${TIERS[c.tier].name} · Lv ${c.level}`,
      art: c.art,
      badge: ROLES[c.role].badge,
      tag: c.tier === 'rare' ? { text: 'RARE' } : null,
      accent: accentNow(),
      sections: [
        { lines: [...(message ? [{ text: message, color: COL.bad }] : []), `Salary ${c.salary} Credits a month · prefers ${PREF_WORD[c.shiftPref] ?? '—'} shifts`, trait ? `${trait.name}: ${trait.text}` : '', { text: `From ${CHANNELS.find((x) => x.id === c.channel)?.name ?? 'the board'}`, color: COL.textMuted }] },
        { title: `Stats (tier cap ${cap})`, bars: STATS.map((x) => ({ label: x.name, value: c.stats[x.id], max: cap, color: x.id === ROLES[c.role].primaryStat ? COL.action : COL.progress })) },
        {
          columns: 1,
          buttons: [
            { id: 'cand:hire', label: 'Hire', sub: can.ok ? 'Joins Off shift and walks in from the front door; put them on a shift in the roster' : can.reason, disabled: !can.ok, accent: COL.good, onTap: () => {
              const r = w.hire(cardId);
              if (!r.ok) return void (message = r.reason);
              autosave.request('hire');
              openRecruit();
            } },
            { id: 'cand:back', label: '‹ Back to Recruit', accent: COL.progress, onTap: () => openRecruit() },
          ],
        },
      ],
    };
  });
}
// A staff member's courses: what each would add (trimmed at the tier cap: "Would reach cap"), days, cost, specialty.
function openCourses(staffId) {
  let message = null;
  sheet.open(() => {
    const w = open?.world;
    const q = w?.crew.byId(staffId);
    if (!q) return { title: '', sections: [] };
    const rows = w.staffing.courses(staffId).map((x) => {
      const c = x.course;
      const gains = x.preview.map((g) => `${STAT_WORDS[g.key]} +${g.min}–${g.max}`).join(', ');
      const sp = c.specialty ? ` · ${SPECIALTIES[c.specialty].name}${x.specialtyNote ? ` (${x.specialtyNote})` : ''}` : '';
      const cap = x.capped ? ' · Would reach cap' : '';
      return { id: `course:${c.id}`, label: `${c.name} · ${credits(c.cost)} · ${c.days} days`, sub: x.ok ? `${gains}${cap}${sp}` : `${x.reason}${gains ? ` · ${gains}` : ''}`, disabled: !x.ok, accent: x.capped ? COL.gold : COL.progress, tag: x.capped ? 'CAP' : null, onTap: () => {
        const r = w.train(c.id, staffId);
        if (!r.ok) return void (message = r.reason);
        autosave.request('training');
        openHomeSheet(staffId, 'roster');
      } };
    });
    const hasRoom = w.layout.ofDef('F11').length > 0;
    return {
      title: `Training: ${q.name}`,
      subtitle: `${ROLES[q.role].name} · ${TIERS[q.model.tier].name} (cap ${TIERS[q.model.tier].statCap}) · specialties ${w.specialtiesOf(staffId).length} of ${w.staffing.specialtyLimit(staffId)}`,
      art: q.art,
      badge: ROLES[q.role].badge,
      accent: accentNow(),
      sections: [
        { lines: [...(message ? [{ text: message, color: COL.bad }] : []), { text: hasRoom ? 'Away from the roster at the Training Room for the course.' : 'Needs a Training Room (Build Mode; it opens at Rank D).', color: hasRoom ? COL.textMuted : COL.bad }] },
        { columns: 1, buttons: rows },
        { columns: 1, buttons: [{ id: 'courses:back', label: '‹ Back to their card', accent: COL.progress, onTap: () => openHomeSheet(staffId, 'roster') }] },
      ],
    };
  });
}
// Let go: asks first; the Founder asks twice (the Founding Staff flag ends and they never come back).
function confirmLetGo(staffId) {
  const w = open?.world;
  const q = w?.crew.byId(staffId);
  if (!q) return;
  const founder = w.staffState.founder.id === staffId && !w.staffState.founder.ended;
  const go = () => {
    const r = w.letGo(staffId);
    if (r.ok) {
      autosave.request('letGo');
      openRoster();
    }
  };
  dialog.confirm({
    title: `Let ${first(q.name)} go?`,
    body: `They leave the home. Their Familiar Care with residents stays on record, and they could be hired again later.`,
    art: q.art,
    yes: 'Let go',
    danger: true,
    onYes: () => {
      if (!founder) return go();
      dialog.confirm({ title: 'Your Founder?', body: `${q.name} has been with you since Day 1. The Founding Staff flag and perk end, and a Founder never comes back.`, art: q.art, yes: 'Let the Founder go', danger: true, onYes: go });
    },
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
  const room = st.room ? `Room ${w.roomNumber(st.room)}` : 'No room (test home)';
  return [
    { lines: [{ text: step ? `${step}: ${w.stateOf(it)}` : w.stateOf(it), color: COL.actionDark }, ...(bell ? [{ text: `Call bell ringing (${needName(bell.need)})`, color: COL.bad }] : []), `${room} · Support Level ${supportLevel(it.def)}`, { text: stayLine(w, it), color: st.stay ? COL.actionDark : COL.textMuted }] },
    { title: 'Life story', lines: [it.def.story, { text: (st.tags?.length ? st.tags : it.def.tags).join(' · '), color: COL.actionDark }, ...(st.returning ? [{ text: 'Returning: stayed here before', color: COL.good }] : [])] },
    planSection(w, it),
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
// Milestone 4: the Care Plan section — one row per domain (bible §9), tap → that domain's options. Milestone 8: the
// review (an amber dot and the reasons while it is due, the last review day, and Reviewed).
function planSection(w, it) {
  const stale = w.staleOf(it.id);
  const r = it.state.review;
  const lines = stale.map((x) => ({ text: x.text, color: COL.warn }));
  lines.push({ text: r?.day == null ? 'Not reviewed yet.' : `Last reviewed ${r.day === w.clock.totalDays ? 'today' : `${w.clock.totalDays - r.day} day${w.clock.totalDays - r.day === 1 ? '' : 's'} ago`}. Tap a row to change it; a change shapes tomorrow's tasks, and today's where that part hasn't happened yet.`, color: COL.textMuted });
  const buttons = planButtons(w, it);
  buttons.push({ id: 'plan:review', label: stale.length ? 'Reviewed' : 'Reviewed (confirm the plan)', sub: stale.length ? 'The plan is right as it stands: mark it reviewed' : 'Up to date: review again any time', accent: stale.length ? COL.action : COL.progress, onTap: () => {
    w.reviewPlan(it.id);
    autosave.request('review');
  } });
  return { title: stale.length ? 'Care Plan · review due' : 'Care Plan', titleDot: stale.length ? COL.warn : null, lines, buttons, columns: 1 };
}
const PREF_WORDS = { prefer: 'likes this', dislike: 'dislikes this', refuse: 'refuses this' };
function planButtons(w, it) {
  return DOMAINS.map((d) => {
    const o = optionById(it.state.plan?.[d.id]);
    const pref = o && w.optionPref(o.id, it.id);
    const note = pref === 'refuse' ? ' · refused: its tasks are refused' : pref === 'dislike' ? ' · disliked' : '';
    return { id: `plan:${d.id}`, label: d.name, sub: o ? `${o.name}${note}` : 'Not set', accent: pref === 'refuse' ? COL.bad : COL.progress, onTap: () => openPlanPicker(d.id, it.id) };
  });
}
// "07:00  Wake up · done with Ruby"
const TASK_WORDS = { open: 'to do', claimed: 'on the way', working: 'being helped', done: 'done', missed: 'missed', refused: 'said no', self: 'on their own', unstaffed: 'no one on shift', scaled: 'scaled back (short-staffed)' };
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
  const counts = w.team.map((p) => `${first(p.name)} ${familiarityOf(w.care, it.id, p.id)}`).join(' · ');
  return [{ text: top ? `Most familiar: ${w.byId(top).name}` : 'Most familiar: nobody yet', color: COL.actionDark }, { text: `Care together: ${counts}`, color: COL.textMuted }];
}
// "Mobility for Betty" (Milestone 8: all eight options): each row says whether it can be chosen (greyed with the
// reason when not), the current one and their like / dislike / refusal. Tap a row to see it; Choose to take it.
const NEED_WORDS = Object.fromEntries(NEEDS.map((n) => [n.id, n.name]));
const OUTCOME_WORDS = Object.fromEntries(OUTCOMES.map((o) => [o.id, o.name]));
function openPlanPicker(domainId, residentId) {
  let looking = null; // the option tapped (its details and Choose)
  let message = null;
  sheet.open(() => {
    const w = open?.world;
    const d = DOMAINS.find((x) => x.id === domainId);
    const it = w?.residentById(residentId);
    if (!w || !d || !it) return { title: '', sections: [] };
    const current = it.state.plan?.[d.id];
    const who = first(it.name);
    const rows = optionsFor(d.id).map((o) => {
      const el = w.eligibility(o.id, residentId);
      const pref = w.optionPref(o.id, residentId);
      const isCurrent = o.id === current;
      let sub;
      if (isCurrent) sub = `Current${PREF_WORDS[pref] ? ` · ${who} ${PREF_WORDS[pref]}` : ''}`;
      else if (!el.ok) sub = el.reason;
      else sub = `${PREF_WORDS[pref] ? `${who} ${PREF_WORDS[pref]} · ` : ''}about ${o.minutesPerDay} min a day`;
      return { id: `option:${o.id}`, label: o.name, sub, disabled: !el.ok && !isCurrent, accent: isCurrent ? COL.good : looking === o.id ? COL.action : pref === 'refuse' ? COL.bad : COL.progress, onTap: () => {
        looking = o.id;
        message = null;
        sheet.scrollY = 0;
      } };
    });
    const sections = [];
    if (message) sections.push({ lines: [{ text: message, color: COL.bad }] });
    const o = looking && optionById(looking);
    if (o) {
      const pref = w.optionPref(o.id, residentId);
      const el = w.eligibility(o.id, residentId);
      const lines = [
        o.text,
        { text: `${o.roles.map((r) => ROLES[r].name).join(' / ')} · about ${o.minutesPerDay} min a day`, color: COL.textMuted },
        { text: `Eases: ${o.nudges.needs.map((n) => NEED_WORDS[n]).join(', ') || 'nothing directly'}${o.nudges.outcomes.length ? ` · Helps: ${o.nudges.outcomes.map((x) => OUTCOME_WORDS[x]).join(', ')}` : ''}`, color: COL.textMuted },
      ];
      if (o.removes?.length) lines.push({ text: `${o.removes.map((x) => stepName(x)).join(', ')}: no staff help (${who} does it ${theirOf(it.id) === 'her' ? 'her' : 'his'} own way)`, color: COL.textMuted });
      if (pref === 'dislike') lines.push({ text: `${who} dislikes this: choosing it costs ${-OPTION_PREF_MOOD.dislike} Mood, and ${theirOf(it.id) === 'her' ? 'she' : 'he'} may say no to its tasks.`, color: COL.warn });
      if (pref === 'refuse') lines.push({ text: `${who} refuses this: you can choose it, but its tasks will be refused whenever they come up.`, color: COL.bad });
      if (pref === 'prefer') lines.push({ text: `${who} likes this (+${OPTION_PREF_MOOD.prefer} Mood when chosen).`, color: COL.good });
      if (!el.ok) lines.push({ text: el.reason, color: COL.bad });
      const choose = () => {
        const r = w.changePlan(d.id, o.id, residentId);
        if (!r.ok) {
          message = r.reason;
          return;
        }
        if (r.changed) autosave.request('plan');
        openHomeSheet(residentId);
      };
      const label = o.id === current ? 'Current option' : pref === 'dislike' ? `Choose anyway (Mood −${-OPTION_PREF_MOOD.dislike})` : pref === 'refuse' ? 'Choose anyway (tasks refused)' : `Choose ${o.name}`;
      sections.push({ title: o.name, lines, columns: 1, buttons: [{ id: 'option:choose', label, disabled: !el.ok || o.id === current, accent: pref === 'dislike' || pref === 'refuse' ? COL.warn : COL.action, onTap: choose }] });
    }
    sections.push({ title: o ? 'All options' : null, lines: o ? [] : [{ text: 'Tap an option to see what it does. Greyed ones can\'t be chosen yet: the reason is on the row.', color: COL.textMuted }], columns: 1, buttons: [...rows, { id: 'option:back', label: `‹ Back to ${who}`, accent: COL.progress, onTap: () => openHomeSheet(residentId) }] });
    return { title: `${d.name} for ${who}`, subtitle: 'Care plan · eight options · pick one', art: it.art, accent: paletteById(open.data.facility.palette).hex, sections };
  });
}
// Milestone 3: one button per routine step — who will help with it. Milestone 7: someone is rostered then when their
// shift's hours hold the step's time.
const inShift = (sh, h) => (sh.from < sh.to ? h >= sh.from && h < sh.to : h >= sh.from || h < sh.to);
const rosteredAt = (w, step) => w.team.filter((p) => {
  const sh = w.roster.shiftOf(p.id);
  return sh && inShift(sh, step.at);
});
const onMorningShift = (step) => !!open && rosteredAt(open.world, step).length > 0;
function helpButtons(w, it) {
  return ROUTINE.map((step) => {
    const chosen = w.chosenFor(step.id, it.id);
    const who = (id) => w.byId(id)?.name.split(' ')[0];
    let sub;
    if (!onMorningShift(step)) sub = chosen ? `${who(chosen)} · off shift then` : 'Off shift: on their own';
    else if (chosen) sub = `${who(chosen)} (chosen)`;
    else {
      // Auto names who normally does it: the first team member whose role fits (busy right now or not).
      const fit = rosteredAt(w, step).find((p) => step.roles.includes(p.role));
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
    if (!onMorningShift(step)) lines.push({ text: `No one is rostered at ${clockText(step.at)}: ${first(it.name)} manages on their own unless agency cover comes (Staff → Roster).`, color: COL.textMuted });
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
            ...w.team.map((p) => {
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
  const isFounder = w.staffState.founder.id === p.id && !w.staffState.founder.ended;
  const h = w.staffState.founder.history;
  const agency = w.roster.isAgency(p.id);
  const pref = STAFF.find((d) => d.id === p.id)?.shiftPref;
  const wing = w.roster.wingOf(p.id);
  const shiftLines = agency
    ? [w.roster.label(p.id), 'Agency worker: booked for this shift only; builds no Familiar Care and is never on records.']
    : [w.roster.label(p.id), `Prefers ${PREF_WORD[pref] ?? '—'} shifts${pref !== 'night' ? ' · Night shifts cost a little Morale' : ''} · ${wing ? `${WINGS.find((x) => x.id === wing)?.name} wing` : w.roster.isFloat(p.id) ? 'float: tied to no wing' : 'no wing'}`];
  const status = [m.status.tired && 'Tired', m.status.stressed && 'Stressed'].filter(Boolean);
  const fam = w.residents.map((r) => `${first(r.name)} ${familiarityOf(w.care, r.id, p.id)}${w.mostFamiliar(r.id) === p.id ? ' (most familiar)' : ''}`).join(' · ');
  const sections = [
    { lines: [{ text: w.stateOf(p), color: COL.actionDark }, ...shiftLines, agency ? `Tasks helped with: ${m.counters.tasks ?? 0} · Fee ${SHORT_STAFFING.agencyFeePerShift} Credits a shift` : `Tasks helped with: ${m.counters.tasks ?? 0} · Salary ${m.salary} Credits a month`, ...(agency ? [] : [`Familiar with: ${fam}`])] },
    { title: 'Stats', bars: STATS.map((s) => ({ label: s.name, value: m.stats[s.id], max: cap, color: s.id === ROLES[m.role].primaryStat ? COL.action : COL.progress })) },
    { title: status.length ? `Energy and Morale · ${status.join(', ')}` : 'Energy and Morale', bars: [{ label: 'Energy', value: m.energy, color: m.energy < 25 ? COL.bad : COL.good }, { label: 'Morale', value: m.morale, color: m.morale < 25 ? COL.bad : COL.gold }] },
    { title: 'Trait', lines: [trait ? `${trait.name}: ${trait.text}` : 'None'] },
  ];
  // Milestone 11: specialties, training, let go
  if (!agency) {
    const sp = w.specialtiesOf(p.id);
    const lim = w.staffing.specialtyLimit(p.id);
    const tr = w.staffing.trainingOf(p.id);
    const course = tr && w.staffing.training.course(tr.courseId);
    sections.push({ title: `Specialties (${sp.length} of ${lim})`, lines: [sp.length ? sp.map((x) => SPECIALTIES[x].name).join(' · ') : { text: 'None yet: courses can give one', color: COL.textMuted }] });
    sections.push({
      title: 'Training',
      lines: [tr ? { text: `At the Training Room: ${course?.name} · ${tr.days - tr.daysDone} day${tr.days - tr.daysDone === 1 ? '' : 's'} left`, color: COL.actionDark } : { text: 'Courses raise stats (never past the tier cap) and can give a specialty.', color: COL.textMuted }],
      columns: 2,
      buttons: [
        { id: 'staff:train', label: 'Train', sub: tr ? 'Already training' : 'Choose a course', disabled: !!tr, accent: COL.progress, onTap: () => openCourses(p.id) },
        { id: 'staff:letGo', label: 'Let go', sub: isFounder ? 'The Founder: asks twice' : 'Asks first', accent: COL.bad, onTap: () => confirmLetGo(p.id) },
      ],
    });
  }
  if (isFounder) {
    const f = FOUNDERS.find((x) => x.id === p.id);
    sections.push({ title: 'Founding Staff', lines: [`${f.perk.name}: ${f.perk.text}`, `With you since Day 1 · ${h.daysEmployed} days (${yearsEmployed(h)} years) · ${h.careTasks} care tasks`] });
  }
  return { title: p.name, subtitle: `${ROLES[m.role].name} · ${agency ? 'Agency cover' : `${TIERS[m.tier]?.name ?? m.tier} · Lv ${m.level}`}`, art: p.art, badge: ROLES[m.role].badge, tag: isFounder ? { text: 'FOUNDER' } : agency ? { text: 'AGENCY' } : null, accent, sections };
}
// from: 'residents' / 'roster' when opened from a bottom-bar list (Milestone 5) — the card then has a way back to it.
const BACK_TO = { residents: { label: '‹ Back to residents', open: () => openResidents() }, roster: { label: '‹ Back to the roster', open: () => openRoster() } };
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
      const n = w.roomNumber(it.id);
      sub = who ? `Room ${n} · ${who.name}'s room` : `Room ${n} · Empty`;
      lines.unshift(who ? `Resident: ${who.name} (${who.def.support})` : 'Empty: ready for a new resident. Admit one from Care → Admissions.');
      if (!who) sections.push({ columns: 1, buttons: [{ id: 'room:admissions', label: 'Admissions', sub: `${w.admissions.board.length} applying`, icon: CARE_ICONS.admissions, accent: COL.action, onTap: () => openAdmissions() }] });
    }
    if (it.defId === 'F09') sections.push({ columns: 1, buttons: [{ id: 'place:recruit', label: 'Recruit', sub: `${w.staffing.board.length} candidates · Staff ${w.team.length} / ${w.staffing.cap}`, accent: COL.action, onTap: () => openRecruit() }] });
    if (it.defId === 'F11') {
      const trainees = w.team.filter((q) => w.roster.isTraining(q.id));
      lines.push(trainees.length ? `Training now: ${trainees.map((q) => `${first(q.name)} (${w.staffing.training.course(w.staffing.trainingOf(q.id)?.courseId)?.name ?? ''})`).join(', ')}` : 'Nobody training right now: choose a course from a staff card.');
    }
    sections.push({ columns: 1, buttons: [{ id: 'place:build', label: 'Move or sell in Build Mode', sub: it.def.effect ? `${it.def.effect.text}${it.def.effect.wired ? '' : ' (its system comes later)'}` : '', accent: COL.progress, onTap: () => {
      homeScreen.setBuildMode(true);
      homeScreen.pick(it);
    } }] });
    return { title: it.def.name, subtitle: sub, art: it.def.art, accent, sections };
  });
}
// Leaving the home for the Main Menu: save the run first; a reload after this opens the menu again.
async function leaveHome() {
  if (spawn) {
    // (a spawn check under way: the campaign's own home comes back first)
    assets.stopTracking();
    spawn.world.clearGuests();
    open.world = spawn.real;
    spawn = null;
    homeScreen.enter();
  }
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
  window.__cw = { renderer, layout, input, loop, router, assets, sheet, dialog, systemBack, textPrompt, menuScreen, slotsScreen, setupScreen, homeScreen, topBar, topBarCredits: () => balanceNow(), bottomBar, vfx, carePops, dayBeat, openBottom, get lastRoute() { return lastRoute; }, playSlot, startFacility, deleteSlot, newGame, taps: [], autosave, saveRun, openRecruit, openCandidate, openCourses, confirmLetGo, openDevelop, openBuildList, confirmSell, upgradeStage, get bigBeat() { return bigBeat; }, startSpawnCheck, get spawning() { return !!spawn; }, spawnReport: null, get campaigns() { return campaigns; }, get open() { return open; } };
}

router.go('boot');
loop.start();
