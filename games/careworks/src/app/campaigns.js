// The four campaign slots (Milestone 0, bible §3.5.1 / §3.5.9) on core/CampaignSlots: the slot cards, Continue (the
// last-used slot), starting a facility into a slot (START FACILITY) and deleting one. Screens ask "are you sure"
// first; this module only does the writing. Milestone 2: save(n, data) is the game's autosave of the open slot (its
// run save and its summary record); older saves are moved up to date on load (SAVE_MIGRATIONS).
// Milestone 35 (save hardening): each slot is its own chain of three rolling, checksummed copies (core SaveSlot); a
// copy that fails the save check (campaignProblems) is skipped like a damaged one; a newer game's save is never written
// over. open(n) says when an older copy had to be used (restored) and marks a slot whose every copy failed as damaged
// (the other slots are never touched). A damaged slot's copies are kept aside before it is deleted or written over.
// The account store has the same rolling copies; one that will not read at all is kept aside and started again
// (accountProblem). A summary record from before Milestone 35 (no stage / finished) is rebuilt once from its save.
import { CampaignSlots } from '../../../../core/CampaignSlots.js';
import { newCampaign, slotSummary, campaignProblems, SAVE_MIGRATIONS } from '../systems/facility.js';

export function createCampaigns({ adapter, save, bus = null }) {
  const slots = new CampaignSlots({ adapter, count: save.count, prefix: save.prefix, accountKey: save.accountKey, version: save.version, migrations: SAVE_MIGRATIONS, describe: slotSummary, bus, validate: campaignProblems, refuseNewer: true, accountValidate: (d) => (d && typeof d === 'object' && !Array.isArray(d) ? [] : ['not an object']), quarantineAccount: true });
  let cards = slots.numbers().map((n) => ({ n, empty: true, summary: null, error: null }));
  let last = null;
  const damaged = new Map(); // n → why (this session: a slot whose every copy failed)

  // Before anything goes over a slot that will not read: keep its copies aside (never lost by accident).
  async function keepAside(n) {
    if (!damaged.has(n) && !cards[n - 1]?.error) return null;
    try {
      return await slots.quarantine(n);
    } catch {
      return null;
    }
  }

  return {
    slots,
    get cards() {
      return cards;
    },
    // Continue: the last-used slot when it still holds a facility, else none.
    get last() {
      return last != null && cards[last - 1]?.summary ? last : null;
    },
    card: (n) => cards[n - 1] ?? null,
    async refresh() {
      cards = await slots.summaries();
      // (Milestone 35) a summary record from an older build: rebuilt once from its save (stage, finished)
      for (const c of cards) {
        if (!c.summary || c.summary.v >= 35 || damaged.has(c.n)) continue;
        try {
          const data = await slots.load(c.n);
          if (data) {
            const summary = slotSummary(data);
            await slots.writeSummary(c.n, summary);
            cards[c.n - 1] = { ...c, summary };
          }
        } catch {
          /* it is read (and marked) properly when opened */
        }
      }
      for (const [n, why] of damaged) cards[n - 1] = { n, empty: false, summary: null, savedAt: null, error: why, damaged: true };
      last = await slots.lastUsed();
      return cards;
    },
    firstEmpty() {
      return cards.find((c) => c.empty)?.n ?? null;
    },
    // START FACILITY: the summary record and a new campaign save into slot n (replacing what was there).
    async start(n, setup) {
      const data = newCampaign(setup);
      await keepAside(n);
      await slots.remove(n); // (Milestone 35: the old home's older copies go too, so a later fallback can never bring it back)
      damaged.delete(n);
      await slots.create(n, { data, summary: slotSummary(data) });
      await this.refresh();
      return data;
    },
    // (Milestone 33) a New Game+ home built elsewhere (src/systems/ngplusRun.js) into slot n
    async startData(n, data) {
      await keepAside(n);
      await slots.remove(n); // (Milestone 35: the old home's older copies go too, so a later fallback can never bring it back)
      damaged.delete(n);
      await slots.create(n, { data, summary: slotSummary(data) });
      await this.refresh();
      return data;
    },
    // → the slot's data or null. this.lastOpen: { restored (an older copy was used), savedAt, newer, error }
    async open(n) {
      let data = null;
      try {
        data = await slots.load(n);
      } catch (err) {
        this.lastOpen = { n, restored: false, newer: !!err.newer, error: err.message ?? String(err) };
        if (!err.newer) damaged.set(n, "this save can't be read");
        await this.refresh();
        return null;
      }
      const ll = slots.slot(n).lastLoad;
      this.lastOpen = { n, restored: !!ll?.fallback, savedAt: ll?.record?.savedAt ?? null, newer: false, error: null };
      if (data) await slots.setLastUsed(n);
      last = data ? n : last;
      return data;
    },
    lastOpen: null,
    // Read a slot's save without opening it (New Game+ from the slot screen). null when it will not read.
    async peek(n) {
      try {
        return await slots.load(n);
      } catch {
        return null;
      }
    },
    // The open campaign's autosave: its run save, then its summary record (so the slot card shows the new date).
    async save(n, data) {
      await slots.save(n, data);
      await slots.writeSummary(n, slotSummary(data));
      const c = cards[n - 1];
      if (c) cards[n - 1] = { ...c, empty: false, summary: slotSummary(data), savedAt: Date.now() };
    },
    async remove(n) {
      await keepAside(n);
      await slots.remove(n);
      damaged.delete(n);
      await this.refresh();
    },
  };
}
