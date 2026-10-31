// The first-week guide (Milestone 34) on core/GuideSystem: Rosie's five steps (data/guide.js) as light tips — never a
// pause, never a blocked tap. A step finishes itself when its event fires (core advance.event); one done before its
// turn counts too (core skipIf), so the steps can be done in any order the game allows.
//   createFirstWeekGuide({ bus, canShow, applies }) → { core, load(saved), save(), welcome, … }
//     canShow() → false while anything else is up (the page's pop-ups, Build Mode, the welcome card not answered yet)
//     applies(step) → false when a step makes no sense now (core `when`: it counts as done)
//   guideStart({ saved, ngPlus, finishedBefore }) → the state a home opens with:
//     a saved one as it is; an NG+ home or a player who has finished (or skipped) the guide before: off;
//     otherwise a fresh guide whose welcome card is due (src/main.js puts it in the director's queue)
//   Saved (the run save's `guide`): core's { done, seen, events, off, current } plus welcome ('due' | 'asked' | 'done'),
//   why (why it started off: 'ngPlus' | 'repeat' | 'old'), ended (Rosie's closing line given), hints ([{ id, text }] the next-step hints Rosie has given).
import { GuideSystem } from '../../../../core/GuideSystem.js';
import { GUIDE_STEPS, GUIDE_STEP_IDS } from '../../data/guide.js';

const HINTS_KEPT = 24;

export function guideStart({ saved = null, ngPlus = 0, finishedBefore = false } = {}) {
  if (saved && typeof saved === 'object') return saved;
  const off = ngPlus > 0 || finishedBefore;
  return { done: [], seen: [], events: [], off, current: null, welcome: off ? 'done' : 'due', why: ngPlus > 0 ? 'ngPlus' : finishedBefore ? 'repeat' : null, hints: [] };
}

export function createFirstWeekGuide({ bus, canShow = () => true, applies = () => true }) {
  let welcome = 'done';
  let why = null;
  let hints = [];
  let ended = false; // the last step done and Rosie's closing line given
  const steps = GUIDE_STEPS.map((s) => ({ id: s.id, title: s.title, text: s.text, tip: true, advance: { event: s.event }, skipIf: s.event, ...(s.when ? { when: s.when } : {}) }));
  const core = new GuideSystem({ steps, bus, targetRect: () => null, screen: () => 'home', canShow: () => welcome === 'done' && canShow(), applies });
  const api = {
    core,
    get welcome() {
      return welcome;
    },
    set welcome(v) {
      welcome = v;
    },
    get ended() {
      return ended;
    },
    set ended(v) {
      ended = !!v;
    },
    get why() {
      return why;
    },
    get off() {
      return core.state.off;
    },
    get step() {
      return core.current ? GUIDE_STEPS.find((s) => s.id === core.current.id) : null;
    },
    get showing() {
      return core.active;
    },
    get doneCount() {
      return GUIDE_STEP_IDS.filter((id) => core.state.done.includes(id)).length;
    },
    get finished() {
      return GUIDE_STEP_IDS.every((id) => core.state.done.includes(id));
    },
    seenSteps: () => core.seenSteps,
    get hints() {
      return hints;
    },
    // A next-step hint Rosie has just given (the hint line): kept for Help, newest text per hint.
    noteHint(id, text) {
      if (!id || !text) return false;
      const old = hints.find((h) => h.id === id);
      if (old) {
        if (old.text === text) return false;
        old.text = text;
        return true;
      }
      hints.push({ id, text });
      if (hints.length > HINTS_KEPT) hints.shift();
      return true;
    },
    load(saved) {
      const s = guideStart({ saved });
      core.load(s);
      welcome = s.welcome ?? 'done';
      why = s.why ?? null;
      ended = !!s.ended;
      hints = Array.isArray(s.hints) ? s.hints.filter((h) => h?.id && h?.text).map((h) => ({ id: h.id, text: h.text })) : [];
      core.update();
    },
    save() {
      return { ...core.serialize(), welcome, why, ended, hints: hints.map((h) => ({ ...h })) };
    },
    skip() {
      welcome = 'done';
      core.turnOff();
    },
    turnOn() {
      welcome = 'done';
      core.turnOn();
    },
    turnOff: () => core.turnOff(),
    // Show guide again: every step from the start (the hints seen are kept for Help).
    restart() {
      const seen = [...core.state.seen];
      core.load({ done: [], seen, events: [], off: false });
      welcome = 'done';
      why = null;
      ended = false;
      core.update();
    },
    update: () => core.update(),
  };
  return api;
}
