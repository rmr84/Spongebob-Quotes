// Gauntlet mode: an endless run of quotes that get harder as you go, with
// fewer guesses at each stage. One missed quote ends the run; the score is
// how many quotes you cleared. Shared by the browser and the API, which
// replays a finished run from its seed to check the score.
import { CHARACTER_BY_ID } from '../data/characters';
import { DIFFICULTY, type Difficulty } from '../data/difficulty';
import { mulberry32, quoteKey } from './daily';
import type { Quote, QuoteDb } from './quotes';

export interface Stage {
  name: 'Easy' | 'Medium' | 'Hard' | 'Expert';
  /** Quote difficulty this stage draws from. */
  tier: Difficulty;
  /** First level (1-based) of the stage. */
  first: number;
  /** Number of levels in the stage (the last stage never ends). */
  length: number;
  /** Guesses allowed per quote. */
  guesses: number;
}

export const STAGES: Stage[] = [
  { name: 'Easy', tier: 1, first: 1, length: 5, guesses: 3 },
  { name: 'Medium', tier: 2, first: 6, length: 7, guesses: 3 },
  { name: 'Hard', tier: 3, first: 13, length: 8, guesses: 2 },
  { name: 'Expert', tier: 4, first: 21, length: Infinity, guesses: 1 },
];

export function stageFor(level: number): Stage {
  return [...STAGES].reverse().find((s) => level >= s.first)!;
}

export const difficultyOf = (q: Quote): Difficulty => DIFFICULTY[q.text] ?? 3;

/** A run in progress or finished: the seed fixes the quote order; rounds[i] = character ids guessed for quote i. */
export interface Run {
  seed: number;
  rounds: string[][];
}

export const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];

const orderCache = new Map<string, Quote[]>();

/**
 * Every quote in the order a run deals them: a few from each stage's tier,
 * then whatever is left, hardest first. Shuffled by the seed, so the same
 * seed always gives the same run.
 */
export function gauntletOrder(db: QuoteDb, seed: number): Quote[] {
  const cacheKey = `${seed}:${db.quotes.length}`;
  const cached = orderCache.get(cacheKey);
  if (cached) return cached;

  const rand = mulberry32(seed ^ 0x9a0e7);
  const pools = new Map<Difficulty, Quote[]>();
  for (const tier of [1, 2, 3, 4] as Difficulty[]) {
    const pool = db.quotes.filter((q) => difficultyOf(q) === tier).sort((a, b) => quoteKey(a) - quoteKey(b));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pools.set(tier, pool);
  }
  // If a tier runs short, borrow from the next harder one, then easier ones.
  const take = (tier: Difficulty): Quote | undefined => {
    const tiers = [tier, ...([1, 2, 3, 4] as Difficulty[]).filter((t) => t > tier), ...([4, 3, 2, 1] as Difficulty[]).filter((t) => t < tier)];
    for (const t of tiers) {
      const q = pools.get(t)!.shift();
      if (q) return q;
    }
  };

  const order: Quote[] = [];
  for (const stage of STAGES.slice(0, -1)) {
    for (let i = 0; i < stage.length; i++) {
      const q = take(stage.tier);
      if (q) order.push(q);
    }
  }
  for (const tier of [4, 3, 2, 1] as Difficulty[]) order.push(...pools.get(tier)!);

  orderCache.set(cacheKey, order);
  return order;
}

export type RunStatus = 'playing' | 'advancing' | 'over' | 'complete';

export interface RunView {
  status: RunStatus;
  /** Current quote number, 1-based. */
  level: number;
  stage: Stage;
  quote: Quote;
  /** Guesses made on the current quote. */
  picks: string[];
  /** Quotes answered correctly. */
  cleared: number;
}

/** Where a run stands. Assumes the run is well formed (see checkRun). */
export function viewRun(order: Quote[], run: Run): RunView {
  const i = Math.max(0, run.rounds.length - 1);
  const picks = run.rounds[i] ?? [];
  const quote = order[i];
  const stage = stageFor(i + 1);
  const won = picks.includes(quote.characterId);
  const cleared = i + (won ? 1 : 0);
  const status: RunStatus = won
    ? i + 1 >= order.length
      ? 'complete'
      : 'advancing'
    : picks.length >= stage.guesses
      ? 'over'
      : 'playing';
  return { status, level: i + 1, stage, quote, picks, cleared };
}

/** The run after one guess on the current quote. */
export function guessRun(order: Quote[], run: Run, characterId: string): Run {
  const view = viewRun(order, run);
  if (view.status !== 'playing' || view.picks.includes(characterId)) return run;
  const rounds = run.rounds.length ? run.rounds.slice(0, -1) : [];
  return { ...run, rounds: [...rounds, [...view.picks, characterId]] };
}

/** Moves on to the next quote after a correct answer. */
export function advanceRun(order: Quote[], run: Run): Run {
  return viewRun(order, run).status === 'advancing' ? { ...run, rounds: [...run.rounds, []] } : run;
}

/**
 * Checks that a finished run follows the rules — every quote but the last
 * answered within its stage's guesses, the last one missed (or every quote
 * cleared) — and returns the score. Returns null for anything else.
 */
export function checkRun(order: Quote[], rounds: unknown): number | null {
  if (!Array.isArray(rounds) || rounds.length < 1 || rounds.length > order.length) return null;
  for (let i = 0; i < rounds.length; i++) {
    const picks = rounds[i];
    const { guesses } = stageFor(i + 1);
    if (!Array.isArray(picks) || picks.length < 1 || picks.length > guesses) return null;
    if (new Set(picks).size !== picks.length) return null;
    if (!picks.every((id) => typeof id === 'string' && CHARACTER_BY_ID.has(id))) return null;
    const answer = order[i].characterId;
    const hit = picks.indexOf(answer);
    const last = i === rounds.length - 1;
    if (hit >= 0 && hit !== picks.length - 1) return null; // no guesses after the right one
    if (!last && hit < 0) return null; // only the final quote can be missed
    if (last && hit < 0 && picks.length < guesses) return null; // ...and only once out of guesses
    if (last && hit >= 0 && rounds.length < order.length) return null; // unfinished run
  }
  const lastWon = (rounds[rounds.length - 1] as string[]).includes(order[rounds.length - 1].characterId);
  return rounds.length - (lastWon ? 0 : 1);
}

/** e.g. "Bikini Bottom Daily · Gauntlet\nCleared 14 quotes (reached Hard)\n🟩🟩🟩…🟥" */
export function gauntletShareText(title: string, cleared: number, reached: Stage, complete: boolean): string {
  const squares = '🟩'.repeat(Math.min(cleared, 30)) + (cleared > 30 ? '…' : '') + (complete ? '🏆' : '🟥');
  return `${title} · Gauntlet\nCleared ${cleared} ${cleared === 1 ? 'quote' : 'quotes'} (reached ${reached.name})\n\n${squares}\n\n${location.origin}${location.pathname}`;
}
