'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CHARACTER_BY_ID } from '@/data/characters';
import { Countdown } from './Countdown';
import { GuessGrid } from './GuessGrid';
import { GuessInput } from './GuessInput';
import { AccountModal } from './AccountModal';
import { HelpModal } from './HelpModal';
import { LeaderboardModal } from './LeaderboardModal';
import { StatsModal } from './StatsModal';
import { Gauntlet } from './Gauntlet';
import { dailyQuote, dayNumber } from '@/lib/daily';
import { MAX_GUESSES, applyGuess, hints, newGame, shareText, type GameState } from '@/lib/game';
import { QUOTE_DB, type QuoteDb } from '@/lib/quotes';
import { loadDaily, loadGauntletStats, loadStats, recordResult, saveDaily, type Stats } from '@/lib/storage';
import { fetchResult, submitDaily } from '@/lib/account';
import { profileStats } from '@/lib/profile';
import { useAccount } from '@/lib/useAccount';
import { Avatar } from './Avatar';
import { HelpIcon, HomeIcon, UserIcon } from './Icons';
import { PlayerAvatar } from './PlayerAvatar';

const TITLE = 'Bikini Bottom Daily';

type Mode = 'daily' | 'gauntlet';

export default function App() {
  return <Game db={QUOTE_DB} />;
}

function Shell({ children, actions, badge }: { children: ReactNode; actions?: ReactNode; badge?: ReactNode }) {
  return (
    <div className="app">
      <Bubbles />
      <header className="top">
        <h1>
          <span className="logo">🍍</span> {TITLE}
        </h1>
        <div className="actions">{actions}</div>
        {badge}
      </header>
      <main>{children}</main>
    </div>
  );
}

