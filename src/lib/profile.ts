// Account data shapes and scoring rules, shared by the browser and the API.
import { CHARACTER_BY_ID } from '../data/characters';
import { MAX_GUESSES } from './game';
import type { Stats } from './storage';

export interface Profile {
  name: string;
  score: number;
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** distribution[n] = wins in n+1 guesses */
  distribution: number[];
  /** Last daily puzzle recorded (0 = none). */
  lastDay: number;
  /** Last daily puzzle won (0 = none). */
  lastWonDay: number;
  /** Most quotes cleared in one Gauntlet run. */
  gauntletBest: number;
  /** Gauntlet runs finished. */
  gauntletPlayed: number;
  /** Profile picture; none means the player's initial is shown. */
  avatar?: AvatarRef | null;
}

/** A profile picture: one of the character portraits, or a photo the player uploaded (v = upload time). */
export type AvatarRef = { kind: 'character'; id: string } | { kind: 'upload'; v: number };

/** Where to load a player's picture from, or null to show their initial. */
export function avatarSrc(uid: string, avatar: AvatarRef | null | undefined): string | null {
  if (!avatar) return null;
  if (avatar.kind === 'upload') return `/api/avatar/${encodeURIComponent(uid)}?v=${avatar.v}`;
  return CHARACTER_BY_ID.get(avatar.id)?.image ?? null;
}

export interface DailyResult {
  day: number;
  won: boolean;
  guesses: number;
  points: number;
  /** Character ids guessed, in order — lets another device restore the board. */
  picks: string[];
  name: string;
}

export type Board = 'today' | 'points' | 'streak' | 'gauntlet';

export interface LeaderRow {
  uid: string;
  name: string;
  avatar?: AvatarRef | null;
  value: number;
  detail?: string;
}

export interface LeaderboardResponse {
  rows: LeaderRow[];
  /** The caller's position, when signed in and ranked on this board. */
  me: { rank: number; total: number; value: number } | null;
}

/** 6 points for a first-guess win down to 1 for a last-guess win; 0 for a loss. */
export const pointsFor = (won: boolean, guesses: number) => (won ? MAX_GUESSES + 1 - guesses : 0);

export const scoreOf = (distribution: number[]) =>
  distribution.reduce((sum, n, i) => sum + n * pointsFor(true, i + 1), 0);

export function validateName(name: unknown): string | null {
  if (typeof name !== 'string') return 'Name is required.';
  const n = name.trim();
  if (n.length < 2) return 'Name must be at least 2 characters.';
  if (n.length > 20) return 'Name must be 20 characters or fewer.';
  return null;
}

/** The profile after recording one finished daily puzzle. */
export function withResult(p: Profile, day: number, won: boolean, guesses: number): Profile {
  const distribution = [...p.distribution];
  if (won) distribution[guesses - 1]++;
  const currentStreak = won ? (p.lastWonDay === day - 1 ? p.currentStreak + 1 : 1) : 0;
  return {
    ...p,
    score: p.score + pointsFor(won, guesses),
    played: p.played + 1,
    wins: p.wins + (won ? 1 : 0),
    distribution,
    currentStreak,
    maxStreak: Math.max(p.maxStreak, currentStreak),
    lastDay: day,
    lastWonDay: won ? day : p.lastWonDay,
  };
}

/** Profile stats in the shape the stats modal uses. A streak not extended yesterday or today shows as 0. */
export function profileStats(p: Profile, today: number): Stats {
  return {
    played: p.played,
    wins: p.wins,
    currentStreak: p.lastWonDay >= today - 1 ? p.currentStreak : 0,
    maxStreak: p.maxStreak,
    distribution: p.distribution,
    lastWonDay: p.lastWonDay || null,
    lastRecordedDay: p.lastDay || null,
  };
}
