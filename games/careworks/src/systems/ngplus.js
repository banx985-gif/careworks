// New Game+ (Milestone 33, bible §3.5.8, §37) — the pure rules the home world reads (no save building here: that is
// src/systems/ngplusRun.js, which the home world must not import). Shared rules on core/NgPlusSystem.
//
//   ngRules                          core/NgPlusSystem with data/ngplus.js
//   legacyChain(legacy, ngPlus)      how many NG+ levels in a row (1, 2 …, up to this home's) a Legacy Staff member was
//                                    carried through: SEC-NGP-02 reads 2, SEC-NGP-03 reads 3
//   mentorCheck({ team, day, runId }) Elite mentoring, each midnight: a Standard or Rare worker trained to their tier's cap on
//                                    their role's main stat, while a Legacy Staff member of the same role is on the team, is
//                                    written into that mentor's history (once per worker per home) → [{ mentor, id }]
//   ngDiscountCost(disc, defId, cost) the NG+2 discount on one facility's first build (in 50-Credit steps)
//   researchRpOf(done, level)        the starting Research Points: §37's share of the visible research done
import { NgPlusSystem } from '../../../../core/NgPlusSystem.js';
import { NG_PLUS } from '../../data/ngplus.js';
import { ROLES, TIERS } from '../../data/roles.js';
import { researchById } from '../../data/research.js';

export const ngRules = new NgPlusSystem({ rules: NG_PLUS });
const MENTEE_TIERS = ['standard', 'rare'];

export function legacyChain(legacy, ngPlus = 0) {
  const levels = legacy?.levels ?? [];
  let n = 0;
  while (n < ngPlus && levels.includes(n + 1)) n++;
  return n;
}

export function mentorCheck({ team = [], day = 0, runId = null }) {
  const mentors = team.filter((m) => m?.counters?.legacy && !m.counters.agency);
  if (!mentors.length) return [];
  const out = [];
  for (const m of team) {
    if (!m || m.counters?.legacy || m.counters?.agency || !MENTEE_TIERS.includes(m.tier)) continue;
    const stat = ROLES[m.role]?.primaryStat;
    if (!stat || (m.stats?.[stat] ?? 0) < (TIERS[m.tier]?.statCap ?? Infinity)) continue;
    const already = mentors.some((l) => (l.counters.legacy.mentored ?? []).some((x) => x.id === m.id && x.run === runId));
    if (already) continue;
    const mentor = mentors.filter((l) => l.role === m.role).sort((a, b) => b.level - a.level || a.id.localeCompare(b.id))[0];
    if (!mentor) continue;
    (mentor.counters.legacy.mentored ??= []).push({ id: m.id, name: m.name, run: runId, day });
    out.push({ mentor: mentor.id, id: m.id });
  }
  return out;
}

export function ngDiscountCost(disc, defId, cost) {
  if (!disc || disc.id !== defId || disc.used != null || !cost) return cost;
  return Math.round((cost * (100 - disc.pct)) / 100 / 50) * 50;
}

export const researchPctOf = (level) => NG_PLUS.researchPct[Math.min(level, NG_PLUS.researchPct.length - 1)] ?? 0;
export function researchRpOf(done = [], level = 1) {
  const spent = done.reduce((t, id) => t + (researchById(id)?.cost ?? 0), 0);
  return Math.round((spent * researchPctOf(level)) / 100);
}
export const discountOpen = (level) => level >= NG_PLUS.discount.fromLevel;
export const livingOpen = (level) => level >= NG_PLUS.livingFromLevel;
