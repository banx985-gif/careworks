// The four campaign slots (Milestone 0, bible §3.5.1 / §3.5.9) on core/CampaignSlots: the slot cards, Continue (the
// last-used slot), starting a facility into a slot (START FACILITY) and deleting one. Screens ask "are you sure"
// first; this module only does the writing. The game's autosave (later milestones) writes only the open slot.
import { CampaignSlots } from '../../../../core/CampaignSlots.js';
import { newCampaign, slotSummary } from '../systems/facility.js';

export function createCampaigns({ adapter, save, bus = null }) {
  const slots = new CampaignSlots({ adapter, count: save.count, prefix: save.prefix, accountKey: save.accountKey, version: save.version, describe: slotSummary, bus });
  let cards = slots.numbers().map((n) => ({ n, empty: true, summary: null, error: null }));
  let last = null;

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
      last = await slots.lastUsed();
      return cards;
    },
    firstEmpty() {
      return cards.find((c) => c.empty)?.n ?? null;
    },
    // START FACILITY: the summary record and a new campaign save into slot n (replacing what was there).
    async start(n, setup) {
      const data = newCampaign(setup);
      await slots.create(n, { data, summary: slotSummary(data) });
      await this.refresh();
      return data;
    },
    async open(n) {
      const data = await slots.load(n);
      if (data) await slots.setLastUsed(n);
      last = data ? n : last;
      return data;
    },
    async remove(n) {
      await slots.remove(n);
      await this.refresh();
    },
  };
}
