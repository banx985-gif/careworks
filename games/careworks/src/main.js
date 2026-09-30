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
import { TRAITS, STAFF, validateStaff, checkStaffArt } from '../data/staff.js';
import { SHIFTS, FEES, SHORT_STAFFING, ON_CALL } from '../data/balance.js';
import { SHIFT_IDS, OFF, WINGS, AGENCY } from '../data/shifts.js';
import { ADMISSION } from '../data/admissions.js';
import { STAGES } from '../data/home.js';
import { CHANNELS, RANK_NOW } from '../data/recruitment.js';
import { SPECIALTIES } from '../data/training.js';
import { ROOMS } from '../data/rooms.js';
import { BUILDABLE_FACILITIES } from '../data/facilities.js';
import { FOUNDERS } from '../data/setup.js';
import { DOMAINS, CARE_OPTIONS, optionById, optionsFor, validateCarePlans, OPTION_PREF_MOOD } from '../data/carePlans.js';
import { TASK_TYPES, BELL } from '../data/tasks.js';
import { clockText, wakeWindowOf } from './systems/residentNeeds.js';
import { WAKE } from '../data/routine.js';
import { CONTINUITY, FRIENDSHIP, ACTIVITY_GROUPS } from '../data/relationships.js';
import { ACTIVITIES, SCHEDULABLE, activityById, TIMETABLE, COMMUNITY_EVENTS } from '../data/activities.js';
import { facilityById } from '../data/facilities.js';
import { DIETS, dishById, dishesOf, mealById, SAT_REASONS, HYDRATION, KITCHENS, TROLLEYS } from '../data/dining.js';
import { AIDS, GOALS, DISCHARGE, REHAB_FUNDING } from '../data/mobility.js';
import { WALKING } from '../data/memory.js';
import { ACTIONS, ACTION_IDS, CLINICIAN, HOSPITAL } from '../data/clinical.js';
import { TRUST, MEETING, MEETING_ASK, COMPLAINT, COMPLAINTS, FIXES, REQUESTS, REQUEST, FAMILY_ICONS } from '../data/family.js';
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
  triggers: ['clock:day', 'care:band', 'care:step', 'care:task', 'care:bell', 'care:plan', 'clock:speed', 'staff:onShift', 'staff:offShift', 'care:admit', 'care:joined', 'admissions:change', 'ledger:close', 'admissions:action', 'care:review', 'coverage:shift', 'coverage:warning', 'staff:agencyLeft', 'care:leaving', 'care:left', 'home:layout', 'home:stage', 'staff:hired', 'staff:letGo', 'staff:training', 'staff:trained', 'staff:left', 'care:birthday', 'care:ready', 'care:discharge', 'care:aid', 'care:walk', 'care:walkEnd', 'care:lifeStory', 'home:walkPath', 'care:alert', 'care:alertAction', 'care:alertEnd', 'care:transfer', 'care:back', 'care:roundIssue'],
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
    const s = validateStaff(new DataValidator(), STAFF, { taskTypes: Object.keys(TASK_TYPES) }).report();
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
  onInbox: () => openInbox(),
  inboxCount: () => (open?.world?.activities?.notices().length ?? 0) + (open?.world?.readyToGoHome?.().length ?? 0) + alertsWaiting() + familyWaiting(), // (Milestone 14: community notices waiting; Milestone 16: residents ready to go home; Milestone 18: alerts waiting for a choice; Milestone 19: family asks, requests, new complaints)
  onHelp: () => openTopSheet('help'),
  onLockedSpeed: (speed) => sheet.open(() => ({ title: `${speed}× speed`, subtitle: SPEED_LOCKED, accent: COL.progress, sections: [] })),
});
// Care's badge (Milestone 6: a count): the call bells ringing now plus the missed tasks today the player hasn't looked
// at yet (opening the resident list or a resident's card counts as looking).
const missedToday = () => open?.world.missedToday() ?? [];
// Milestone 18: alerts the home has noticed and nobody has chosen an action for yet
const alertsWaiting = () => open?.world?.clinical?.alerts().filter((a) => !a.pending).length ?? 0;
function careBadge() {
  if (!open) return null;
  const n = open.world.bells.length + missedToday().filter((t) => !open.seenMissed.has(t.id)).length + open.world.stalePlans().length + alertsWaiting(); // Milestone 8: + plans to review; Milestone 18: + alerts waiting
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
  items: BOTTOM_SLOTS.map((s) => ({ id: s.id, label: s.label, icon: s.icon, badge: s.id === 'care' ? careBadge : s.id === 'staff' ? staffBadge : s.id === 'quality' ? () => qualityBadge() : null })), // (Milestone 19: Quality — new complaints, and ones ready to mark done)
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
bus.on('care:leaving', ({ name, discharge }) => {
  if (discharge) return; // (Milestone 16: a discharge has its own beat)
  if (open && router.currentName === 'home') dayBeat.showText(`${first(name)} heads home`, true);
  debug.log(`went home: ${name}`);
});

// Milestone 11: a new hire walks in (medium beat); a course is finished.
bus.on('staff:hired', ({ name }) => {
  if (open && router.currentName === 'home') dayBeat.showText(`Welcome to the team, ${first(name)}`, true);
  debug.log(`hired: ${name}`);
});
// Milestone 14: a birthday (medium beat; the first in a run also shows the First Birthday picture); a notice arriving
// (a quiet line, only if nothing else is showing — never a stack of pop-ups)
bus.on('care:birthday', ({ names, first: isFirst, art }) => {
  if (!open || router.currentName !== 'home') return;
  const who = names.map((n) => first(n)).join(' and ');
  dayBeat.showText(`Happy birthday, ${who}!`, true);
  if (isFirst && art) bigBeat = { title: 'A first birthday', text: `${who}'s birthday tea in the lounge`, art, age: 0 };
});
// Milestone 18: an alert noticed (the Inbox has the choices), a transfer to the hospital service and the return
bus.on('care:alert', ({ name, word }) => {
  if (open && router.currentName === 'home' && name) dayBeat.showText(`${first(name)} seems ${word}: choose what to do (Inbox)`, false);
});
bus.on('care:transfer', ({ name }) => {
  if (open && router.currentName === 'home') dayBeat.showText(`${first(name)} goes to the hospital service for a few days`, false);
});
bus.on('care:back', ({ name }) => {
  if (open && router.currentName === 'home') dayBeat.showText(`${first(name)} is back from the hospital service`, true);
});
// Milestone 16: ready to go home (an Inbox item) and a successful discharge (the big beat the first time, then medium)
bus.on('care:ready', ({ name }) => {
  if (open && router.currentName === 'home') dayBeat.showText(`${first(name)} is ready to go home`, true);
});
bus.on('care:discharge', ({ resident, name, first: isFirst, art }) => {
  if (!open || router.currentName !== 'home') return;
  dayBeat.showText(`${first(name)} goes home with family: rehab complete`, true);
  if (isFirst && art) bigBeat = { title: 'A first rehab discharge', text: `${first(name)} is back on ${theirOf(resident)} feet and home with family`, art, age: 0 };
});
// Milestone 19: a first family visit (the big beat with its picture; later visits only a quiet line when nothing else
// is showing), compliments (the first with the thank-you card), complaints, meetings held
bus.on('care:visit', ({ name, visitor, first: isFirst, art }) => {
  if (!open || router.currentName !== 'home') return;
  if (isFirst && art) bigBeat = { title: 'A first family visit', text: `${visitor} comes to see ${first(name)}`, art, age: 0 };
  else if (!dayBeat.current && !bigBeat) dayBeat.showText(`${visitor} is visiting ${first(name)}`, false);
});
bus.on('care:compliment', ({ name, first: isFirst, art }) => {
  if (!open || router.currentName !== 'home') return;
  dayBeat.showText(`A compliment from ${first(name)}'s family`, true);
  if (isFirst && art) bigBeat = { title: 'A first compliment', text: `${first(name)}'s family says thank you`, art, age: 0 };
});
bus.on('care:complaint', ({ name }) => {
  if (open && router.currentName === 'home') dayBeat.showText(`A complaint from ${first(name)}'s family: an improvement task (Quality)`, false);
});
bus.on('care:meeting', ({ name, change, review, first: isFirst }) => {
  if (open && router.currentName === 'home') dayBeat.showText(isFirst ? `A first family review: ${first(name)}'s plan` : `Family meeting for ${first(name)}: Family Trust ${signed1(change)}`, true);
});
bus.on('care:notice', () => {
  if (open && router.currentName === 'home' && !dayBeat.current && !bigBeat) dayBeat.showText('A notice in the Inbox', false);
});
// Milestone 12: ?debug=1 Fill roster (one beat for all of them)
bus.on('staff:filled', ({ ids }) => {
  if (open && router.currentName === 'home') dayBeat.showText(`Roster filled: ${ids.length} hired (debug)`, true);
  debug.log(`fill roster: ${ids.join(', ')}`);
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
  else if (r.slot.id === 'quality') openQuality(); // (Milestone 19: Compliments & complaints)
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
        { title: 'Activities', columns: 1, buttons: [{ id: 'care:activities', label: 'Activities', sub: activitiesSub(w), icon: 'care_ui_01', accent: COL.action, onTap: () => openActivities() }] },
        // Milestone 15: meals — the Dining Room card (satisfaction, the kitchen, the weekly menu)
        { title: 'Meals', columns: 1, buttons: [{ id: 'care:meals', label: 'Meals and the menu', sub: mealsSub(w), icon: TROLLEYS.meal, accent: COL.action, onTap: () => {
          const room = w.placed.find((x) => x.defId === 'F03');
          if (room) openHomeSheet(room.id);
        } }] },
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
// "Afternoon: nobody to serve lunch or the evening meal (no Hospitality worker; carers serve when they are free)"
function mealCoverText(m) {
  const names = m.meals.map((id) => mealById(id).name.toLowerCase());
  const meals = names.length > 1 ? `${names.slice(0, -1).join(', ')} or the ${names[names.length - 1]}` : names[0];
  return m.level === 'none' ? `${SHIFTS[m.shift].name}: nobody to serve ${meals}` : `${SHIFTS[m.shift].name}: nobody to serve ${meals} (no Hospitality worker; carers serve when they are free)`;
}
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
    // Milestone 16 (fix first): a shift with nobody to serve its meal (amber, like the coverage warnings; no automatic fix)
    for (const m of w.mealCover()) lines.push({ text: mealCoverText(m), color: COL.warn });
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
          title: 'Continuity groups',
          lines: [{ text: `Pin a team member to up to ${CONTINUITY.maxResidents} residents: they are preferred for them when on shift, so familiarity builds. Safety, skills and urgency still come first.`, color: COL.textMuted }],
          columns: 1,
          buttons: w.team.map((p) => {
            const grp = w.continuityOf(p.id);
            return { id: `group:${p.id}`, label: `${first(p.name)}'s residents`, sub: grp.length ? grp.map((id) => first(w.residentById(id)?.name ?? id)).join(', ') : 'None pinned', icon: p.art, iconCrop: PORTRAIT_CROP, iconBadge: ROLES[p.role].badge, accent: grp.length ? COL.good : COL.progress, onTap: () => openContinuity(p.id) };
          }),
        },
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
        ...(debug.enabled ? [{ title: 'Debug', columns: 1, buttons: [{ id: 'roster:fill', label: `Fill roster (debug): hire up to ${w.staffing.cap}`, sub: 'Hires eligible staff from the open channels, each on their preferred shift (open every channel under Recruit for Rare)', accent: COL.progress, disabled: w.team.length >= w.staffing.cap, onTap: () => {
          const ids = w.fillRoster();
          message = ids.length ? null : 'Nobody eligible to hire (or the team is full).';
          if (ids.length) autosave.request('roster');
        } }] }] : []),
      ],
    };
  });
}
// --- Activities (Milestone 14, bible §20) -----------------------------------------------------------------------------
const SLOT_WORD = { morning: 'Morning', afternoon: 'Afternoon' };
const dayName = (w, day) => TIMETABLE.days[((day % 7) + 7) % 7];
function activitiesSub(w) {
  const s = w.sessionToday('afternoon');
  const a = s && activityById(s.activity);
  return a ? `Today: ${a.name} this afternoon · ${Object.values(s.choices).filter((c) => c !== 'decline').length} signed up` : 'Nothing on this afternoon: free time';
}
// Who's signed up for a session: joins, maybes, and who chose free time.
function signupLines(w, s) {
  if (!s) return [{ text: 'Free time: nothing on the timetable', color: COL.textMuted }];
  const a = activityById(s.activity);
  const by = (c) => Object.entries(s.choices).filter(([, v]) => v === c).map(([id]) => first(w.residentById(id)?.name ?? id));
  const where = a.where.facility !== 'F05' && !w.layout.ofDef(a.where.facility).length ? ` (in the ${a.where.place === 'dining' ? 'Dining Room' : 'lounge'} until a ${facilityById(a.where.facility)?.name} is built)` : '';
  const title = s.birthday ? `${first(w.residentById(s.birthday)?.name ?? '')}'s birthday tea` : s.event ? `${COMMUNITY_EVENTS.find((e) => e.id === s.event)?.name}` : a.name;
  return [
    { text: `${SLOT_WORD[s.slot]} ${clockText(TIMETABLE.slots[s.slot].at)}: ${title} · led by ${a.leaders.map((r) => ROLES[r].short).join(' / ')}${where}`, color: COL.actionDark },
    `Joining: ${by('join').join(', ') || 'nobody yet'}${by('maybe').length ? ` · maybe: ${by('maybe').join(', ')}` : ''}`,
    ...(by('decline').length ? [{ text: `Free time instead: ${by('decline').join(', ')} (their choice)`, color: COL.textMuted }] : []),
  ];
}
function openActivities() {
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const day = w.clock.totalDays;
    const tt = w.activities.timetable();
    const today = ((day % 7) + 7) % 7;
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const dow = (today + i) % 7;
      for (const slot of Object.keys(TIMETABLE.slots)) {
        const a = tt[dow][slot] ? activityById(tt[dow][slot]) : null;
        rows.push({ id: `slot:${dow}:${slot}`, label: `${TIMETABLE.days[dow]}${i === 0 ? ' (today)' : ''} · ${SLOT_WORD[slot]}`, sub: a ? `${a.name} · ${a.leaders.map((r) => ROLES[r].short).join(' / ')}` : 'Free time', icon: a?.prop ?? null, accent: a ? COL.good : COL.progress, onTap: () => openSlotPicker(dow, slot) });
      }
    }
    const notices = w.activities.notices();
    return {
      title: 'Activities',
      subtitle: 'A weekly timetable: a Morning and an Afternoon slot each day · residents choose whether to join',
      art: 'care_ui_01',
      accent: accentNow(),
      sections: [
        { title: 'Today', lines: [...signupLines(w, w.sessionToday('morning')).filter(() => !!w.sessionToday('morning')), ...signupLines(w, w.sessionToday('afternoon'))] },
        { title: 'This week', lines: [{ text: 'Tap a slot to choose an activity (or free time). Declining is always fine: nobody is made to join.', color: COL.textMuted }], columns: 2, buttons: rows },
        { title: 'Outings and visitors', lines: notices.length ? notices.map((n) => ({ text: `Notice: ${n.def.name} (${dayName(w, n.day)}): answer it in the Inbox`, color: COL.actionDark })) : [{ text: 'Visitor offers arrive in the Inbox a few days ahead.', color: COL.textMuted }], columns: 1, buttons: [
          { id: 'act:outing', label: 'Plan an outing', sub: activityById('outing').needs.text, disabled: true, accent: COL.progress },
          { id: 'act:inbox', label: 'Inbox', sub: notices.length ? `${notices.length} waiting` : 'Nothing waiting', accent: COL.progress, onTap: () => openInbox() },
        ] },
      ],
    };
  });
}
function openSlotPicker(dow, slot) {
  let message = null;
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const cur = w.activities.timetable()[dow][slot];
    const here = w.residents.filter((r) => !r.state.leaving && !r.state.guest);
    const rows = SCHEDULABLE.map((a) => {
      const keen = here.filter((r) => ['love', 'like'].includes(w.feelingOf(r.id, a.id))).length;
      return { id: `pick:${a.id}`, label: `${cur === a.id ? '✓ ' : ''}${a.name}`, sub: `${a.text} · ${keen} here would enjoy it · ${a.minutes} min · led by ${a.leaders.map((r) => ROLES[r].short).join(' / ')}`, icon: a.prop ?? null, selected: cur === a.id, accent: cur === a.id ? COL.good : COL.progress, onTap: () => {
        const r = w.setSlot(dow, slot, a.id);
        message = r.ok ? null : r.reason;
        if (r.ok) {
          autosave.request('activities');
          openActivities();
        }
      } };
    });
    rows.push({ id: 'pick:free', label: `${cur == null ? '✓ ' : ''}Free time`, sub: 'Nothing planned: residents rest or do their own thing', accent: COL.progress, onTap: () => {
      w.setSlot(dow, slot, null);
      autosave.request('activities');
      openActivities();
    } });
    return {
      title: `${TIMETABLE.days[dow]} · ${SLOT_WORD[slot]}`,
      subtitle: `Choose the ${SLOT_WORD[slot].toLowerCase()} activity (${clockText(TIMETABLE.slots[slot].at)})`,
      accent: accentNow(),
      sections: [
        ...(message ? [{ lines: [{ text: message, color: COL.bad }] }] : []),
        { columns: 1, buttons: rows },
        { columns: 1, buttons: [{ id: 'pick:back', label: '‹ Back to Activities', accent: COL.progress, onTap: () => openActivities() }] },
      ],
    };
  });
}
// The Inbox (Milestone 14): community / visitor notices — Accept books that afternoon (it needs a host on shift), Decline
// lets it go. One notice at a time: they never stack.
function openInbox() {
  let message = null;
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: 'Inbox', subtitle: TOP_SHEETS.inbox.text, accent: COL.progress, sections: [] };
    const notices = w.activities.notices();
    const sections = [];
    if (message) sections.push({ lines: [{ text: message, color: COL.bad }] });
    // Milestone 18: alerts — the six high-level choices
    for (const a of w.clinical.alerts()) sections.push(alertSection(w, a, 'inbox'));
    // Milestone 16: residents ready to go home — send them home now, or it happens on its own
    for (const r of w.readyToGoHome()) sections.push(readyNotice(w, r, 'inbox'));
    sections.push(...familyInbox(w)); // (Milestone 19: a meeting the family asked for, requests, new complaints)
    for (const n of notices) {
      const can = w.activities.canAccept(n.uid);
      sections.push({ title: n.def.name, lines: [n.def.text, { text: `${dayName(w, n.day)} afternoon (in ${n.day - w.clock.totalDays} day${n.day - w.clock.totalDays === 1 ? '' : 's'}) · runs as ${activityById(n.def.activity).name.toLowerCase()} with a bigger lift`, color: COL.actionDark }], columns: 2, buttons: [
        { id: `notice:accept:${n.uid}`, label: 'Accept', sub: can.ok ? `Host: ${first(w.byId(can.host)?.name ?? '')}` : can.reason, disabled: !can.ok, accent: COL.good, onTap: () => {
          const r = w.answerNotice(n.uid, true);
          message = r.ok ? null : r.reason;
          if (r.ok) autosave.request('inbox');
        } },
        { id: `notice:decline:${n.uid}`, label: 'Decline', sub: 'Politely, with thanks', accent: COL.progress, onTap: () => {
          w.answerNotice(n.uid, false);
          autosave.request('inbox');
        } },
      ] });
    }
    const past = w.activities.history().slice(-4).reverse();
    sections.push({ title: 'Earlier', lines: past.length ? past.map((h) => ({ text: `${h.def.name}: ${h.accepted ? 'accepted' : h.auto ? 'no answer (let go)' : 'declined'}`, color: COL.textMuted })) : [{ text: notices.length ? '' : 'Nothing yet. Letters from families, partners and inspectors will arrive here too.', color: COL.textMuted }] });
    const waiting = notices.length + alertsWaiting() + familyWaiting();
    return { title: 'Inbox', subtitle: waiting ? `${waiting} waiting` : 'Nothing waiting', art: 'care_ui_01', accent: accentNow(), sections };
  });
}
// The resident card's Activities section: what they enjoy, a hint when nothing they like has been on for a while, their
// birthday.
function activitySection(w, it) {
  const like = SCHEDULABLE.filter((a) => ['love', 'like'].includes(w.feelingOf(it.id, a.id))).map((a) => a.name);
  const dislike = SCHEDULABLE.filter((a) => ['dislike', 'refuse'].includes(w.feelingOf(it.id, a.id))).map((a) => a.name);
  const bd = w.birthdayOf(it.id);
  const lines = [
    { text: like.length ? `Enjoys: ${like.join(', ')}` : 'No favourites yet', color: COL.actionDark },
    ...(dislike.length ? [{ text: `Would rather not: ${dislike.join(', ')}`, color: COL.textMuted }] : []),
    ...(it.state.wouldEnjoy ? [{ text: `Would enjoy: ${activityById(it.state.wouldEnjoy)?.name} (nothing they like for a while)`, color: COL.warn }] : []),
    { text: `Birthday: Month ${Math.floor((bd - 1) / 28) + 1}, day ${((bd - 1) % 28) + 1}`, color: COL.textMuted },
  ];
  return { title: 'Activities', lines };
}
// --- Milestone 15: nutrition and dining -------------------------------------------------------------------------------
const todayDow = (w) => ((w.clock.totalDays % 7) + 7) % 7;
const satColor = (v) => (v >= 70 ? COL.good : v >= 45 ? COL.actionDark : COL.warn);
// The resident card's Meals section: their menu (from the care plan), favourites and when they are on, their dining
// satisfaction and last drink.
function mealsSection(w, it) {
  const st = it.state;
  const they = theirOf(it.id) === 'her' ? 'she' : 'he';
  const diet = w.dietOf(it.id);
  const d = DIETS[diet];
  const rota = w.dining.rota();
  const today = todayDow(w);
  const favs = w.favouritesOf(it.id).map((id) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dow = (today + i) % 7;
      if (rota[dow].main === id || rota[dow].pudding === id) days.push(i === 0 ? 'today' : TIMETABLE.days[dow]);
    }
    return `${dishById(id).name} (${days.length ? `on the menu ${days.join(', ')}` : 'not on the menu this week'})`;
  });
  const lines = [{ text: diet === 'standard' ? 'Menu: the standard menu' : `Menu: ${d.menu} (${d.name}, from the care plan)`, color: COL.actionDark }];
  if (diet !== 'standard' && !w.dietMadeByTeam(it.id)) lines.push({ text: `Nobody on the team can make ${d.menu}, so ${they} has the standard one (the Nutrition specialty or a Nutrition Office would)`, color: COL.warn });
  lines.push(`Favourite${favs.length === 1 ? '' : 's'}: ${favs.join(' · ')}`);
  const dn = st.dining;
  if (dn?.avg != null) {
    const why = dn.last.reason !== 'none' ? ` (${SAT_REASONS[dn.last.reason]})` : '';
    lines.push({ text: `Dining satisfaction ${Math.round(dn.avg)} · last meal: ${mealById(dn.last.meal)?.name.toLowerCase()} ${Math.round(dn.last.sat)}${why}`, color: satColor(dn.avg) });
  } else lines.push({ text: 'No meals here yet', color: COL.textMuted });
  if (st.hydration?.last != null) {
    const since = w.clock.totalDays * 24 + w.hour - st.hydration.last;
    lines.push({ text: `Last drink ${clockText(st.hydration.last % 24)}${since > HYDRATION.gapHours && !w.isAsleep(it) ? ' · due a drink' : ''}`, color: since > HYDRATION.gapHours && !w.isAsleep(it) ? COL.warn : COL.textMuted });
  }
  return { title: 'Meals', lines };
}
// "Kitchen: Sam is getting lunch ready" — the next meal's prep.
const PREP_WORDS = { waiting: 'prep not started yet', done: 'ready on time', late: 'ready late', unprepped: 'nobody got it ready: plain meals', noStaff: 'nobody on shift to cook', noKitchen: 'from the hatch (no Kitchen)' };
function prepLine(w, next) {
  if (!w.kitchen()) return { text: 'Meals come from the Dining Room hatch (no Kitchen)', color: COL.textMuted };
  const p = next.prep;
  const meal = next.meal.name.toLowerCase();
  const cook = w.staff.find((q) => w.taskOf(q)?.type === 'prep');
  if (cook) return { text: `Kitchen: ${first(cook.name)} is ${cook.mode === 'helping' ? 'getting' : 'on the way to get'} ${w.taskOf(cook).meal === next.meal.id ? meal : mealById(w.taskOf(cook).meal)?.name.toLowerCase()} ready`, color: COL.actionDark };
  if (!p) return { text: `Kitchen: ${meal} prep starts at ${clockText(next.meal.prepAt)}`, color: COL.textMuted };
  const by = p.by ? ` (${first(w.byId(p.by)?.name ?? '')})` : '';
  return { text: `Kitchen: ${meal} ${PREP_WORDS[p.status] ?? p.status}${by}`, color: p.status === 'done' ? COL.good : p.status === 'waiting' ? COL.textMuted : COL.warn };
}
// The Dining Room card: warnings, the next meal, the home's satisfaction and the lowest three, the last few meals.
function diningSections(w) {
  const s = w.diningSummary();
  const next = w.nextMeal();
  const lines = s.warnings.map((x) => ({ text: x, color: COL.warn }));
  lines.push({ text: `Next: ${next.meal.name} at ${clockText(next.at)}${next.dish ? ` · ${dishById(next.dish).name}` : ''}${next.day !== w.clock.totalDays ? ' (tomorrow)' : ''}`, color: COL.actionDark });
  lines.push(prepLine(w, next));
  const sat = [];
  if (s.avg == null) sat.push({ text: 'No meals served yet', color: COL.textMuted });
  else {
    sat.push({ text: `Home average: ${Math.round(s.avg)}`, color: satColor(s.avg) });
    for (const x of s.lowest) sat.push({ text: `${first(x.name)} ${Math.round(x.avg)}${x.reason !== 'none' ? ` · ${SAT_REASONS[x.reason]}` : ''}`, color: satColor(x.avg) });
  }
  const dayWord = (d) => (d === w.clock.totalDays ? 'today' : d === w.clock.totalDays - 1 ? 'yesterday' : `${w.clock.totalDays - d} days ago`);
  const meals = s.recent.map((r) => ({ text: `${r.name} ${dayWord(r.day)} · quality ${Math.round(r.quality)} · ${r.served} served${r.trays ? ` (${r.trays} on trays)` : ''}${r.late ? ` · ${r.late} late` : ''}${r.mismatched ? ` · ${r.mismatched} not their menu` : ''}`, color: r.quality >= 70 ? COL.good : r.quality >= 45 ? COL.actionDark : COL.warn }));
  return [
    { title: 'Meals', lines, columns: 1, buttons: [{ id: 'dining:menu', label: 'Weekly menu', sub: menuSub(w), icon: TROLLEYS.meal, accent: COL.action, onTap: () => openMenu() }] },
    { title: 'Dining satisfaction', lines: sat },
    { title: 'Last meals', lines: meals.length ? meals : [{ text: 'None yet', color: COL.textMuted }] },
  ];
}
// The Care sheet's Meals line: the home's dining satisfaction and the next meal (a warning first, if there is one).
function mealsSub(w) {
  const s = w.diningSummary();
  const next = w.nextMeal();
  const head = !w.kitchen() ? 'No Kitchen yet' : s.avg != null ? `Dining satisfaction ${Math.round(s.avg)}` : 'No meals yet';
  return `${head} · next: ${next.meal.name} ${clockText(next.at)}`;
}
function menuSub(w) {
  const r = w.menuOn();
  return `Today: ${dishById(r.main).name} · ${dishById(r.pudding).name}`;
}
// The Kitchen (F04 / F16): the next meal's prep, who can cook on shift, the weekly menu.
function kitchenSections(w, it) {
  const next = w.nextMeal();
  const cooks = w.staff.filter((q) => q.role === 'HN' && w.roster.onShift(q.id)).map((q) => first(q.name));
  const best = w.kitchen();
  const lines = [prepLine(w, next), { text: cooks.length ? `Hospitality on shift: ${cooks.join(', ')}` : 'No Hospitality worker on shift: a Care Worker may cook (more slowly)', color: cooks.length ? COL.actionDark : COL.warn }];
  if (best && best.id !== it.id) lines.push({ text: `The ${KITCHENS[best.defId].name} does the cooking`, color: COL.textMuted });
  return [{ title: 'Cooking', lines, columns: 1, buttons: [{ id: 'kitchen:menu', label: 'Weekly menu', sub: menuSub(w), icon: TROLLEYS.meal, accent: COL.action, onTap: () => openMenu() }] }];
}
// The weekly menu (a 7-day rota): tap a day to choose its main (lunch) and pudding (the evening meal).
function openMenu() {
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const rota = w.dining.rota();
    const today = todayDow(w);
    const here = w.residents.filter((r) => !r.state.leaving && !r.state.guest);
    const fans = (id) => here.filter((r) => w.favouritesOf(r.id).includes(id)).map((r) => first(r.name));
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const dow = (today + i) % 7;
      const r = rota[dow];
      const n = new Set([...fans(r.main), ...fans(r.pudding)]).size;
      rows.push({ id: `menu:${dow}`, label: `${TIMETABLE.days[dow]}${i === 0 ? ' (today)' : ''}`, sub: `${dishById(r.main).name} · ${dishById(r.pudding).name}${n ? ` · ${n} favourite${n === 1 ? '' : 's'}` : ''}`, accent: n ? COL.good : COL.progress, onTap: () => openDishPicker(dow) });
    }
    return {
      title: 'Weekly menu',
      subtitle: 'The main is served at lunch, the pudding at the evening meal',
      art: TROLLEYS.meal,
      accent: accentNow(),
      sections: [
        { lines: [{ text: 'A resident whose favourite is on the menu enjoys that day a little more (twice as much with Favourite-Food Boost). Special menus follow each care plan.', color: COL.textMuted }], columns: 1, buttons: rows },
      ],
    };
  });
}
function openDishPicker(dow) {
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    const cur = w.dining.rota()[dow];
    const here = w.residents.filter((r) => !r.state.leaving && !r.state.guest);
    const section = (kind, title) => ({ title, columns: 1, buttons: dishesOf(kind).map((d) => {
      const fans = here.filter((r) => w.favouritesOf(r.id).includes(d.id)).map((r) => first(r.name));
      const on = cur[kind] === d.id;
      return { id: `dish:${kind}:${d.id}`, label: `${on ? '✓ ' : ''}${d.name}`, sub: fans.length ? `A favourite of ${fans.join(', ')}` : 'Nobody here\u2019s favourite', selected: on, accent: on ? COL.good : COL.progress, onTap: () => {
        w.setDish(dow, kind, d.id);
        autosave.request('menu');
      } };
    }) });
    return {
      title: `${TIMETABLE.days[dow]}'s menu`,
      subtitle: `${dishById(cur.main).name} · ${dishById(cur.pudding).name}`,
      accent: accentNow(),
      sections: [
        { columns: 1, buttons: [{ id: 'dish:back', label: '‹ Back to the weekly menu', accent: COL.progress, onTap: () => openMenu() }] },
        section('main', 'Main (lunch)'),
        section('pudding', 'Pudding (evening meal)'),
      ],
    };
  });
}
// --- Milestone 17: memory support ----------------------------------------------------------------------------------------
// Respectful, plain words: a steady routine, familiar faces, their own story, calm places and walks of their own.
const CHANGE_WORDS = { newFace: 'a new face', room: 'a room move', seat: 'a seat change', missed: 'a missed routine step' };
const STIM_WORDS = { high: 'somewhere busy', medium: 'somewhere a little busy', low: 'somewhere quiet', veryLow: 'somewhere very calm', calm: 'somewhere calm' };
function memorySections(w, it) {
  const ms = w.memoryOf(it.id);
  if (!ms) return [];
  const they = theirOf(it.id) === 'her' ? 'she' : 'he';
  const today = Object.entries(ms.kinds ?? {}).map(([k, n]) => `${n > 1 ? `${n} × ` : ''}${CHANGE_WORDS[k] ?? k}`);
  const lines = [
    { text: `Routine: ${ms.status}${ms.status === 'unsettled' ? ' (a few changes lately: familiar faces and a steady day help)' : ''}`, color: ms.status === 'steady' ? COL.good : COL.warn },
    { text: today.length ? `Changes today: ${today.join(', ')}` : 'No changes today', color: COL.textMuted },
    `Life story: ${w.themeOf(it.id)}`,
    { text: `Personal sessions: ${ms.sessions}${ms.lastSession ? ` · last ${ms.lastSession.day === w.clock.totalDays ? 'today' : `${w.clock.totalDays - ms.lastSession.day} day${w.clock.totalDays - ms.lastSession.day === 1 ? '' : 's'} ago`}${ms.lastSession.with ? ` with ${first(w.byId(ms.lastSession.with)?.name ?? '')}` : ''}` : ''}`, color: COL.actionDark },
    { text: `Now ${STIM_WORDS[w.stimulationOf(it.id)] ?? 'somewhere quiet'}`, color: COL.textMuted },
  ];
  if (ms.walk) lines.push({ text: ms.walk.kind === 'path' ? `Out for a walk on the walking path${ms.walk.falls != null ? ` (falls risk ${ms.walk.falls})` : ''}` : `Out for a walk along the corridor: someone will walk back with ${theirOf(it.id) === 'her' ? 'her' : 'him'}`, color: COL.actionDark });
  else if (!w.walkPath) lines.push({ text: `Likes a walk now and then: a safe walking path helps (Build Mode → Walking path)`, color: COL.textMuted });
  lines.push({ text: `Choices honoured: ${ms.choice.honoured} · ${they === 'she' ? 'her' : 'his'} say is always final`, color: COL.textMuted });
  return [{ title: 'Memory support', lines, columns: 1, buttons: [{ id: `memory:lifeStory:${it.id}`, label: 'Offer a life-story session', sub: 'One to one, about their own story', accent: COL.action, onTap: () => {
    const r = w.offerLifeStory(it.id);
    if (r.ok) autosave.request('lifeStory');
  } }] }];
}
// --- Milestone 18: clinical care ------------------------------------------------------------------------------------------
// High-level only: a plain alert word and six choices. No medicines, amounts or diagnoses anywhere.
const scoreColour = (v) => (v >= 70 ? COL.good : v >= 50 ? COL.actionDark : COL.warn);
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`;
function actionSub(w, a, id) {
  const c = w.clinical.canAct(a.id, id);
  if (!c.ok) return c.reason;
  if (id === 'clinician') return `Tomorrow at ${clockText(CLINICIAN.visitAt)} · ${credits(c.cost)} Credits`;
  if (id === 'hospital') return `About ${HOSPITAL.days} days away, room held · ${credits(c.cost)} Credits`;
  if (id === 'escalate') return `${first(w.clinical.senior()?.name ?? 'The senior nurse')} reviews now`;
  return ACTIONS[id].text;
}
function pendingText(w, a) {
  const pd = a.pending;
  const task = pd.task ? w.care.tasks.find((t) => t.id === pd.task) : null;
  const who = task?.slots[0] ? first(w.byId(task.slots[0])?.name ?? '') : null;
  if (pd.action === 'assess') return who ? `${who} is assessing them` : 'A nurse assessment is on its way';
  if (pd.action === 'escalate') return `${first(w.byId(pd.by)?.name ?? 'The senior nurse')} is reviewing them`;
  if (pd.action === 'observe') return `Extra health checks until ${dayName(w, pd.until)}: ${pd.done} of ${pd.due} done`;
  if (pd.action === 'carePlan') return `Update their Clinical/Nursing plan by the end of tomorrow: ${optionById(pd.suggest)?.name ?? 'a new option'} is suggested`;
  if (pd.action === 'clinician') return `The visiting clinician sees them ${pd.day === w.clock.totalDays ? 'today' : 'tomorrow'} at ${clockText(CLINICIAN.visitAt)}`;
  return ACTIONS[pd.action].name;
}
const RESULT_WORDS = { lingering: 'still unsettled', notDone: "didn't happen", well: 'settled', overdone: 'settled' };
function alertSection(w, a, from) {
  const p = w.residentById(a.resident);
  const who = first(p?.name ?? '');
  const lines = [{ text: `${who} seems ${a.word}${a.late ? ' (noticed late: no health check came sooner)' : ''}`, color: COL.bad }];
  const tried = a.actions.filter((x) => x.result);
  if (tried.length) lines.push({ text: `Tried: ${tried.map((x) => `${ACTIONS[x.action].name.toLowerCase()} (${RESULT_WORDS[x.result] ?? x.result})`).join(', ')}`, color: COL.textMuted });
  if (a.pending) lines.push({ text: pendingText(w, a), color: COL.actionDark });
  else if (a.autoAt != null) lines.push({ text: `Choose what to do. With no choice by ${clockText(a.autoAt % 24)}, the nurse on shift acts.`, color: COL.textMuted });
  lines.push({ text: 'High-level choices only: the care team handles the details. The right-sized step works best.', color: COL.textMuted });
  const buttons = ACTION_IDS.map((id) => {
    const c = w.clinical.canAct(a.id, id);
    return { id: `alert:${from}:${id}:${a.id}`, label: ACTIONS[id].name, sub: actionSub(w, a, id), disabled: !c.ok, accent: id === 'hospital' ? COL.warn : COL.action, onTap: () => {
      const r = w.clinical.act(a.id, id);
      if (!r.ok) return;
      autosave.request('alert');
      if (id === 'carePlan') openPlanPicker('CL', a.resident, r.suggest);
    } };
  });
  if (a.pending?.action === 'carePlan') buttons.push({ id: `alert:${from}:plan:${a.id}`, label: 'Open the plan', sub: optionById(a.pending.suggest)?.name ?? '', accent: COL.good, onTap: () => openPlanPicker('CL', a.resident, a.pending?.suggest ?? null) });
  if (from === 'inbox') buttons.push({ id: `alert:inbox:card:${a.id}`, label: `${who}'s card`, sub: 'Their plan, tasks and log', accent: COL.progress, onTap: () => openHomeSheet(a.resident) });
  return { title: `${who}: ${a.word}`, titleDot: a.pending ? null : COL.bad, lines, columns: 2, buttons };
}
// The resident card's Health section: their Clinical/Nursing option, today's rounds and checks, and an alert's choices.
function healthSections(w, it) {
  if (w.isAway(it.id)) return [{ title: 'Health', lines: [{ text: w.stateOf(it), color: COL.actionDark }] }];
  const o = optionById(it.state.plan?.CL);
  const lines = [{ text: `Clinical/Nursing plan: ${o?.name ?? 'not set'}`, color: COL.actionDark }];
  const tasks = w.tasksToday(it.id).filter((t) => t.type === 'meds' || (t.type === 'observation' && t.source !== 'routine'));
  for (const t of tasks.sort((x, y) => (x.at ?? x.opens % 24) - (y.at ?? y.opens % 24))) lines.push({ text: `${clockText(t.at ?? t.opens % 24)}  ${t.type === 'meds' ? 'Medicine round' : t.name} · ${TASK_WORDS[t.status] ?? t.status}`, color: t.status === 'missed' ? COL.bad : t.status === 'done' ? COL.good : COL.textMuted });
  const a = w.clinical.alertOf(it.id);
  if (!a) lines.push({ text: 'No alerts: seems well', color: COL.good });
  return a ? [{ title: 'Health', lines }, alertSection(w, a, 'card')] : [{ title: 'Health', lines }];
}
// The Nurse Station card: the Clinical Safety score, today's rounds, the issues counter, health checks, open alerts.
function clinicalSections(w) {
  const s = w.clinical.score();
  const today = w.clinical.today();
  const rounds = w.clinical.rounds();
  const lines = [
    { text: `Clinical Safety: ${s.score} / 100`, color: scoreColour(s.score) },
    { text: `Last 7 days: round safety ${s.round} · health checks done ${s.obs}% · alerts resolved well ${s.well}%${s.open ? ` · ${s.open} open now` : ''}`, color: COL.textMuted },
    { text: `Round issues: ${w.clinical.state.issues} so far (${s.issues} in the last 7 days)`, color: s.issues ? COL.warn : COL.textMuted },
    { text: `Health checks today: ${today.obs.done} done${today.obs.missed ? `, ${today.obs.missed} missed` : ''}`, color: today.obs.missed ? COL.warn : COL.textMuted },
  ];
  if (!w.layout.ofDef('F02').length) lines.push({ text: 'No Medication Room: the cart is kept here and rounds are less safe. Build one in Build Mode (F02).', color: COL.warn });
  const rl = rounds.length
    ? rounds.map((r) => ({ text: `${r.name}: ${r.collected == null ? 'not started' : `${first(w.byId(r.by)?.name ?? r.by ?? '')} · safety ${r.safety}`} · ${r.done} of ${r.stops || '?'} done${r.late ? `, ${r.late} late` : ''}${r.missed ? `, ${r.missed} missed` : ''}${r.issues.length ? ` · ${r.issues.length} issue${r.issues.length === 1 ? '' : 's'}` : ''}`, color: r.missed || r.issues.length ? COL.warn : COL.actionDark }))
    : [{ text: 'No medicine round yet today.', color: COL.textMuted }];
  const last = [...rounds].reverse().find((r) => r.parts);
  if (last) {
    const P = last.parts;
    rl.push({ text: `${last.name} safety: nurse ${signed(P.nurse)}, workload ${signed(P.workload)}, Medication Room ${signed(P.medRoom)}, complex needs ${signed(P.complexity)}, training ${signed(P.training)}, open alerts ${signed(P.alerts)}${last.mult > 1 ? ` · × ${last.mult} (rooms)` : ''}`, color: COL.textMuted });
  }
  const alerts = w.clinical.alerts();
  const services = [
    { text: `Visiting clinician: every ${TIMETABLE.days[CLINICIAN.visitDay]} (${CLINICIAN.visitFee} Credits for a visit booked for that day; any other day ${CLINICIAN.callOutFee} for next-day)`, color: COL.textMuted },
    { text: `Hospital service: any time, ${HOSPITAL.fee} Credits; about ${HOSPITAL.days} days away with the room held · transfers so far: ${w.clinical.state.transfers ?? 0}`, color: COL.textMuted },
  ];
  return [
    { title: 'Clinical Safety', lines },
    { title: 'Medicine rounds today', lines: rl },
    { title: alerts.length ? `Alerts (${alerts.length})` : 'Alerts', titleDot: alerts.some((a) => !a.pending) ? COL.bad : null, lines: alerts.length ? [] : [{ text: 'Nobody seems unwell right now.', color: COL.good }], columns: 1, buttons: alerts.map((a) => ({ id: `station:alert:${a.id}`, label: `${first(w.residentById(a.resident)?.name ?? '')}: ${a.word}`, sub: a.pending ? pendingText(w, a) : 'Choose what to do', accent: a.pending ? COL.progress : COL.action, onTap: () => openHomeSheet(a.resident) })) },
    { title: 'Services', lines: services },
  ];
}
// The Ledger's Clinical Safety lines and this month's clinical fees (paid as they happen).
function clinicalLedger(w, range) {
  const s = w.clinical.score();
  const fees = w.ledger.economy.ledger.filter((l) => l.day >= range.fromDay && l.category === 'clinical');
  const sum = fees.reduce((t, l) => t + l.amount, 0);
  return { title: 'Clinical Safety', lines: [
    { text: `Clinical Safety: ${s.score} / 100 (round safety ${s.round}, health checks ${s.obs}%, alerts resolved well ${s.well}%)`, color: scoreColour(s.score) },
    { text: `Visiting clinician and hospital service this month: ${fees.length} · ${sum ? '−' : ''}${credits(-sum)} Credits`, color: fees.length ? COL.bad : COL.textMuted },
    { text: 'The home\'s quality scores arrive in a later update; this one is shown for now.', color: COL.textMuted },
  ] };
}
// --- Milestone 19: family trust, visits, meetings, compliments and complaints ----------------------------------------------
// Every Family Trust change shows with its reason; a complaint is an improvement task with an evidence trail, never a cost.
const trustColour = (v) => (v == null ? COL.textMuted : v >= 70 ? COL.good : v >= 50 ? COL.actionDark : COL.warn);
const signed1 = (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v * 10) / 10)}`;
const agoWord = (w, d) => {
  const n = w.clock.totalDays - d;
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
};
const aheadWord = (w, d) => {
  const n = d - w.clock.totalDays;
  return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
};
const familyShown = new Set(); // resident cards showing every Trust change (not just the last few)
let familyMessage = null; // why a request couldn't be agreed (the Inbox shows it)
function bookMeeting(w, residentId, opts, onDone = null) {
  const r = w.family.book(residentId, opts);
  if (r.ok) autosave.request('family');
  onDone?.(r);
  return r;
}
// The resident card's Family section: who, how often they come, Family Trust and why it moved, the family's wishes,
// an open complaint, and booking a care-plan meeting.
function familySection(w, it) {
  const rec = w.family.recordOf(it.id);
  if (!rec?.contact) return { title: 'Family', lines: [{ text: 'No regular visitors', color: COL.textMuted }] };
  const v = w.family.visitOf(it.id);
  const lines = [
    { text: `${w.family.whoOf(it.id)} · visits ${w.family.patternOf(it.id).word}`, color: COL.actionDark },
    { text: v ? `${rec.contact.name} is visiting now` : `Last visit: ${rec.lastVisit == null ? 'not yet' : agoWord(w, rec.lastVisit)}${rec.nextVisit != null ? ` · next: ${aheadWord(w, rec.nextVisit)}` : ''}`, color: v ? COL.good : COL.textMuted },
  ];
  if (rec.meeting) lines.push({ text: `Care-plan meeting booked: ${aheadWord(w, rec.meeting.day)} afternoon${rec.meeting.review ? ' (a review with the family)' : ''}`, color: COL.actionDark });
  if (rec.untold) lines.push({ text: `Not told yet: ${optionById(rec.untold.option)?.name ?? 'a plan change'} (they dislike it). A meeting or a family call tells the family.`, color: COL.warn });
  for (const n of (rec.notes ?? []).slice(-2)) lines.push({ text: `Family wish (${agoWord(w, n.day)}): ${n.text}`, color: COL.actionDark });
  for (const c of w.family.open().filter((x) => x.resident === it.id)) lines.push({ text: `Complaint open: ${c.text}. ${w.family.improvement(c.id).text}`, color: COL.warn });
  const all = familyShown.has(it.id);
  const hist = [...rec.history].reverse().slice(0, all ? 40 : 5);
  lines.push({ text: hist.length ? 'Why Family Trust moved (newest first):' : `No change yet: every family starts at ${TRUST.start}`, color: COL.textMuted });
  for (const h of hist) lines.push({ text: `${signed1(h.change)}  ${agoWord(w, h.day)}: ${h.reason}${h.parts ? ` (${h.parts.map((p) => signed1(p.value)).join(' ')})` : ''}`, color: h.change > 0 ? COL.good : h.change < 0 ? COL.bad : COL.textMuted });
  const can = w.family.canBook();
  const buttons = [
    { id: `family:meet:${it.id}`, label: rec.meeting ? 'Meeting booked' : 'Book a care-plan meeting', sub: rec.meeting ? `${aheadWord(w, rec.meeting.day)} afternoon` : can ? `The Founder or a nurse meets ${rec.contact.name} for an hour (Family Trust +${MEETING.lift})` : 'Needs the Founder or a nurse on the Afternoon shift', disabled: !!rec.meeting || !can, accent: COL.action, onTap: () => bookMeeting(w, it.id, {}) },
  ];
  if (rec.history.length > 5) buttons.push({ id: `family:all:${it.id}`, label: all ? 'Show fewer' : `Show all ${rec.history.length} changes`, accent: COL.progress, onTap: () => (all ? familyShown.delete(it.id) : familyShown.add(it.id)) });
  return { title: 'Family', lines, bars: [{ label: 'Family Trust', value: rec.trust, color: trustColour(rec.trust), text: `${Math.round(rec.trust)}` }], columns: 1, buttons };
}
// A complaint as a card section: the improvement task (description, suggested fix, owner, due date) and its trail.
function complaintSection(w, c, from) {
  const imp = w.family.improvement(c.id);
  const overdue = c.status === 'open' && w.clock.totalDays > c.due;
  const lines = [
    { text: c.text, color: COL.actionDark },
    { text: `Suggested fix: ${c.fixText}`, color: COL.actionDark },
    { text: `Owner: ${c.owner ? w.byId(c.owner)?.name ?? c.owner : 'nobody yet'} · due ${aheadWord(w, c.due)}${overdue ? ': past due, Family Trust drifting down' : ''}`, color: overdue ? COL.bad : COL.textMuted },
    { text: imp.text, color: imp.ok ? COL.good : COL.warn },
    { text: 'Evidence trail:', color: COL.textMuted },
    ...c.trail.map((t) => ({ text: `${agoWord(w, t.day)} ${t.t ?? ''}  ${t.text}`, color: COL.textMuted })),
  ];
  const team = w.team.filter((q) => !q.agency && !q.leftTeam);
  const nextOwner = team[(team.findIndex((q) => q.id === c.owner) + 1) % Math.max(1, team.length)];
  const fix = FIXES[c.fix];
  const buttons = [
    { id: `complaint:${from}:fix:${c.id}`, label: fix.opens === 'roster' ? 'Open the roster' : fix.opens === 'card' ? `${first(c.name)}'s card` : 'Book a care-plan meeting', sub: c.fixText, accent: COL.action, onTap: () => {
      if (fix.opens === 'roster') {
        w.family.noteAction(c.id, 'the roster was opened to add cover');
        openRoster();
      } else if (fix.opens === 'card') {
        w.family.noteAction(c.id, `${first(c.name)}'s card was opened`);
        openHomeSheet(c.resident);
      } else bookMeeting(w, c.resident, { kind: 'complaint' }, (r) => w.family.noteAction(c.id, r.ok ? `a care-plan meeting was booked (${aheadWord(w, r.day)})` : `a meeting could not be booked: ${r.reason}`));
    } },
    { id: `complaint:${from}:done:${c.id}`, label: 'Mark done', sub: imp.ok ? `Family Trust back up (+${Math.abs(c.drop) + COMPLAINT.bonus})` : imp.text, disabled: !imp.ok, accent: COL.good, onTap: () => {
      const r = w.family.markDone(c.id);
      if (r.ok) autosave.request('complaint');
    } },
  ];
  if (nextOwner && team.length > 1) buttons.push({ id: `complaint:${from}:owner:${c.id}`, label: 'Change owner', sub: `Hand it to ${first(nextOwner.name)}`, accent: COL.progress, onTap: () => w.family.setOwner(c.id, nextOwner.id) });
  return { title: `${first(c.name)}: ${COMPLAINTS[c.kind]?.title ?? 'Complaint'}`, titleDot: imp.ok ? COL.good : COL.warn, lines, columns: 2, buttons };
}
// Quality → Compliments & complaints: the home's Family Trust, open improvement tasks with their trails, the resolved ones,
// and the compliments list.
function openQuality() {
  sheet.open(() => {
    const w = open?.world;
    if (!w) return { title: '', sections: [] };
    for (const c of w.family.unseen()) w.family.seenComplaint(c.id);
    const t = w.family.trust();
    const openList = w.family.open();
    const resolved = w.family.complaints().filter((c) => c.status === 'resolved').slice(-6).reverse();
    const compliments = [...w.family.compliments()].reverse().slice(0, 10);
    const n = w.residents.filter((p) => !p.state.leaving && w.family.recordOf(p.id)?.contact).length;
    return {
      title: 'Compliments & complaints',
      subtitle: `Family Trust ${t == null ? '—' : Math.round(t)} / 100 · ${openList.length} open · ${compliments.length ? `${w.family.compliments().length} compliments` : 'no compliments yet'}`,
      art: FAMILY_ICONS.trust,
      accent: accentNow(),
      sections: [
        { lines: [{ text: t == null ? 'No families yet.' : `Family Trust: ${Math.round(t)} / 100, the average over ${n} famil${n === 1 ? 'y' : 'ies'}`, color: trustColour(t) }, { text: 'A complaint becomes an improvement task: fix what went wrong, then mark it done to win the family’s trust back. Complaints never cost Credits. Left past the due date, trust drifts down slowly.', color: COL.textMuted }], bars: t == null ? [] : [{ label: 'Family Trust', value: t, color: trustColour(t), text: `${Math.round(t)}` }] },
        ...(openList.length ? openList.map((c) => complaintSection(w, c, 'quality')) : [{ title: 'Open complaints', lines: [{ text: 'None open.', color: COL.good }] }]),
        { title: 'Resolved', lines: resolved.length ? resolved.flatMap((c) => [{ text: `${first(c.name)}: ${COMPLAINTS[c.kind]?.title ?? ''} · raised ${agoWord(w, c.raised)}, resolved ${agoWord(w, c.resolved)} · Family Trust ${signed1(c.drop)} then ${signed1(c.recovered)}${c.drifted ? ` (drifted ${signed1(c.drifted)})` : ''}`, color: COL.actionDark }, ...c.trail.map((x) => ({ text: `   ${agoWord(w, x.day)}  ${x.text}`, color: COL.textMuted }))]) : [{ text: 'Nothing resolved yet.', color: COL.textMuted }] },
        { title: `Compliments${compliments.length ? ` (${w.family.compliments().length})` : ''}`, lines: compliments.length ? compliments.map((k) => ({ text: `${agoWord(w, k.day)}: ${k.text}${k.staff.length ? ` · ${k.staff.map((id) => first(w.byId(id)?.name ?? id)).join(', ')} +${k.morale} Morale` : ''} · Family Trust ${signed1(k.trust)}`, color: COL.good })) : [{ text: 'None yet. Good visits, birthdays done well and residents going home after rehab bring them.', color: COL.textMuted }] },
      ],
    };
  });
}
// The Inbox's family items: a meeting the family asked for, a room or party request, a new complaint.
function familyInbox(w) {
  const out = [];
  const can = w.family.canBook();
  for (const a of w.family.asks()) {
    const p = w.residentById(a.resident);
    out.push({ title: `${w.family.whoOf(a.resident)}: a care-plan meeting`, lines: [{ text: `${w.family.whoOf(a.resident)} would like a care-plan meeting about ${w.family.callOf(a.resident)}${a.why === 'low' ? ': they are not happy with how things are going' : ': the plan is due for a review'}.`, color: COL.actionDark }], columns: 2, buttons: [
      { id: `ask:book:${a.id}`, label: a.why === 'review' ? 'Book a review with them' : 'Book a meeting', sub: can ? `The Founder or a nurse attends for an hour · Family Trust +${MEETING.lift}` : 'Needs the Founder or a nurse on the Afternoon shift', disabled: !can, accent: COL.good, onTap: () => {
        const r = w.family.answerAsk(a.id, true);
        if (r.ok) autosave.request('family');
      } },
      { id: `ask:later:${a.id}`, label: 'Not now', sub: `Kindly · Family Trust ${signed1(MEETING_ASK.declineTrust)}`, accent: COL.progress, onTap: () => {
        w.family.answerAsk(a.id, false);
        autosave.request('family');
      } },
      ...(p ? [{ id: `ask:card:${a.id}`, label: `${first(p.name)}'s card`, sub: 'Their plan and family', accent: COL.progress, onTap: () => openHomeSheet(p.id) }] : []),
    ] });
  }
  const message = familyMessage;
  for (const q of w.family.requests()) {
    const R = REQUESTS[q.kind];
    out.push({ title: q.title, lines: [{ text: q.text, color: COL.actionDark }, ...(message ? [{ text: message, color: COL.bad }] : []), { text: `An answer by ${aheadWord(w, q.until + 1)}; no answer is taken as a kind no.`, color: COL.textMuted }], columns: 2, buttons: [
      { id: `request:yes:${q.id}`, label: 'Agree', sub: `${q.kind === 'birthdayParty' ? 'The family comes to the birthday tea' : `Moves to room ${w.roomNumber(q.room)} now`} · Family Trust +${R.agreeTrust}`, accent: COL.good, onTap: () => {
        const r = w.family.answerRequest(q.id, true);
        familyMessage = r.ok ? null : r.reason;
        if (r.ok) autosave.request('family');
      } },
      { id: `request:no:${q.id}`, label: 'Kindly decline', sub: `Family Trust ${signed1(REQUEST.declineTrust)}`, accent: COL.progress, onTap: () => {
        w.family.answerRequest(q.id, false);
        autosave.request('family');
      } },
    ] });
  }
  for (const c of w.family.unseen()) out.push({ title: `A complaint from ${c.from}`, titleDot: COL.warn, lines: [{ text: c.text, color: COL.actionDark }, { text: `Improvement task: ${c.fixText} · no Credits lost`, color: COL.textMuted }], columns: 1, buttons: [{ id: `complaint:inbox:${c.id}`, label: 'Open the improvement task', sub: 'Quality → Compliments & complaints', accent: COL.action, onTap: () => openQuality() }] });
  return out;
}
const familyWaiting = () => (open?.world?.family ? open.world.family.asks().length + open.world.family.requests().length + open.world.family.unseen().length : 0);
// Quality's badge: new complaints, and open ones ready to mark done.
const qualityBadge = () => (open?.world?.family ? open.world.family.unseen().length + open.world.family.open().filter((c) => open.world.family.improvement(c.id).ok).length || null : null);
// The Reception / Family Desk card: Family Trust, today's visits, meetings booked, what is waiting.
function familyDeskSections(w) {
  const t = w.family.trust();
  const today = w.family.visitsToday();
  const booked = w.residents.map((p) => ({ p, m: w.family.recordOf(p.id)?.meeting })).filter((x) => x.m);
  const low = w.residents.filter((p) => !p.state.leaving && w.family.recordOf(p.id)?.contact).map((p) => ({ p, t: w.family.recordOf(p.id).trust })).sort((a, b) => a.t - b.t).slice(0, 3);
  const lines = [
    { text: t == null ? 'Family Trust: no families yet' : `Family Trust: ${Math.round(t)} / 100 (the home's average)`, color: trustColour(t) },
    ...today.map((v) => ({ text: `${w.family.whoOf(v.resident)} → ${first(w.residentById(v.resident)?.name ?? '')}: ${v.phase === 'due' ? `expected at ${clockText(v.at % 24)}` : v.phase === 'leaving' ? 'on the way out' : v.phase === 'with' ? 'visiting now' : 'arriving'}${v.meeting ? ' (care-plan meeting)' : v.party ? ' (birthday party)' : ''}`, color: v.phase === 'with' ? COL.good : COL.textMuted })),
    ...(today.length ? [] : [{ text: 'No visitors expected today.', color: COL.textMuted }]),
    ...booked.map((x) => ({ text: `Meeting: ${first(x.p.name)}'s family, ${aheadWord(w, x.m.day)} afternoon`, color: COL.actionDark })),
    ...(low.length ? [{ text: `Lowest trust: ${low.map((x) => `${first(x.p.name)} ${Math.round(x.t)}`).join(' · ')}`, color: COL.textMuted }] : []),
  ];
  const waiting = familyWaiting();
  return [{ title: 'Families', lines, bars: t == null ? [] : [{ label: 'Family Trust', value: t, color: trustColour(t), text: `${Math.round(t)}` }], columns: 1, buttons: [{ id: 'desk:quality', label: 'Compliments & complaints', sub: `${w.family.open().length} open · ${w.family.compliments().length} compliments${waiting ? ` · ${waiting} in the Inbox` : ''}`, icon: FAMILY_ICONS.complaint, accent: COL.action, onTap: () => openQuality() }] }];
}
// --- Milestone 16: mobility, rehab goals, falls risk, discharge ----------------------------------------------------------
const REHAB_COLOUR = { 'Ready to go home': COL.good, 'On track': COL.good, Slow: COL.warn, 'Just started': COL.actionDark };
function readyNotice(w, r, from) {
  const left = r.autoDay - w.clock.totalDays;
  return { title: `${first(r.name)} is ready to go home`, lines: [
    { text: 'Every rehab goal is met. Keeping them longer brings nothing extra: their funding drops to the ready-to-go-home rate.', color: COL.actionDark },
    { text: r.kept ? 'Kept on for now: no extra funding or reward while they stay.' : left > 0 ? `They go home on their own in ${left} day${left === 1 ? '' : 's'} if you don't send them sooner.` : 'They go home today.', color: r.kept ? COL.warn : COL.textMuted },
  ], columns: 2, buttons: [
    { id: `discharge:${from}:${r.id}`, label: 'Send home now', sub: `With family · +${DISCHARGE.rewards.reputation} Reputation, +${DISCHARGE.rewards.research} Research`, accent: COL.good, onTap: () => {
      const res = w.discharge(r.id);
      if (res.ok) autosave.request('discharge');
      if (from === 'card') sheet.close();
    } },
    { id: `keep:${from}:${r.id}`, label: r.kept ? 'Kept on' : 'Keep for now', sub: 'Brings nothing extra', disabled: !!r.kept, accent: COL.progress, onTap: () => {
      w.keepForNow(r.id);
      autosave.request('discharge');
    } },
  ] };
}
function rehabSections(w, it) {
  const st = it.state;
  const out = [];
  const m = st.mobility;
  if (m) {
    const f = w.fallsOf(it.id);
    const mods = (f?.parts ?? []).filter((x) => x.key !== 'level' && x.key !== 'aid').map((x) => `${x.text} ${x.value > 0 ? '+' : ''}${Math.round(x.value)}`);
    out.push({ title: 'Mobility', lines: [
      { text: `${AIDS[m.aid].name}${m.aid === 'none' ? '' : ` · walks at ${Math.round(AIDS[m.aid].speed * 100)}% of the usual pace`}`, color: COL.actionDark },
      { text: `Falls risk ${f.risk} (${f.band})${mods.length ? ` · ${mods.join(' · ')}` : ''}`, color: f.band === 'High' ? COL.warn : COL.textMuted },
      { text: 'Stored for the care team; falls themselves are not in the game yet.', color: COL.textMuted },
    ], bars: [{ label: 'Mobility level', value: m.level, color: COL.progress }] });
  }
  const r = st.rehab;
  if (r?.active) {
    const status = w.rehabStatus(it.id);
    const lines = [
      { text: status, color: REHAB_COLOUR[status] ?? COL.actionDark },
      { text: `Therapy at ${w.therapySpaceOf(it.id)} · ${r.sessions} session${r.sessions === 1 ? '' : 's'}${r.missed ? ` · ${r.missed} missed` : ''} · the marks are ${theirOf(it.id)} targets`, color: COL.textMuted },
    ];
    if (st.outcomes.mood < 40) lines.push({ text: 'Low Mood is slowing progress', color: COL.warn });
    if (st.needs.nutrition > 60) lines.push({ text: 'Not eating well: progress is slower', color: COL.warn });
    out.push({ title: 'Rehab goals', lines, bars: GOALS.map((g) => ({ label: g.name, value: r.goals[g.id], tick: r.targets[g.id], color: r.goals[g.id] >= r.targets[g.id] ? COL.good : COL.progress, text: `${Math.round(r.goals[g.id])}/${r.targets[g.id]}` })) });
    if (r.readyDay != null && !st.leaving) out.push(readyNotice(w, { id: it.id, name: it.name, readyDay: r.readyDay, autoDay: r.readyDay + DISCHARGE.autoDays, kept: !!r.kept }, 'card'));
  }
  return out;
}
// Milestone 13: pin a team member to a small group of residents (tap to add / remove; up to CONTINUITY.maxResidents).
function openContinuity(staffId) {
  let message = null;
  sheet.open(() => {
    const w = open?.world;
    const q = w?.byId(staffId);
    if (!q) return { title: '', sections: [] };
    const grp = w.continuityOf(staffId);
    const rows = w.residents.filter((r) => !r.state.leaving && !r.state.guest).map((r) => {
      const on = grp.includes(r.id);
      return { id: `pin:${r.id}`, label: `${on ? '✓ ' : ''}${r.name}`, sub: `${r.def.support} · familiarity ${Math.round(familiarityOfCare(w, r.id, staffId))}`, icon: r.art, iconCrop: PORTRAIT_CROP, selected: on, accent: on ? COL.good : COL.progress, onTap: () => {
        const res = w.toggleContinuity(staffId, r.id);
        message = res.ok ? null : res.reason;
        if (res.ok) autosave.request('roster');
      } };
    });
    return {
      title: `${first(q.name)}'s residents`,
      subtitle: `Continuity group · ${grp.length} of ${CONTINUITY.maxResidents}`,
      art: q.art,
      badge: ROLES[q.role].badge,
      accent: accentNow(),
      sections: [
        { lines: [...(message ? [{ text: message, color: COL.bad }] : []), { text: 'Tap a resident to add or remove them. When on shift, they are preferred for these residents; nobody is held back when they are off.', color: COL.textMuted }] },
        { columns: 1, buttons: rows },
        { columns: 1, buttons: [{ id: 'group:back', label: '‹ Back to the roster', accent: COL.progress, onTap: () => openRoster() }] },
      ],
    };
  });
}
const familiarityOfCare = (w, residentId, staffId) => w.topStaffFor(residentId, 99).find((r) => r.staff === staffId)?.familiarity ?? 0;
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
    const t = open?.world?.family?.trust() ?? null; // (Milestone 19: the home's Family Trust, in the top area)
    return {
      title: slot.title,
      subtitle: slot.text,
      art: slot.icon,
      accent: accentNow(),
      sections: [
        { lines: [{ text: t == null ? 'Family Trust: no families yet' : `Family Trust: ${Math.round(t)} / 100 (every family's average)`, color: trustColour(t) }], bars: t == null ? [] : [{ label: 'Family Trust', value: t, color: trustColour(t), text: `${Math.round(t)}` }], columns: 1, buttons: [{ id: 'business:family', label: 'Compliments & complaints', sub: open?.world ? `${open.world.family.open().length} open · ${open.world.family.compliments().length} compliments` : '', icon: FAMILY_ICONS.trust, accent: COL.action, onTap: () => openQuality() }] },
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
      // Milestone 16: the care-outcome counters (Reputation and Research Points are spent in later updates)
      { title: 'Care outcomes', lines: [
        { text: `Successful discharges: ${w.rewards.positiveOutcomes}${w.rewards.discharges.length ? ` (last: ${first(w.rewards.discharges.at(-1).name)})` : ''}`, color: COL.actionDark },
        `Reputation: ${w.rewards.reputation} · Research Points: ${w.rewards.research}`,
        { text: `Rehab funding: ${REHAB_FUNDING.perMonth} Credits a month for each resident working on their goals (paid at the close)`, color: COL.textMuted },
      ] },
      clinicalLedger(w, range),
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
  if (st.leaving) return st.rehab?.dischargedDay != null ? `${t}: rehab complete, heading home with family` : `${t}: the stay is over, heading home today`;
  if (st.rehab?.active) return st.rehab.readyDay != null ? `${t}: ready to go home` : `${t}: goes home when ${theirOf(it.id)} rehab goals are met`; // (Milestone 16)
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
    const cards = sf.board.map((c) => ({ id: `cand:${c.id}`, label: `${c.name} · ${TIERS[c.tier].name}`, sub: `${ROLES[c.role].name} · Lv ${c.level} · ${c.salary} a month · ${TRAITS[c.trait]?.name ?? ''}`, icon: c.art, iconCrop: PORTRAIT_CROP, iconBadge: ROLES[c.role].badge, tag: TIER_TAG[c.tier] ?? null, accent: TIER_ACCENT[c.tier] ?? COL.progress, onTap: () => openCandidate(c.id) }));
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
        ...(debug.enabled ? [{ title: 'Debug', columns: 1, buttons: [
          { id: 'chan:debug', label: `Open every channel and training without a room (debug): ${sf.debug ? 'On' : 'Off'}`, sub: 'Also counts as the Rank the Rare and Elite rules ask for', accent: sf.debug ? COL.good : COL.progress, onTap: () => sf.setDebug(!sf.debug) },
          { id: 'chan:elite', label: `Unlock Elite staff (debug): ${sf.eliteUnlock ? 'On' : 'Off'}`, sub: 'Counts every Elite condition as met. Legendary and Secret staff never appear on a board.', accent: sf.eliteUnlock ? COL.good : COL.progress, onTap: () => {
            sf.setEliteUnlock(!sf.eliteUnlock);
            autosave.request('debug');
          } },
        ] }] : []),
        { columns: 1, buttons: [{ id: 'recruit:back', label: '‹ Back to the roster', accent: COL.progress, onTap: () => openRoster() }] },
      ],
    };
  });
}
// Milestone 12: the tier's tag and accent on a candidate, and every trait as lines (a pending one says it comes later;
// a signature is marked).
const TIER_TAG = { rare: 'RARE', elite: 'ELITE', legendary: 'LEGENDARY', secret: 'PRESTIGE' };
const TIER_ACCENT = { rare: COL.gold, elite: COL.action, legendary: COL.gold, secret: COL.gold };
function traitLines(ids) {
  return ids.map((id) => TRAITS[id]).filter(Boolean).map((t) => (t.pendingSystem
    ? { text: `${t.signature ? 'Signature · ' : ''}${t.name}: ${t.text} (comes into play in a later update)`, color: COL.textMuted }
    : `${t.name}: ${t.text}`));
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
    const def = STAFF.find((d) => d.id === c.personId);
    return {
      title: c.name,
      subtitle: `${ROLES[c.role].name} · ${TIERS[c.tier].name} · Lv ${c.level}`,
      art: c.art,
      badge: ROLES[c.role].badge,
      tag: TIER_TAG[c.tier] ? { text: TIER_TAG[c.tier] } : null,
      accent: accentNow(),
      sections: [
        { lines: [...(message ? [{ text: message, color: COL.bad }] : []), `Salary ${c.salary} Credits a month · prefers ${PREF_WORD[c.shiftPref] ?? '—'} shifts`, ...traitLines(c.traits ?? [c.trait]), { text: `From ${CHANNELS.find((x) => x.id === c.channel)?.name ?? 'the board'}${def?.rule && c.tier !== 'standard' ? ` · eligible: ${def.rule.text}` : ''}`, color: COL.textMuted }] },
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
    { lines: [{ text: step ? `${step}: ${w.stateOf(it)}` : w.stateOf(it), color: COL.actionDark }, ...(bell ? [{ text: `Call bell ringing (${needName(bell.need)})`, color: COL.bad }] : []), `${room} · Support Level ${supportLevel(it.def)}`, `${WAKE.windows[wakeWindowOf(it.def)].name} · gets up at ${clockText(st.wakeAt ?? 7)}`, { text: stayLine(w, it), color: st.stay ? COL.actionDark : COL.textMuted }] },
    { title: 'Life story', lines: [it.def.story, { text: (st.tags?.length ? st.tags : it.def.tags).join(' · '), color: COL.actionDark }, ...(st.returning ? [{ text: 'Returning: stayed here before', color: COL.good }] : [])] },
    planSection(w, it),
    ...healthSections(w, it),
    { title: 'Tasks today', lines: taskLines(w, it) },
    { title: 'Call bells', lines: bellLines(w, it, they) },
    familiarSection(w, it),
    friendsSection(w, it),
    familySection(w, it), // (Milestone 19)
    activitySection(w, it),
    mealsSection(w, it),
    ...rehabSections(w, it),
    ...memorySections(w, it),
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
  // Milestone 19: a review can include the family (a care-plan meeting; reviewed when it is held)
  const rec = w.family.recordOf(it.id);
  if (rec?.contact) buttons.push({ id: 'plan:reviewFamily', label: 'Review with family', sub: rec.meeting ? `Meeting booked: ${aheadWord(w, rec.meeting.day)} afternoon` : w.family.canBook() ? `With ${rec.contact.name}: reviewed when the meeting is held (Family Trust +${MEETING.lift})` : 'Needs the Founder or a nurse on the Afternoon shift', disabled: !!rec.meeting || !w.family.canBook(), accent: COL.action, onTap: () => bookMeeting(w, it.id, { review: true }) });
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
const TASK_WORDS = { open: 'to do', claimed: 'on the way', working: 'being helped', done: 'done', missed: 'missed', refused: 'said no', self: 'on their own', unstaffed: 'no one on shift', scaled: 'scaled back (short-staffed)', away: 'away (hospital service)' };
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
// Milestone 12: the three staff on the team who know them best (a Familiar Care record each: familiarity 0–100, tasks
// together, when they first met), with a small bar each.
// Milestone 13: a small heart drawn in code beside the favourite staff member's line.
function heartGlyph(ctx, x, y, size) {
  const s = size * 0.9;
  const cx = x + s / 2;
  const top = y + s * 0.3;
  ctx.fillStyle = COL.bad;
  ctx.beginPath();
  ctx.moveTo(cx, y + s * 0.95);
  ctx.bezierCurveTo(x - s * 0.1, y + s * 0.55, x + s * 0.05, y, cx, top);
  ctx.bezierCurveTo(x + s * 0.95, y, x + s * 1.1, y + s * 0.55, cx, y + s * 0.95);
  ctx.fill();
}
function familiarSection(w, it) {
  const top = w.topStaffFor(it.id, 3);
  const lines = top.length ? [] : [{ text: 'Nobody knows them well yet: familiarity builds with every task done together.', color: COL.textMuted }];
  // Milestone 13: the favourite (most familiar, at least FAVOURITE.at) with a heart; their usual carers (continuity)
  const fav = w.favouriteOf(it.id);
  if (fav) lines.push({ text: `Favourite: ${w.byId(fav)?.name ?? fav}`, color: COL.actionDark, glyph: heartGlyph });
  const usual = w.usualCarers(it.id);
  lines.push({ text: usual.length ? `Usual carers: ${usual.map((id) => first(w.byId(id)?.name ?? id)).join(', ')}` : 'Usual carers: none yet (pin a continuity group on the roster)', color: usual.length ? COL.text : COL.textMuted });
  if (top.length) {
    lines.push({ text: `Most familiar: ${w.byId(top[0].staff)?.name ?? top[0].staff}`, color: COL.actionDark });
    lines.push({ text: `Tasks together: ${top.map((r) => `${first(w.byId(r.staff)?.name ?? r.staff)} ${r.tasks}${r.firstDay != null ? ` (since day ${r.firstDay + 1})` : ''}`).join(' · ')}`, color: COL.textMuted });
  }
  return { title: 'Familiar Care', lines, bars: top.map((r) => ({ label: w.byId(r.staff)?.name ?? r.staff, value: Math.round(r.familiarity), max: 100, color: COL.good })) };
}
// Milestone 13: their three best friends here (friendship 0–100), a bar each; friends (≥ FRIENDSHIP.friendAt) are named.
function friendsSection(w, it) {
  const top = w.friendsOf(it.id, 3);
  const name = (id) => w.residentById(id)?.name ?? id;
  const friends = top.filter((r) => r.friendship >= FRIENDSHIP.friendAt);
  const lines = top.length
    ? [{ text: friends.length ? `Friends: ${friends.map((r) => first(name(r.other))).join(', ')}` : 'Getting to know the others at meals and activities', color: friends.length ? COL.actionDark : COL.textMuted }]
    : [{ text: 'No friendships yet: they grow at shared meals, activities and neighbouring seats.', color: COL.textMuted }];
  return { title: 'Friends', lines, bars: top.map((r) => ({ label: name(r.other), value: Math.round(r.friendship), max: 100, color: COL.gold })) };
}
// "Mobility for Betty" (Milestone 8: all eight options): each row says whether it can be chosen (greyed with the
// reason when not), the current one and their like / dislike / refusal. Tap a row to see it; Choose to take it.
const NEED_WORDS = Object.fromEntries(NEEDS.map((n) => [n.id, n.name]));
const OUTCOME_WORDS = Object.fromEntries(OUTCOMES.map((o) => [o.id, o.name]));
function openPlanPicker(domainId, residentId, suggest = null) {
  let looking = suggest; // the option tapped (its details and Choose); Milestone 18: the one an alert suggests
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
      if (o.id === suggest) lines.push({ text: 'Suggested for the alert: a plan that fits how they are now', color: COL.good });
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
  const isFounder = w.staffState.founder.id === p.id && !w.staffState.founder.ended;
  const h = w.staffState.founder.history;
  const agency = w.roster.isAgency(p.id);
  const pref = STAFF.find((d) => d.id === p.id)?.shiftPref;
  const wing = w.roster.wingOf(p.id);
  const shiftLines = agency
    ? [w.roster.label(p.id), 'Agency worker: booked for this shift only; builds no Familiar Care and is never on records.']
    : [w.roster.label(p.id), `Prefers ${PREF_WORD[pref] ?? '—'} shifts${pref !== 'night' ? ' · Night shifts cost a little Morale' : ''} · ${wing ? `${WINGS.find((x) => x.id === wing)?.name} wing` : w.roster.isFloat(p.id) ? 'float: tied to no wing' : 'no wing'}`];
  const status = [m.status.tired && 'Tired', m.status.stressed && 'Stressed'].filter(Boolean);
  const fam = w.topResidentsFor(p.id, 3); // (Milestone 12: the three residents here who know them best)
  const sections = [
    { lines: [{ text: w.stateOf(p), color: COL.actionDark }, ...shiftLines, agency ? `Tasks helped with: ${m.counters.tasks ?? 0} · Fee ${SHORT_STAFFING.agencyFeePerShift} Credits a shift` : `Tasks helped with: ${m.counters.tasks ?? 0} · Salary ${m.salary} Credits a month`] },
    { title: 'Stats', bars: STATS.map((s) => ({ label: s.name, value: m.stats[s.id], max: cap, color: s.id === ROLES[m.role].primaryStat ? COL.action : COL.progress })) },
    { title: status.length ? `Energy and Morale · ${status.join(', ')}` : 'Energy and Morale', bars: [{ label: 'Energy', value: m.energy, color: m.energy < 25 ? COL.bad : COL.good }, { label: 'Morale', value: m.morale, color: m.morale < 25 ? COL.bad : COL.gold }] },
    { title: m.traits.length > 1 ? 'Traits' : 'Trait', lines: m.traits.length ? traitLines(m.traits) : ['None'] },
  ];
  if (!agency) {
    const grp = w.continuityOf(p.id);
    sections.push({ title: 'Continuity group', lines: [{ text: grp.length ? `${first(p.name)}'s residents: ${grp.map((id) => first(w.residentById(id)?.name ?? id)).join(', ')}` : 'No residents pinned: they help whoever needs it most', color: grp.length ? COL.actionDark : COL.textMuted }], columns: 1, buttons: [{ id: `group:${p.id}`, label: grp.length ? 'Change their residents' : 'Pin residents to them', sub: `Up to ${CONTINUITY.maxResidents}: they are preferred for these residents when on shift`, accent: COL.progress, onTap: () => openContinuity(p.id) }] });
    const famLines = fam.length
      ? [...fam.filter((r) => w.mostFamiliar(r.resident) === p.id).map((r) => ({ text: `${first(w.residentById(r.resident)?.name ?? r.resident)}'s most familiar staff member`, color: COL.actionDark })), { text: `Tasks together: ${fam.map((r) => `${first(w.residentById(r.resident)?.name ?? r.resident)} ${r.tasks}`).join(' · ')}`, color: COL.textMuted }]
      : [{ text: 'Not familiar with anyone yet: it builds with every task done together.', color: COL.textMuted }];
    sections.push({ title: 'Familiar Care', lines: famLines, bars: fam.map((r) => ({ label: w.residentById(r.resident)?.name ?? r.resident, value: Math.round(r.familiarity), max: 100, color: COL.good })) });
  }
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
    if (it.defId === 'F05') sections.push({ columns: 1, buttons: [{ id: 'place:activities', label: 'Activities', sub: activitiesSub(w), accent: COL.action, onTap: () => openActivities() }] });
    if (it.defId === 'F05') {
      // Milestone 13: the activity groups (regulars: they prefer it, or have joined it often)
      for (const g of ACTIVITY_GROUPS) {
        const members = w.activityGroup(g.id).map((id) => first(w.residentById(id)?.name ?? id));
        lines.push({ text: members.length ? `${g.name}: ${members.join(', ')}` : `${g.name}: no regulars yet`, color: members.length ? COL.actionDark : COL.textMuted });
      }
    }
    if (it.defId === 'F03') sections.push(...diningSections(w)); // (Milestone 15)
    if (it.defId === 'F04' || it.defId === 'F16') sections.push(...kitchenSections(w, it));
    // Milestone 17: the memory-support places
    if (it.defId === 'F21' || it.defId === 'F22' || it.defId === 'F06') lines.push({ text: w.calmPlace()?.id === it.id ? 'A calm place: residents with memory support have their morning rest here' : 'A calm place to sit', color: COL.actionDark });
    if (it.defId === 'F20') lines.push({ text: 'Life-story time and memory-care sessions go further here', color: COL.actionDark });
    if (it.defId === 'F22' && !w.walkPath) lines.push({ text: 'Mark a safe walking path round it in Build Mode (Walking path)', color: COL.textMuted });
    if (it.defId === 'F17') lines.push({ text: 'Plans every special menu (soft, balanced, small plates, hearty), whoever is cooking', color: COL.actionDark });
    // Milestone 18: the clinical places
    if (it.defId === 'F01') sections.push(...clinicalSections(w));
    if (it.defId === 'F02') lines.push({ text: 'The Medication Cart is kept here: each medicine round starts here (round safety +8%)', color: COL.actionDark });
    if (it.defId === 'F23') lines.push({ text: 'Moderate alerts can be handled in-house: assessments and senior reviews go further', color: COL.actionDark });
    if (it.defId === 'F28') lines.push({ text: 'Medicine rounds are safer and better recorded (round safety +10%)', color: COL.actionDark });
    if (it.defId === 'F09') sections.push(...familyDeskSections(w)); // (Milestone 19)
    if (it.defId === 'F15') lines.push({ text: `Visits happen here when the resident is free, and family meetings go ${MEETING.familyRoomPct}% further`, color: COL.actionDark });
    if (it.defId === 'F29') lines.push({ text: `Every Family Trust gain goes ${TRUST.partnershipPct}% further`, color: COL.actionDark });
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
let staffArtReport = null;
const bootScreen = {
  progress: 0,
  enter() {
    this.progress = 0;
    Promise.all([
      assets.loadImages(ASSETS, (done, total) => (this.progress = done / total)).then((r) => {
        debug.log(`assets: ${r.loaded} loaded, ${r.missing.length} missing`);
        // Milestone 12: every staff member's portrait and every role badge loaded, no two staff sharing art (agency aside)
        if (debug.enabled) {
          staffArtReport = checkStaffArt((p) => assets.has(p.split('/').pop().replace('.png', '')), { agency: AGENCY });
          debug.log(staffArtReport.problems.length ? `staff art: ${staffArtReport.problems.join('; ')}` : `staff art: ${staffArtReport.checked.portraits} portraits, ${staffArtReport.checked.badges} badges mapped`);
        }
      }),
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
  window.__cw = { renderer, layout, input, loop, router, assets, sheet, dialog, systemBack, textPrompt, menuScreen, slotsScreen, setupScreen, homeScreen, topBar, topBarCredits: () => balanceNow(), bottomBar, vfx, carePops, dayBeat, openBottom, get lastRoute() { return lastRoute; }, playSlot, startFacility, deleteSlot, newGame, taps: [], autosave, saveRun, openRecruit, openCandidate, openCourses, openContinuity, openHomeSheet, openActivities, openSlotPicker, openInbox, openLedger, openQuality, openBusiness, openMenu, openDishPicker, confirmLetGo, openDevelop, openBuildList, confirmSell, upgradeStage, get bigBeat() { return bigBeat; }, startSpawnCheck, get spawning() { return !!spawn; }, spawnReport: null, get staffArtReport() { return staffArtReport; }, get campaigns() { return campaigns; }, get open() { return open; } };
}

router.go('boot');
loop.start();
