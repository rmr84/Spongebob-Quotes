import { CHARACTER_BY_ID } from '../data/characters';
import type { Quote } from './quotes';

export const MAX_GUESSES = 6;

export type Status = 'playing' | 'won' | 'lost';

export interface GameState {
  quote: Quote;
  guesses: string[]; // character ids
  status: Status;
}

export function newGame(quote: Quote): GameState {
  return { quote, guesses: [], status: 'playing' };
}

export function applyGuess(state: GameState, characterId: string): GameState {
  if (state.status !== 'playing' || state.guesses.includes(characterId)) return state;
  const guesses = [...state.guesses, characterId];
  const status: Status =
    characterId === state.quote.characterId ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
  return { ...state, guesses, status };
}

export interface Hint {
  unlockAfter: number; // wrong guesses needed
  label: string;
  value: string;
}

export function hints(quote: Quote): Hint[] {
  const answer = CHARACTER_BY_ID.get(quote.characterId)!;
  return [
    { unlockAfter: 2, label: 'Season', value: `Season ${quote.season}` },
    { unlockAfter: 3, label: 'Episode', value: `“${quote.episode}”` },
    { unlockAfter: 4, label: 'Initial', value: `Starts with “${answer.name.replace(/^(The |Mr\. |Mrs\. |King |Old Man )/, '')[0]}”` },
  ];
}

/** e.g. "Bikini Bottom Daily #328 3/6" followed by 🟥🟥🟩 (one square per guess). */
export function shareText(state: GameState, title: string): string {
  const score = state.status === 'won' ? state.guesses.length : 'X';
  const squares = state.guesses.map((id) => (id === state.quote.characterId ? '🟩' : '🟥')).join('');
  return `${title} ${score}/${MAX_GUESSES}\n\n${squares}\n\n${location.origin}${location.pathname}`;
}
