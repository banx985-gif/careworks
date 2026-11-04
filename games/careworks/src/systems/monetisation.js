// CAREWORKS monetisation (Milestone 36, bible §38, series money rule 9): core/AdService, core/CommerceService and
// core/EntitlementService set up with data/monetisation.js, like RACEWORKS / BOTWORKS. One for the whole app (main.js);
// the open home is read through home() each time. No real store or ad network: with no provider the store says it is
// unavailable; ?debug=1 passes core/FakeStoreProvider (success / cancel / fail / offline on the next ad or purchase).
//   createMonetisation({ bus, now, home }) → m      home() → { world, data } of the open home, or null
//   m.setAccount({ load, save }) · await m.loadAccount() · m.setProvider(p) · await m.startup()
//   m.removeAds / m.supporter / m.adFree · m.ownsPalette(id) · m.palettes() · m.usePalette(id) · m.buyPalette(id)
//   m.placement(id, ctx) → { show, ok, label, sub } · await m.watch(id, ctx) → { ok, message }
//     ids: recruitRefresh · trainingShortcut { staffId } · tokenGift · offerRefresh · cosmeticReward
//   m.tokenBlock(sink) · m.spend(sink, ctx) → { ok, reason }   (sinks: recruitBoard · grantBoard · palette { id })
//   m.interstitialBlock(bp, ctx) · await m.breakPoint(bp, ctx)  (bp: monthClose · leaveHome)
//   m.payHeld() (tokens bought with no home open, paid into the next one) · m.serializeRun() / m.loadRun(s)
// Idempotency: a purchase is keyed by its store transaction id, a rewarded ad by a request id made when it starts. Both
// are kept on the account (processed) and in the open home (granted), so neither a reload, a store re-delivery nor a
// double tap grants twice. A cancelled, failed or offline ad or purchase changes nothing.
// Nothing here is read by any care rule: the care systems never import this file (tests/careworks/m36.test.mjs).
import { EntitlementService } from '../../../../core/EntitlementService.js';
import { AdService } from '../../../../core/AdService.js';
import { CommerceService } from '../../../../core/CommerceService.js';
import { PRODUCTS, REWARDED, REWARDED_BY_ID, TOKEN_SINKS, INTERSTITIAL_CAPS, STORE_PALETTES, STORE_MESSAGES, AD_TEXT } from '../../data/monetisation.js';

const HOUR = 3600 * 1000;
const KEEP_GRANTED = 300;

class RunAwareEntitlements extends EntitlementService {
  constructor(opts, runGranted) {
    super(opts);
    this.runGranted = runGranted;
  }
  hasProcessed(id) {
    return super.hasProcessed(id) || this.runGranted().includes(String(id));
  }
  markProcessed(id) {
    const fresh = super.markProcessed(id);
    const g = this.runGranted();
    if (!g.includes(String(id))) {
      g.push(String(id));
      if (g.length > KEEP_GRANTED) g.splice(0, g.length - KEEP_GRANTED);
    }
    return fresh;
  }
}

export const blankRun = () => ({ granted: [], palettes: [] });
const blankAccount = () => ({ removeAds: false, supporter: false, processed: [], ads: null, heldTokens: 0, palettes: [], bigMoment: false, supporterGift: false });

