// CAREWORKS monetisation (Milestone 36, bible §38, series money rule 9): what the pretend store sells, which rewarded
// ads exist, what Care Tokens may buy, and the words. There is no real store or ad network yet (Milestone 41): with no
// provider the store simply says it is unavailable, and ?debug=1 uses core/FakeStoreProvider.
// The rules (tests/careworks/m36.test.mjs checks each one):
//   - Nothing sold gives power or touches care. Care Tokens buy convenience (a new recruit or grant board) and cosmetics
//     (accent palettes) only. No subscription, no daily drip, no monthly anything, no gacha, no paid timers.
//   - The Supporter Pack is one-time: ad-free, the Supporter accent palette, and a one-time Care Token gift.
//   - Rewarded ads never touch urgent care, medicines, falls, end of life, refusals, emergency staffing or secrets
//     (NEVER_REWARDED: none of these may ever be a placement).
//   - No full-screen ad before the home's first accreditation (the first big moment), during the guide or a decision.
export const PRODUCTS = {
  removeAds: { kind: 'nonConsumable', entitlement: 'removeAds', name: 'Remove Ads', text: 'No full-screen ads, for good (optional ads stay)', price: '£2.99', title: 'Remove Ads' },
  supporterPack: { kind: 'nonConsumable', name: 'Supporter Pack', text: 'No full-screen ads, the Supporter accent, 40 Care Tokens once', price: '£5.99', title: 'Supporter Pack', grant: { tokens: 40, palette: 'supporter' } },
  tokensSmall: { kind: 'consumable', name: '30 Care Tokens', text: 'For new recruit or grant boards and accent palettes.', price: '£0.99', title: '30 Care Tokens', grant: { tokens: 30 } },
  tokensMedium: { kind: 'consumable', name: '100 Care Tokens', text: 'For new recruit or grant boards and accent palettes.', price: '£2.49', title: '100 Care Tokens', grant: { tokens: 100 } },
  tokensLarge: { kind: 'consumable', name: '250 Care Tokens', text: 'For new recruit or grant boards and accent palettes.', price: '£4.99', title: '250 Care Tokens', grant: { tokens: 250 } },
};
export const PRODUCT_ORDER = ['removeAds', 'supporterPack', 'tokensSmall', 'tokensMedium', 'tokensLarge'];

// What Care Tokens buy (convenience and cosmetics only). Each also exists another way: the recruit board with Credits or
// the free one every 56 days, the grant board every month; palettes are looks only.
export const TOKEN_SINKS = {
  recruitBoard: { cost: 8, name: 'A new board of Local Applicants' },
  grantBoard: { cost: 6, name: 'A new grant board' },
  palette: { cost: 15, name: 'An accent palette' },
};

// Rewarded ads (bible §38 "may optionally provide"). limit.per 'realHours' = per real day; anything else = per scope
// key (a course, a game month, a palette).
export const REWARDED = [
  { id: 'recruitRefresh', name: 'New candidates', blurb: 'A new board of Local Applicants', limit: { per: 'realHours', hours: 24, count: 2 } },
  { id: 'trainingShortcut', name: 'Training a day sooner', blurb: 'One day off a course already under way (once per course)', limit: { per: 'course', count: 1 }, effect: { days: 1 } },
  { id: 'tokenGift', name: 'Care Tokens', blurb: '+3 Care Tokens', limit: { per: 'realHours', hours: 24, count: 1 }, effect: { tokens: 3 } },
  { id: 'offerRefresh', name: 'New grant offers', blurb: 'A new grant board (once a month)', limit: { per: 'month', count: 1 } },
  { id: 'cosmeticReward', name: 'Sunrise accent', blurb: 'The Sunrise accent palette, yours for every home', limit: { per: 'palette', count: 1 }, effect: { palette: 'sunrise' } },
];
export const REWARDED_BY_ID = Object.fromEntries(REWARDED.map((p) => [p.id, p]));
// Bible §38 "never allowed": none of these can ever be a rewarded placement or a token sink.
export const NEVER_REWARDED = ['urgentCare', 'medication', 'fall', 'death', 'refusal', 'emergencyStaffing', 'secret'];

// Full-screen ads: only at a month's close or on leaving the home, never before the home's first accreditation.
export const INTERSTITIAL_CAPS = { firstInstallQuietMin: 10, minGapMin: 15, maxPerHour: 2, afterResumeQuietSec: 60, afterPurchaseQuietMin: 15, breakPoints: ['monthClose', 'leaveHome'] };

// The extra accent palettes (cosmetic, data/setup.js paletteById finds them too).
export const STORE_PALETTES = [
  { id: 'supporter', name: 'Supporter Gold', hex: '#C9962E', light: '#FAEFD2', dark: '#74540F', how: 'supporter' },
  { id: 'sunrise', name: 'Sunrise', hex: '#E77F5B', light: '#FCE4DA', dark: '#94401F', how: 'ad' },
  { id: 'lavender', name: 'Lavender', hex: '#8E7CC3', light: '#ECE8F7', dark: '#4E3F82', how: 'tokens' },
  { id: 'rose', name: 'Rose', hex: '#D46A8C', light: '#F9E1E9', dark: '#8A2E4C', how: 'tokens' },
  { id: 'harbour', name: 'Harbour Blue', hex: '#3E6FB0', light: '#DFE8F5', dark: '#1F4170', how: 'tokens' },
];

export const STORE_TEXT = {
  title: 'Store',
  subtitle: 'CAREWORKS has ads and optional purchases',
  upFront: 'CAREWORKS is free to play, with ads and optional purchases. Nothing here changes the care your residents get: the whole game can be finished without spending anything.',
  noStore: 'The store is not available yet. Everything in the game can be earned by playing.',
  tokensLine: (n) => `Care Tokens: ${n} · they buy new boards and accent palettes, never care`,
  heldLine: (n) => `${n} Care Tokens bought earlier will arrive in the next home you open.`,
  adsTitle: 'Watch an ad (optional)',
  tokensTitle: 'Spend Care Tokens',
  buyTitle: 'Purchases (one-time, no subscriptions)',
  restore: 'Restore purchases',
  restoreLine: 'Remove Ads and the Supporter Pack come back on a new phone',
  owned: 'Yours',
  adFree: 'No full-screen ads (thank you!)',
  debugTitle: 'Pretend store (debug)',
};
export const STORE_MESSAGES = {
  unavailable: 'The store is not available right now. Nothing was charged.',
  offline: 'Could not reach the store. Check your connection and try again. Nothing was charged.',
  cancelled: 'Purchase cancelled. Nothing was charged.',
  failed: 'The purchase did not go through. Nothing was charged.',
  purchased: 'Thank you! Your purchase is ready.',
  duplicate: 'That purchase was already added.',
  restored: 'Purchases restored.',
  nothingToRestore: 'No purchases to restore on this account.',
};
export const AD_TEXT = {
  tag: 'Ad',
  busy: 'An ad is already playing',
  unavailable: 'No ad to show right now',
  cancelled: 'The ad was closed early: nothing changed',
  failed: 'The ad did not play: nothing changed',
  offline: 'No connection: nothing changed',
  firstAward: 'No full-screen ads before your first accreditation',
};
