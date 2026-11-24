import type { Quote, QuoteDb } from './quotes';

/** Day #1 of the game. */
const EPOCH = Date.UTC(2026, 0, 1);
const DAY_MS = 86_400_000;

/** Puzzle number for the player's local calendar date (or the UTC date, on the server). */
export function dayNumber(date = new Date(), utc = false): number {
  const local = utc
    ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / DAY_MS) + 1;
}

export function msUntilTomorrow(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable key for a quote, so the daily order survives reordering of quotes.json. */
export function quoteKey(q: Quote) {
  let h = 2166136261;
  for (const ch of q.text + q.characterId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Hand-picked puzzles: puzzle number → exact quote text. A pinned quote swaps
 * places with whatever that day would have had, so every quote still comes up
 * exactly once per cycle.
 */
export const PINNED: Record<number, string> = {
  328: "It's not just a boulder! It's a rock!", // 2026-11-24
};

/**
 * Today's quote. Quotes are dealt from a seeded shuffle so nothing repeats
 * until every quote has been used; then a new shuffle starts.
 */
export function dailyQuote(db: QuoteDb, day: number): Quote {
  const n = db.quotes.length;
  const cycle = Math.floor((day - 1) / n);
  const order = [...db.quotes].sort((a, b) => quoteKey(a) - quoteKey(b));
  const rand = mulberry32(0x5b0b + cycle * 7919);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const slot = (d: number) => (((d - 1) % n) + n) % n;
  for (const [pinnedDay, text] of Object.entries(PINNED)) {
    const d = Number(pinnedDay);
    if (Math.floor((d - 1) / n) !== cycle) continue;
    const from = order.findIndex((q) => q.text === text);
    if (from >= 0) [order[from], order[slot(d)]] = [order[slot(d)], order[from]];
  }
  return order[slot(day)];
}
