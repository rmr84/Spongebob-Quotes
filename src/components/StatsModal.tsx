import type { GauntletStats, Stats } from '../lib/storage';
import { Modal } from './Modal';

interface Props {
  stats: Stats;
  highlight?: number; // guess count of today's win, 1-based
  gauntlet: GauntletStats;
  signedIn: boolean;
  onSignIn: () => void;
  onClose: () => void;
}

export function StatsModal({ stats, highlight, gauntlet, signedIn, onSignIn, onClose }: Props) {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const max = Math.max(1, ...stats.distribution);

  return (
    <Modal title="Statistics" onClose={onClose}>
      <h3 className="first">Daily</h3>
      <div className="stat-row">
        <Stat value={stats.played} label="Played" />
        <Stat value={winPct} label="Win %" />
        <Stat value={stats.currentStreak} label="Streak" />
        <Stat value={stats.maxStreak} label="Best streak" />
      </div>
      <h3>Guess distribution</h3>
      <div className="dist">
        {stats.distribution.map((n, i) => (
          <div className="dist-row" key={i}>
            <span className="dist-label">{i + 1}</span>
            <div
              className={`dist-bar ${highlight === i + 1 ? 'today' : ''}`}
              style={{ width: `${Math.max(8, (n / max) * 100)}%` }}
            >
              {n}
            </div>
          </div>
        ))}
      </div>
      <h3>Gauntlet</h3>
      <div className="stat-row two">
        <Stat value={gauntlet.best} label="Best run" />
        <Stat value={gauntlet.played} label="Runs played" />
      </div>
      {!signedIn && (
        <div className="signin-nudge">
          <span>These stats are only saved on this device. Sign in to keep them and join the leaderboards.</span>
          <button className="btn primary" onClick={onSignIn}>
            Sign in
          </button>
        </div>
      )}
    </Modal>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
