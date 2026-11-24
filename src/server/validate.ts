import 'server-only';
import { CHARACTER_BY_ID } from '@/data/characters';
import { dailyQuote, dayNumber } from '@/lib/daily';
import { MAX_GUESSES, applyGuess, newGame } from '@/lib/game';
import { scoreOf, validateName, type Profile } from '@/lib/profile';
import { QUOTE_DB } from '@/lib/quotes';
import { HttpError } from './auth';

/**
 * Puzzle numbers follow each player's local date, which can be a day either
 * side of the server's UTC date. Accept that window and nothing else.
 */
export function assertRecentDay(day: unknown): asserts day is number {
  const today = dayNumber(new Date(), true);
  if (!Number.isInteger(day) || (day as number) < today - 1 || (day as number) > today + 1) {
    throw new HttpError(400, 'That puzzle isn’t open right now.');
  }
}

/**
 * Replays the player's guesses against that day's real answer, so the result
 * (won/lost, number of guesses) is worked out here rather than taken on trust.
 */
export function replayDaily(day: number, picks: unknown): { won: boolean; guesses: number; picks: string[] } {
  if (!Array.isArray(picks) || picks.length < 1 || picks.length > MAX_GUESSES) {
    throw new HttpError(400, 'Invalid guesses.');
  }
  let state = newGame(dailyQuote(QUOTE_DB, day));
  for (const id of picks) {
    if (typeof id !== 'string' || !CHARACTER_BY_ID.has(id) || state.status !== 'playing' || state.guesses.includes(id)) {
      throw new HttpError(400, 'Invalid guesses.');
    }
    state = applyGuess(state, id);
  }
  if (state.status === 'playing') throw new HttpError(400, 'That puzzle isn’t finished yet.');
  return { won: state.status === 'won', guesses: state.guesses.length, picks: state.guesses };
}

const nat = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

/**
 * Checks stats a player brings over from their browser when creating an
 * account. They must add up, and can't cover more puzzles than exist so far.
 * The score is always recomputed here.
 */
export function importedProfile(name: unknown, imported: unknown): Profile {
  const nameError = validateName(name);
  if (nameError) throw new HttpError(400, nameError);
  const base: Profile = {
    name: (name as string).trim(),
    score: 0,
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    distribution: Array(MAX_GUESSES).fill(0),
    lastDay: 0,
    lastWonDay: 0,
    gauntletBest: 0,
    gauntletPlayed: 0,
  };
  if (imported == null) return base;

  const s = imported as Record<string, unknown>;
  const d = s.distribution;
  const today = dayNumber(new Date(), true);
  const lastDay = s.lastDay ?? 0;
  const lastWonDay = s.lastWonDay ?? 0;
  const ok =
    Array.isArray(d) &&
    d.length === MAX_GUESSES &&
    d.every(nat) &&
    nat(s.played) &&
    nat(s.wins) &&
    nat(s.currentStreak) &&
    nat(s.maxStreak) &&
    nat(lastDay) &&
    nat(lastWonDay) &&
    s.wins === d.reduce((a: number, b: number) => a + b, 0) &&
    s.played >= s.wins &&
    s.played <= today &&
    s.currentStreak <= s.maxStreak &&
    s.maxStreak <= s.wins &&
    lastWonDay <= lastDay &&
    lastDay <= today + 1;
  if (!ok) throw new HttpError(400, 'Those stats don’t add up, so they can’t be imported.');

  return {
    ...base,
    played: s.played as number,
    wins: s.wins as number,
    distribution: d as number[],
    score: scoreOf(d as number[]),
    currentStreak: s.currentStreak as number,
    maxStreak: s.maxStreak as number,
    lastDay: lastDay as number,
    lastWonDay: lastWonDay as number,
  };
}
