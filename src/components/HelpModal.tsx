import { MAX_GUESSES } from '../lib/game';
import { Modal } from './Modal';

export function HelpModal({ total, onClose }: { total: number; onClose: () => void }) {
  return (
    <Modal title="How to play" onClose={onClose}>
      <p>
        Every day there's a new famous line from the classic seasons of Bikini Bottom. You have <strong>{MAX_GUESSES} guesses</strong> to name
        the character who said it.
      </p>
      <p>
        Wrong guesses show up in <strong className="text-wrong">red ✗</strong>, and the right answer in{' '}
        <strong className="text-right">green ✓</strong>.
      </p>
      <p>
        Hints unlock as you miss: the <strong>season</strong> after 2 wrong guesses, the <strong>episode</strong> after 3, and
        the character's <strong>first initial</strong> after 4.
      </p>
      <p>A new quote arrives at midnight, your local time.</p>
      <p className="fine">
        {total} well-known quotes, checked word for word against the episode transcripts on the SpongeBob fan wiki (CC
        BY-SA). This is an unofficial fan project and isn't affiliated with Nickelodeon.
      </p>
    </Modal>
  );
}