function Game({ db }: { db: QuoteDb }) {
  const [day, setDay] = useState(dayNumber);
  const [daily, setDaily] = useState<GameState>(() => startDaily(db, day));
  const [stats, setStats] = useState<Stats>(() => loadStats(day));
  const account = useAccount();
  const { user, profile, setProfile } = account;
  const [modal, setModal] = useState<'help' | 'stats' | 'account' | 'leaderboard' | null>(() =>
    localStorage.getItem('bbd:seenHelp') ? null : 'help',
  );
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('bbd:mode') === 'gauntlet' ? 'gauntlet' : 'daily'));

  function switchMode(m: Mode) {
    setMode(m);
    localStorage.setItem('bbd:mode', m);
    scrollTo({ top: 0 });
  }

  const game = daily;
  const answer = CHARACTER_BY_ID.get(game.quote.characterId)!;
  const wrong = game.guesses.filter((g) => g !== answer.id).length;

  // Persist the daily game, and record stats the moment it ends.
  useEffect(() => {
    saveDaily(day, daily);
    if (daily.status !== 'playing') {
      setStats(recordResult(day, daily));
    }
  }, [day, daily]);

  // Signed in: save finished daily puzzles to the account (submitDaily ignores repeats).
  const uid = user?.uid;
  const lastDay = profile?.lastDay;
  useEffect(() => {
    if (!uid || lastDay === undefined || daily.status === 'playing' || lastDay >= day) return;
    submitDaily(day, daily).then(setProfile, (e: Error) => setToast(`Couldn't save your result: ${e.message}`));
  }, [uid, lastDay, day, daily, setProfile]);

  // Played today's puzzle on another device? Restore that board here.
  useEffect(() => {
    if (!uid || lastDay !== day || daily.status !== 'playing' || daily.guesses.length > 0) return;
    let live = true;
    fetchResult(day).catch(() => null).then((r) => {
      if (!live || !r) return;
      setDaily((d) => (d.guesses.length > 0 ? d : { ...d, guesses: r.picks, status: r.won ? 'won' : 'lost' }));
    });
    return () => {
      live = false;
    };
  }, [uid, lastDay, day, daily.status, daily.guesses.length]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  const rollover = useCallback(() => {
    const today = dayNumber();
    if (today === day) return;
    setDay(today);
    setDaily(startDaily(db, today));
    setStats(loadStats(today));
  }, [day, db]);

  function guess(id: string) {
    const next = applyGuess(game, id);
    setDaily(next);
    if (next.status !== 'playing') {
      setTimeout(() => setModal((m) => m ?? 'stats'), 1400);
    }
  }

  async function share() {
    const text = shareText(daily, `${TITLE} #${day}`);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setToast('Copied results to clipboard');
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  function goHome() {
    closeModal();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeModal() {
    if (modal === 'help') localStorage.setItem('bbd:seenHelp', '1');
    setModal(null);
  }

  const actions = (
    <>
      {/* Phones: a Home tab takes Help's place in the tab bar (Help moves into the Account page). */}
      <button className={`icon-btn home-tab ${modal === null ? 'on' : ''}`} aria-label="Home" aria-current={modal === null ? 'page' : undefined} onClick={goHome}>
        <span className="action-icon"><HomeIcon /></span>
        <span className="action-label">Home</span>
      </button>
      <button className={`icon-btn help-tab ${modal === 'help' ? 'on' : ''}`} aria-label="How to play" aria-current={modal === 'help' ? 'page' : undefined} onClick={() => setModal('help')}>
        <span className="action-icon"><HelpIcon /></span>
        <span className="action-label">Help</span>
      </button>
      <button className={`icon-btn ${modal === 'stats' ? 'on' : ''}`} aria-label="Statistics" aria-current={modal === 'stats' ? 'page' : undefined} onClick={() => setModal('stats')}>
        <span className="action-icon emoji">📊</span>
        <span className="action-label">Stats</span>
      </button>
      <button className={`icon-btn ${modal === 'leaderboard' ? 'on' : ''}`} aria-label="Leaderboards" aria-current={modal === 'leaderboard' ? 'page' : undefined} onClick={() => setModal('leaderboard')}>
        <span className="action-icon emoji">🏆</span>
        <span className="action-label">Leaderboards</span>
      </button>
      <button
        className={`icon-btn ${profile ? 'avatar' : ''} ${modal === 'account' ? 'on' : ''}`}
        aria-current={modal === 'account' ? 'page' : undefined}
        aria-label={profile ? `Account: ${profile.name}` : 'Sign in'}
        title={profile ? profile.name : 'Sign in'}
        onClick={() => setModal('account')}
      >
        <span className="action-icon">
          {profile && user ? <PlayerAvatar uid={user.uid} name={profile.name} avatar={profile.avatar} size={30} /> : <UserIcon />}
        </span>
        <span className="action-label">{profile ? 'Account' : 'Sign in'}</span>
      </button>
    </>
  );

  return (
    <Shell actions={actions} badge={<div className="puzzle-badge">{mode === 'daily' ? `Daily #${day}` : 'Gauntlet'}</div>}>
      <nav className="tabs mode-switch" aria-label="Game mode">
        <button className={mode === 'daily' ? 'on' : ''} aria-pressed={mode === 'daily'} onClick={() => switchMode('daily')}>
          📅 Daily
        </button>
        <button className={mode === 'gauntlet' ? 'on' : ''} aria-pressed={mode === 'gauntlet'} onClick={() => switchMode('gauntlet')}>
          🔥 Gauntlet
        </button>
      </nav>

      {mode === 'gauntlet' ? (
        <Gauntlet
          db={db}
          title={TITLE}
          uid={user?.uid ?? null}
          profile={profile}
          setProfile={setProfile}
          onToast={setToast}
          onShowLeaderboard={() => setModal('leaderboard')}
          onSignIn={() => setModal('account')}
        />
      ) : (
        <>
        <section className="quote-card" aria-live="polite">
          <span className="quote-mark">“</span>
          <blockquote>{game.quote.text}</blockquote>
          <div className="quote-foot">
            {game.status === 'playing' ? (
              <span>
                Guess {game.guesses.length + 1} of {MAX_GUESSES}
              </span>
            ) : (
              <span>
                — <strong>{answer.name}</strong>, “{game.quote.episode}” (Season {game.quote.season})
              </span>
            )}
          </div>
        </section>

        <div className="hints">
          {hints(game.quote).map((h) => {
            const open = wrong >= h.unlockAfter || game.status !== 'playing';
            return (
              <div key={h.label} className={`hint ${open ? 'open' : ''}`}>
                <span className="hint-label">{h.label}</span>
                <span className="hint-value">
                  {open ? h.value : `🔒 in ${h.unlockAfter - wrong} miss${h.unlockAfter - wrong === 1 ? '' : 'es'}`}
                </span>
              </div>
            );
          })}
        </div>

        {game.status === 'playing' ? (
          <GuessInput exclude={game.guesses} onGuess={guess} />
        ) : (
          <section className={`result ${game.status}`}>
            <div className="result-big">
              <Avatar character={answer} big />
              <div>
                <h2>{game.status === 'won' ? pickCheer(game.guesses.length) : 'Tartar sauce!'}</h2>
                <p>
                  {game.status === 'won'
                    ? `You got it in ${game.guesses.length} ${game.guesses.length === 1 ? 'guess' : 'guesses'}.`
                    : `It was ${answer.name}.`}
                </p>
              </div>
            </div>
            <div className="result-actions">
              <button className="btn primary" onClick={share}>
                Share
              </button>
              <div className="next">
                Next quote in <Countdown onRollover={rollover} />
              </div>
            </div>
          </section>
        )}

        <GuessGrid guesses={game.guesses} answerId={answer.id} />
        </>
      )}

     
      {modal === 'help' && <HelpModal total={db.quotes.length} onClose={closeModal} />}
      {modal === 'stats' && (
        <StatsModal
          stats={profile ? profileStats(profile, day) : stats}
          signedIn={!!profile}
          onSignIn={() => setModal('account')}
          highlight={daily.status === 'won' ? daily.guesses.length : undefined}
          gauntlet={profile ? { best: profile.gauntletBest, played: profile.gauntletPlayed } : loadGauntletStats()}
          onClose={closeModal}
        />
      )}
      {modal === 'account' && (
        <AccountModal
          account={account}
          localStats={stats}
          day={day}
          daily={daily}
          onClose={closeModal}
          onShowLeaderboard={() => setModal('leaderboard')}
          onShowHelp={() => setModal('help')}
        />
      )}
      {modal === 'leaderboard' && (
        <LeaderboardModal
          day={day}
          initialBoard={mode === 'gauntlet' ? 'gauntlet' : 'today'}
          uid={user?.uid ?? null}
          profile={profile}
          onClose={closeModal}
          onSignIn={() => setModal('account')}
          onPlay={(m) => {
            switchMode(m);
            setModal(null);
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </Shell>
  );
}

/** The saved game for `day`, unless it was for a different quote (e.g. the puzzle was re-pinned). */
function startDaily(db: QuoteDb, day: number): GameState {
  const quote = dailyQuote(db, day);
  const saved = loadDaily(day);
  return saved && saved.quote.text === quote.text ? saved : newGame(quote);
}

function pickCheer(n: number) {
  return ['Barnacles, first try!', 'Fin-tastic!', 'Order up!', 'Aye aye, captain!', 'Phew, nice save!', 'Just in time!'][n - 1];
}

function Bubbles() {
  return (
    <div className="bubbles" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.3) % 9}s`, width: 8 + ((i * 7) % 22), height: 8 + ((i * 7) % 22) }} />
      ))}
    </div>
  );
}
