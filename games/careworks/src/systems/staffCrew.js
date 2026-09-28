// The staff in the home (Milestone 3): one walker per team member on core/Agent, the Morning shift from the roster,
// Energy / Morale by the game hour (data/balance.js), and helping with Arthur's routine steps. No drawing here, so the
// Node tests run it as it is.
//   createCrew({ grid, state, sys, perks, roster, spotTile, hourNow, bandNow, bus })
//     state = the run's staff state (src/systems/staffTeam.js)   sys = its core/StaffSystem   perks = core/FounderPerks
//   crew.people                       [{ kind: 'staff', id, name, art, line, model, agent, mode, … }]
//   crew.update(g, hours)             g = game-seconds this step, hours = game hours this step
//   crew.canHelp(id, step) → { ok, reason }        the role rule, in plain words (the resident card's picker)
//   crew.pickHelper(step, chosenId) → id | null    the chosen person if they can, else the first eligible free one on shift
//   crew.startHelp(id, step, place, onArrive)      walk to Arthur's side; onArrive() when there
//   crew.finishHelp(id) · crew.releaseHelp(id)     the step happened (task counted) / never mind (back to their post)
//   crew.stateOf(person) → "On shift at the Nurse Station" …
import { Agent } from '../../../../core/Agent.js';
import { POSTS, HELP_SPOTS, PERSON } from '../../data/home.js';
import { ROLES } from '../../data/roles.js';
import { STAFF_BALANCE as B } from '../../data/balance.js';
import { FOUNDER_FLAG } from '../../data/setup.js';

const clamp = (x) => Math.max(0, Math.min(100, x));
const PLACE_WORDS = { 'F01.staff': 'at the Nurse Station', 'F05.staff': 'in the Activity Lounge' };
const joinRoles = (ids) => {
  const names = ids.map((r) => ROLES[r].name);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
};
const stepWord = (step) => (step.activity ? step.name : step.name.toLowerCase());

