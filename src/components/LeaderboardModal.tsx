'use client';

import { useEffect, useState } from 'react';
import { fetchLeaderboard } from '../lib/account';
import type { Board, LeaderboardResponse, Profile } from '../lib/profile';
import { Modal } from './Modal';
import { PlayerAvatar } from './PlayerAvatar';

interface Props {
  day: number;
  initialBoard: Board;
  uid: string | null;
  profile: Profile | null;
  onClose: () => void;
  onSignIn: () => void;
}

const DAILY_TABS: { id: Board; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'points', label: 'All-time' },
  { id: 'streak', label: 'Best streak' },
];
const UNITS: Record<Board, string> = { today: 'pts', points: 'pts', streak: 'days', gauntlet: 'quotes' };

export function LeaderboardModal({ day, initialBoard, uid, profile, onClose, onSignIn }: Props) {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    fetchLeaderboard(board, day).then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
    // Refetch when the profile changes (e.g. today's result was just saved).
  }, [board, day, profile]);

  const unit = UNITS[board];
  const gauntlet = board === 'gauntlet';
  const rows = data?.rows;

  return (
    <Modal title="Leaderboards" onClose={onClose}>
      <nav className="tabs small modes" aria-label="Game mode">
        <button className={!gauntlet ? 'on' : ''} onClick={() => setBoard('today')}>
          📅 Daily
        </button>
        <button className={gauntlet ? 'on' : ''} onClick={() => setBoard('gauntlet')}>
          🔥 Gauntlet
        </button>
      </nav>
      {!gauntlet && (
        <nav className="tabs small" aria-label="Leaderboard">
          {DAILY_TABS.map((t) => (
            <button key={t.id} className={board === t.id ? 'on' : ''} onClick={() => setBoard(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <div className="my-rank">
        {!uid ? (
          <>
            <span>Sign in to get ranked.</span>
            <button className="btn primary" onClick={onSignIn}>
              Sign in
            </button>
          </>
        ) : !profile ? (
          <span>Finish setting up your account to get ranked!</span>
        ) : !data ? (
          <span>Working out your rank…</span>
        ) : data.me ? (
          <span>
            You’re <strong>#{data.me.rank}</strong> of {data.me.total.toLocaleString()}
          </span>
        ) : (
          <span>{gauntlet ? 'Finish a Gauntlet run to get ranked.' : 'Finish today’s puzzle to get ranked.'}</span>
        )}
      </div>

      {error ? (
        <p className="form-error">Couldn’t load the leaderboard: {error}</p>
      ) : !rows ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>
          {board === 'today'
            ? 'Nobody has finished today’s puzzle yet. Be the first!'
            : gauntlet
              ? 'Nobody has cleared a Gauntlet quote yet. Be the first!'
              : 'No players yet.'}
        </p>
      ) : (
        <ol className="leaderboard">
          {rows.map((r) => {
            // Players with equal values share a rank.
            const place = rows.findIndex((x) => x.value === r.value) + 1;
            return (
              <li key={r.uid} className={r.uid === uid ? 'me' : ''}>
                <span className="lb-place">{place <= 3 ? ['🥇', '🥈', '🥉'][place - 1] : place}</span>
                <PlayerAvatar uid={r.uid} name={r.name} avatar={r.avatar} size={30} className="lb-avatar" />
                <span className="lb-name">
                  {r.name}
                  {r.uid === uid && <em> (you)</em>}
                </span>
                {r.detail && <span className="lb-detail">{r.detail}</span>}
                <span className="lb-value">
                  {r.value} <small>{unit}</small>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="fine">
        {gauntlet
          ? 'Ranked by the most quotes cleared in a single run. Ties go to whoever got there first.'
          : 'Points: 6 for a first-guess win, down to 1 for a win on the last guess. Only daily puzzles count.'}
      </p>
    </Modal>
  );
}
