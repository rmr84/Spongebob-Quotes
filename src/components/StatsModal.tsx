import { useState } from 'react';
import { STAGES, stageFor } from '../lib/gauntlet';
import type { GauntletStats, Stats } from '../lib/storage';
import { Modal } from './Modal';

interface Props {
  stats: Stats;
  highlight?: number; // guess count of today's win, 1-based
  gauntlet: GauntletStats;
  /** Which mode's stats to show first (the one being played). */
  initialMode: 'daily' | 'gauntlet';
  signedIn: boolean;
  onSignIn: () => void;
  onClose: () => void;
}

export function StatsModal({ stats, highlight, gauntlet, initialMode, signedIn, onSignIn, onClose }: Props) {
  const [mode, setMode] = useState(initialMode);

  return (
    <Modal title="Statistics" onClose={onClose}>
      <nav className="tabs small modes" aria-label="Game mode">
        <button className={mode === 'daily' ? 'on' : ''} aria-pressed={mode === 'daily'} onClick={() => setMode('daily')}>
          📅 Daily
        </button>
        <button className={mode === 'gauntlet' ? 'on' : ''} aria-pressed={mode === 'gauntlet'} onClick={() => setMode('gauntlet')}>
          🔥 Gauntlet
        </button>
      </nav>

      {mode === 'daily' ? (
        <DailyStats stats={stats} highlight={highlight} />
      ) : (
        <GauntletStatsView stats={gauntlet} />
      )}

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

function DailyStats({ stats, highlight }: { stats: Stats; highlight?: number }) {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const max = Math.max(1, ...stats.distribution);
  return (
    <>
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
    </>
  );
}

function GauntletStatsView({ stats }: { stats: GauntletStats }) {
  // The stage the best run ended in (the quote after the last one cleared).
  const furthest = stats.played ? stageFor(stats.best + 1) : null;
  return (
    <>
      <div className="stat-row two">
        <Stat value={stats.best} label="Best run" />
        <Stat value={stats.played} label="Runs played" />
      </div>
      <h3>Furthest stage</h3>
      <ol className="stage-list stats-stages">
        {STAGES.map((s) => {
          const reached = !!furthest && furthest.first >= s.first;
          return (
            <li key={s.name} className={`stage-${s.name.toLowerCase()} ${reached ? 'reached' : 'locked'}`}>
              <span className="stage-pill">{s.name}</span>
              <span className="stage-levels">
                {Number.isFinite(s.length) ? `Quotes ${s.first}–${s.first + s.length - 1}` : `Quote ${s.first} on`}
              </span>
              <span className="stage-guesses">{reached ? (s === furthest ? '★ Best' : '✓') : '🔒'}</span>
            </li>
          );
        })}
      </ol>
      {!stats.played && <p className="fine">Finish a Gauntlet run to see how far you got.</p>}
    </>
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
