import { MAX_GUESSES, type GameState } from './game';

const DAILY_KEY = 'bbd:daily';
const STATS_KEY = 'bbd:stats';

export interface SavedDaily {
  day: number;
  state: GameState;
}

export interface Stats {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** distribution[n] = wins in n+1 guesses */
  distribution: number[];
  lastWonDay: number | null;
  lastRecordedDay: number | null;
}

const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: Array(MAX_GUESSES).fill(0),
  lastWonDay: null,
  lastRecordedDay: null,
});

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled — game still works for this session */
  }
}

export function loadDaily(day: number): GameState | null {
  const saved = read<SavedDaily>(DAILY_KEY);
  return saved?.day === day ? saved.state : null;
}

export function saveDaily(day: number, state: GameState) {
  write(DAILY_KEY, { day, state } satisfies SavedDaily);
}

export function loadStats(today: number): Stats {
  const stats = { ...emptyStats(), ...read<Stats>(STATS_KEY) };
  // A streak survives only if the last win was today or yesterday.
  if (stats.lastWonDay === null || stats.lastWonDay < today - 1) stats.currentStreak = 0;
  return stats;
}

/** Records a finished daily game once. Returns the updated stats. */
export function recordResult(day: number, state: GameState): Stats {
  const stats = loadStats(day);
  if (state.status === 'playing' || stats.lastRecordedDay === day) return stats;

  stats.played++;
  stats.lastRecordedDay = day;
  if (state.status === 'won') {
    stats.wins++;
    stats.currentStreak = stats.lastWonDay === day - 1 ? stats.currentStreak + 1 : 1;
    stats.lastWonDay = day;
    stats.distribution[state.guesses.length - 1]++;
  } else {
    stats.currentStreak = 0;
  }
  stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  write(STATS_KEY, stats);
  return stats;
}