export function createCrew({ grid, state, sys, perks, roster, spotTile, hourNow, bandNow, bus = null }) {
  const people = sys.staff.map((model, i) => {
    const p = {
      kind: 'staff',
      id: model.id,
      name: model.name,
      art: model.art,
      role: model.role,
      line: ROLES[model.role].name,
      model,
      restSpot: `rest.${i + 1}`,
      mode: 'post', // post · toHelp · helping · toRest · resting
      postIndex: 0,
      stay: 1 + i * 1.5, // game-seconds before the first move (so they don't all set off together)
      task: null, // { stepId, stepName, onArrive, arrived }
    };
    p.agent = new Agent({ id: model.id, name: model.name, speed: PERSON.speed, noPathTeleportSec: 3 });
    const at = state.pos?.[model.id];
    if (at) {
      p.agent.x = at.x;
      p.agent.y = at.y;
    } else {
      const t = spotTile(POSTS[model.role].spots[0]);
      p.agent.placeAtTile(grid, t.col, t.row);
    }
    return p;
  });
  const byId = (id) => people.find((p) => p.id === id) ?? null;
  const onShift = (p) => roster.onShift(p.id, hourNow(), bandNow().id);
  const walk = (p, ref, mode, then = null) => {
    const t = spotTile(ref);
    p.mode = mode;
    p.agent.walkTo(grid, t.col, t.row, then);
  };
  const toPost = (p) => {
    const post = POSTS[p.role];
    walk(p, post.spots[p.postIndex], 'toPost', () => {
      p.mode = 'post';
      p.stay = post.stay[p.postIndex];
    });
  };
  // Off shift they are resting from the start (a new home opens before the shift): no walk-in needed.
  for (const p of people) if (!onShift(p) && !state.pos?.[p.id]) {
    const t = spotTile(p.restSpot);
    p.agent.placeAtTile(grid, t.col, t.row);
    p.mode = 'resting';
  }

  function tickNumbers(p, hours) {
    const m = p.model;
    if (onShift(p)) m.energy = clamp(m.energy + B.energy.workPerHour * hours);
    else m.energy = clamp(m.energy + B.energy.restPerHour * hours * (p.mode === 'resting' ? B.energy.restSpotBonus : 1));
    if (m.energy < B.morale.lowEnergyBelow) m.morale = clamp(m.morale + B.morale.lowEnergyPerHour * hours);
    else {
      const gap = B.morale.settleTo - m.morale;
      const step = Math.min(Math.abs(gap), B.morale.settlePerHour * hours);
      m.morale = clamp(m.morale + Math.sign(gap) * step);
    }
    m.activity = onShift(p) ? 'working' : 'resting';
    sys.refreshStatus(m);
  }

  const crew = {
    people,
    byId,
    update(g, hours) {
      for (const p of people) {
        tickNumbers(p, hours);
        const shift = onShift(p);
        if (!shift && p.mode !== 'toRest' && p.mode !== 'resting') {
          if (p.task) crew.releaseHelp(p.id);
          walk(p, p.restSpot, 'toRest', () => (p.mode = 'resting'));
          bus?.emit('staff:offShift', { id: p.id });
        } else if (shift && (p.mode === 'toRest' || p.mode === 'resting')) {
          p.postIndex = 0;
          toPost(p);
          bus?.emit('staff:onShift', { id: p.id });
        }
        if (p.agent.state === 'walking') p.agent.update(g, grid);
        else if (p.mode === 'post' && (p.stay -= g) <= 0) {
          p.postIndex = (p.postIndex + 1) % POSTS[p.role].spots.length;
          toPost(p);
        }
      }
    },
    canHelp(id, step) {
      const p = byId(id);
      if (!p) return { ok: false, reason: 'They are not on the team.' };
      if (!step.roles?.includes(p.role)) {
        return { ok: false, reason: `${p.name.split(' ')[0]} can't help with ${stepWord(step)}: it needs a ${joinRoles(step.roles ?? [])}.` };
      }
      return { ok: true, reason: null };
    },
    // Free = on shift, not already helping. Auto skips anyone nearly out of Energy.
    pickHelper(step, chosenId = null) {
      const free = (p) => onShift(p) && !p.task && step.roles?.includes(p.role);
      const chosen = chosenId && byId(chosenId);
      if (chosen && free(chosen)) return chosen.id;
      return people.find((p) => free(p) && p.model.energy >= B.tooTiredBelow)?.id ?? null;
    },
    startHelp(id, step, place, onArrive) {
      const p = byId(id);
      if (!p) return;
      p.task = { stepId: step.id, stepName: stepWord(step), onArrive, arrived: false };
      walk(p, HELP_SPOTS[place], 'toHelp', () => {
        p.mode = 'helping';
        p.task.arrived = true;
        p.task.onArrive?.();
      });
    },
    // After a reload: back to what they were doing for the step.
    resumeHelp(id, step, place, arrived, onArrive) {
      const p = byId(id);
      if (!p) return;
      if (arrived) {
        p.task = { stepId: step.id, stepName: stepWord(step), onArrive, arrived: true };
        p.mode = 'helping';
      } else crew.startHelp(id, step, place, onArrive);
    },
    finishHelp(id) {
      const p = byId(id);
      if (!p) return;
      const m = p.model;
      m.energy = clamp(m.energy + B.energy.perTask);
      m.morale = clamp(m.morale + B.morale.perTask);
      m.counters.tasks = (m.counters.tasks ?? 0) + 1;
      if (m.counters[FOUNDER_FLAG]) state.founder.history.careTasks++;
      sys.refreshStatus(m);
      p.task = null;
      bus?.emit('staff:task', { id, tasks: m.counters.tasks });
      toPost(p);
    },
    releaseHelp(id) {
      const p = byId(id);
      if (!p || !p.task) return;
      p.task = null;
      if (onShift(p)) toPost(p);
    },
    stateOf(p) {
      if (p.mode === 'toHelp') return `Going to ${p.task?.stepName === 'Cards' ? 'run Cards with' : 'help'} Arthur (${p.task?.stepName})`;
      if (p.mode === 'helping') return `Helping Arthur: ${p.task?.stepName}`;
      if (p.mode === 'toRest') return 'Off shift: going to rest in the lounge';
      if (p.mode === 'resting') return 'Off shift: resting in the lounge';
      if (p.mode === 'toPost') return 'On shift: walking the home';
      return `On shift ${PLACE_WORDS[POSTS[p.role].spots[p.postIndex]] ?? 'in the hall'}`;
    },
    positions() {
      return Object.fromEntries(people.map((p) => [p.id, { x: p.agent.x, y: p.agent.y }]));
    },
  };
  return crew;
}