export function createMonetisation({ bus, now = () => Date.now(), home = () => null }) {
  let account = blankAccount();
  let store = null;
  let busy = false;
  let seq = 0;
  let orphanGranted = []; // granted ids while no home is open
  const run = () => {
    const h = home();
    if (!h?.data) return null;
    h.data.monetisation ??= blankRun();
    return h.data.monetisation;
  };
  const world = () => home()?.world ?? null;
  const entitlements = new RunAwareEntitlements({ now, bus }, () => run()?.granted ?? orphanGranted);
  const ads = new AdService({ caps: INTERSTITIAL_CAPS, placements: REWARDED, now, adFree: () => api.adFree, bus });
  const commerce = new CommerceService({ products: PRODUCTS, entitlements, grant: (p, tx) => grantProduct(p, tx), commit: () => api.commit(), messages: STORE_MESSAGES, now, bus, owned: (keys) => applyOwned(keys) });
  bus?.on('commerce:purchased', () => ads.notePurchase());
  // the first big moment: the home's first accreditation (from then on, on this device)
  bus?.on('quality:award', () => {
    if (!account.bigMoment) {
      account.bigMoment = true;
      saveAccount();
    }
  });

  // --- Care Tokens (the run's ledger, currency 'tokens') -----------------------------------------------------------
  const tokens = () => world()?.economy?.tokens ?? 0;
  function addTokens(n, reason, category) {
    const w = world();
    if (!w || !n) return 0;
    w.ledger.economy.add('tokens', Math.round(n), reason, category);
    return Math.round(n);
  }
  function tokenBlock(sink) {
    const s = TOKEN_SINKS[sink];
    if (!s) return 'Care Tokens can’t buy that';
    if (!world()) return 'Open a home first';
    if (tokens() < s.cost) return `Needs ${s.cost} Care Tokens`;
    return null;
  }
  function spend(sink, ctx = {}) {
    const why = tokenBlock(sink);
    if (why) return { ok: false, reason: why };
    const w = world();
    const s = TOKEN_SINKS[sink];
    if (sink === 'palette') {
      const p = STORE_PALETTES.find((x) => x.id === ctx.id && x.how === 'tokens');
      if (!p) return { ok: false, reason: 'That accent isn’t for Care Tokens' };
      if (api.ownsPalette(p.id)) return { ok: false, reason: 'Already yours' };
        run().palettes.push(p.id);
    } else if (sink === 'recruitBoard') w.staffing.convenienceRefresh('tokens');
    else if (sink === 'grantBoard') w.partners.grants.redrawBoard();
    w.ledger.economy.add('tokens', -s.cost, `Care Tokens: ${s.name}`, 'store');
    bus?.emit('tokens:spent', { sink, cost: s.cost });
    return { ok: true, reason: null };
  }

  // --- palettes (cosmetic) -----------------------------------------------------------------------------------------
  function ownsPalette(id) {
    const p = STORE_PALETTES.find((x) => x.id === id);
    if (!p) return true; // the six Facility Setup ones
    if (p.how === 'supporter') return account.supporter;
    if (p.how === 'ad') return account.palettes.includes(id);
    return !!run()?.palettes.includes(id);
  }
  function usePalette(id) {
    const h = home();
    if (!h) return { ok: false, reason: 'Open a home first' };
    if (!ownsPalette(id)) return { ok: false, reason: 'Not yours yet' };
    h.data.facility.palette = id;
    bus?.emit('home:palette', { id });
    return { ok: true, reason: null };
  }

  // --- purchases ---------------------------------------------------------------------------------------------------
  function grantProduct(p, tx) {
    const key = tx.productKey;
    if (key === 'supporterPack') return applyOwned(['supporterPack']);
    const n = p.grant?.tokens ?? 0;
    if (!n) return;
    if (world()) addTokens(n, `Store: ${p.name}`, 'purchase');
    else account.heldTokens += n;
  }
  // One-time items with no entitlement of their own (the Supporter Pack): bought now, or restored on a new phone. The
  // Care Token gift comes once per account, never again on a restore.
  function applyOwned(keys) {
    if (!keys.includes('supporterPack') || account.supporter) return;
    account.supporter = true;
    if (!account.supporterGift) {
      account.supporterGift = true;
      const n = PRODUCTS.supporterPack.grant.tokens;
      if (world()) addTokens(n, 'Supporter Pack: thank-you gift', 'purchase');
      else account.heldTokens += n;
    }
    bus?.emit('entitlements:change', { removeAds: entitlements.removeAds, supporter: true });
  }
  function payHeld() {
    const n = account.heldTokens;
    if (!n || !world()) return 0;
    account.heldTokens = 0;
    addTokens(n, 'Care Tokens bought earlier', 'purchase');
    saveAccount();
    return n;
  }

  // --- rewarded ads ------------------------------------------------------------------------------------------------
  const monthKey = () => {
    const c = world()?.clock;
    return c ? `${c.year}-${c.month}` : null;
  };
  function target(id, ctx = {}) {
    const w = world();
    switch (id) {
      case 'recruitRefresh':
        return w ? { show: true } : { show: false };
      case 'trainingShortcut': {
        const t = w && ctx.staffId ? w.staffing.trainingOf(ctx.staffId) : null;
        if (!t) return { show: false };
        const scope = `${ctx.staffId}:${t.courseId}:${t.startedDay}`;
        if (t.days - t.daysDone <= 1) return { show: true, scope, block: 'Finishes tomorrow already' };
        return { show: true, scope };
      }
      case 'tokenGift':
        return w ? { show: true } : { show: false };
      case 'offerRefresh':
        return w ? { show: true, scope: monthKey() } : { show: false };
      case 'cosmeticReward':
        return account.palettes.includes('sunrise') ? { show: true, scope: 'sunrise', block: 'Already yours' } : { show: true, scope: 'sunrise' };
      default:
        return { show: false }; // (never: urgent care, medicines, falls, end of life, refusals, emergency staffing, secrets)
    }
  }
  function usedText(p) {
    const at = ads.nextFreeAt(p.id);
    const h = at ? Math.max(1, Math.ceil((at - now()) / HOUR)) : p.limit.hours ?? 24;
    return p.limit.per === 'realHours' ? `Used today — again in about ${h} hour${h === 1 ? '' : 's'}` : 'Already used here';
  }
  function placement(id, ctx = {}) {
    const p = REWARDED_BY_ID[id];
    const t = p ? target(id, ctx) : { show: false };
    if (!t.show) return { show: false, ok: false, label: '', sub: '' };
    let [ok, sub] = [true, p.blurb];
    if (t.block) [ok, sub] = [false, t.block];
    else if (ads.limitBlock(id, t.scope ?? null)) [ok, sub] = [false, usedText(p)];
    else if (busy || ads.showing) [ok, sub] = [false, AD_TEXT.busy];
    else if (!ads.available) [ok, sub] = [false, AD_TEXT.unavailable];
    return { show: true, ok, label: `${AD_TEXT.tag}: ${p.name}`, sub, scope: t.scope ?? null };
  }
  function reward(id, ctx) {
    const t = target(id, ctx);
    if (!t.show || t.block) return false;
    const w = world();
    const p = REWARDED_BY_ID[id];
    switch (id) {
      case 'recruitRefresh':
        w.staffing.convenienceRefresh('ad');
        return { message: 'New candidates on the board' };
      case 'trainingShortcut': {
        const r = w.staffing.shortenTraining(ctx.staffId, p.effect.days);
        return r.ok ? { message: `A day sooner: ${r.left} day${r.left === 1 ? '' : 's'} left` } : false;
      }
      case 'tokenGift':
        addTokens(p.effect.tokens, 'Watched an ad', 'ad');
        return { message: `+${p.effect.tokens} Care Tokens` };
      case 'offerRefresh':
        w.partners.grants.redrawBoard();
        return { message: 'A new grant board' };
      case 'cosmeticReward':
        account.palettes.push(p.effect.palette);
        return { message: 'The Sunrise accent is yours (Store → accents)' };
      default:
        return false;
    }
  }
  async function watch(id, ctx = {}) {
    const pl = placement(id, ctx);
    if (!pl.show) return { ok: false, message: 'Not available here' };
    if (!pl.ok) return { ok: false, message: pl.sub };
    const p = REWARDED_BY_ID[id];
    const requestId = `ad-${now().toString(36)}-${++seq}`;
    busy = true;
    let res;
    try {
      res = await ads.rewarded(id, pl.scope, () => {
        if (entitlements.hasProcessed(requestId)) return false;
        const r = reward(id, ctx);
        if (r === false) return false;
        entitlements.markProcessed(requestId);
        return r;
      });
    } finally {
      busy = false;
    }
    if (!res.ok) {
      const m = { cancelled: AD_TEXT.cancelled, failed: AD_TEXT.failed, offline: AD_TEXT.offline, 'limit reached': usedText(p), 'no ad available': AD_TEXT.unavailable }[res.reason];
      return { ok: false, status: res.status, message: m ?? AD_TEXT.failed };
    }
    await api.commit('ad');
    return { ok: true, requestId, message: res.reward?.message ?? 'Done', reward: res.reward };
  }
  // Tests: the same completion arriving twice gives nothing the second time.
  function grantAgain(requestId, id, ctx = {}) {
    if (entitlements.hasProcessed(requestId)) return false;
    const r = reward(id, ctx);
    if (r !== false) entitlements.markProcessed(requestId);
    return r;
  }

  // --- full-screen ads ---------------------------------------------------------------------------------------------
  function interstitialBlock(bp, ctx = {}) {
    if (!INTERSTITIAL_CAPS.breakPoints.includes(bp)) return 'not a natural break point';
    if (api.adFree) return 'ad-free';
    const won = (world()?.quality?.wonIds?.() ?? []).length > 0;
    if (!account.bigMoment && !won) return AD_TEXT.firstAward;
    return ads.interstitialBlock(bp, ctx);
  }
  async function breakPoint(bp, ctx = {}) {
    const why = interstitialBlock(bp, ctx);
    if (why) return { shown: false, reason: why };
    const r = await ads.interstitial(bp, ctx);
    if (r.shown) saveAccount();
    return r;
  }

  // --- the account block -------------------------------------------------------------------------------------------
  function accountBlock() {
    return { ...account, removeAds: entitlements.removeAds, processed: entitlements.serializeProcessed(), ads: ads.serializeAccount(), palettes: [...account.palettes] };
  }
  function applyAccount(b) {
    account = { ...blankAccount(), ...(b ?? {}), heldTokens: Math.max(0, b?.heldTokens ?? 0), palettes: [...(b?.palettes ?? [])] };
    entitlements.reset();
    entitlements.load({ removeAds: !!b?.removeAds });
    entitlements.loadProcessed(b?.processed ?? []);
    ads.loadAccount(b?.ads ?? null);
  }
  function saveAccount() {
    return store?.save?.(accountBlock());
  }

  const api = {
    entitlements,
    ads,
    commerce,
    get providerId() {
      return ads.provider?.id ?? 'none';
    },
    setProvider(p) {
      ads.setProvider(p);
      commerce.setProvider(p);
    },
    get removeAds() {
      return entitlements.removeAds;
    },
    get supporter() {
      return account.supporter;
    },
    get adFree() {
      return entitlements.removeAds || account.supporter;
    },
    get heldTokens() {
      return account.heldTokens;
    },
    get bigMoment() {
      return account.bigMoment;
    },
    get busy() {
      return busy;
    },
    tokens,
    async startup() {
      const pending = await commerce.processPending();
      const check = await commerce.recheck();
      return { pending, check };
    },
    // saved: the open home first (its granted ids), then the account
    commit: async () => {
      await api.saveHome?.();
      await saveAccount();
    },
    saveHome: null, // main.js: the run save
    placement,
    watch,
    grantAgain,
    tokenBlock,
    spend,
    addTokens,
    ownsPalette,
    usePalette,
    palettes: () => STORE_PALETTES.map((p) => ({ ...p, owned: ownsPalette(p.id) })),
    payHeld,
    interstitialBlock,
    breakPoint,
    setAccount(s) {
      store = s;
    },
    async loadAccount() {
      applyAccount(store ? await store.load() : null);
    },
    saveAccount,
    // the open home's half: its granted ids, token palettes and the per-course / per-month ad counts
    loadRun(data) {
      data.monetisation = { ...blankRun(), ...(data.monetisation ?? {}) };
      ads.loadRun(data.monetisation.ads ?? null);
    },
    serializeRun: () => ({ ...(run() ?? blankRun()), ads: ads.serializeRun() }),
    serializeAccount: accountBlock,
    loadAccountBlock: applyAccount,
  };
  return api;
}
