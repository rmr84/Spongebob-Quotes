import { CHARACTER_BY_ID } from '../data/characters';
import { Avatar } from './Avatar';

interface Props {
  guesses: string[];
  answerId: string;
}

/** The player's guesses in the order they were made: red ✗ for a miss, green ✓ for the answer. */
export function GuessGrid({ guesses, answerId }: Props) {
  if (guesses.length === 0) return null;

  return (
    <ol className="guess-list" aria-label="Your guesses">
      {guesses.map((id, i) => {
        const c = CHARACTER_BY_ID.get(id)!;
        const correct = id === answerId;
        return (
          <li key={id} className={`guess ${correct ? 'correct' : 'wrong'}`}>
            <span className="guess-num">{i + 1}</span>
            <Avatar character={c} />
            <span className="guess-name">{c.name}</span>
            <span className="guess-mark" role="img" aria-label={correct ? 'Correct' : 'Wrong'}>
              {correct ? '✓' : '✗'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
