'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTER_BY_ID } from '@/data/characters';
import { submitGauntlet } from '@/lib/account';
import { STAGES, advanceRun, gauntletOrder, gauntletShareText, guessRun, newSeed, viewRun } from '@/lib/gauntlet';
import type { Profile } from '@/lib/profile';
import type { QuoteDb } from '@/lib/quotes';
import { loadGauntletStats, loadRun, recordRun, saveRun, type SavedRun } from '@/lib/storage';
import { Avatar } from './Avatar';
import { GuessGrid } from './GuessGrid';
import { GuessInput } from './GuessInput';

interface Props {
  db: QuoteDb;
  title: string;
  /** Signed in with a profile: finished runs are saved to the account. */
  uid: string | null;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  onToast: (message: string) => void;
  onShowLeaderboard: () => void;
  onSignIn: () => void;
}

/** How long a correct answer stays on screen before the next quote. */
const ADVANCE_MS = 1100;

export function Gauntlet({ db, title, uid, profile, setProfile, onToast, onShowLeaderboard, onSignIn }: Props) {
  const [run, setRun] = useState<SavedRun | null>(loadRun);
  const [localStats, setLocalStats] = useState(loadGauntletStats);
  const best = Math.max(profile?.gauntletBest ?? 0, profile ? 0 : localStats.best);

  const order = useMemo(() => (run ? gauntletOrder(db, run.seed) : null), [db, run]);
  const view = run && order ? viewRun(order, run) : null;
  const ended = view?.status === 'over' || view?.status === 'complete';

  useEffect(() => saveRun(run), [run]);

  // Right answer: show it for a moment, then deal the next quote.
  useEffect(() => {
    if (!run || !order || view?.status !== 'advancing') return;
    const id = setTimeout(() => setRun((r) => r && { ...r, ...advanceRun(order, r) }), ADVANCE_MS);
    return () => clearTimeout(id);
  }, [run, order, view?.status]);

  // Count a finished run on this device once.
  useEffect(() => {
    if (!run || !view || !ended || run.recorded) return;
    setLocalStats(recordRun(view.cleared));
    setRun({ ...run, recorded: true });
  }, [run, view, ended]);

  // Signed in: save finished runs to the account (the API ignores repeats).
  const hasProfile = !!profile;
  const submitting = useRef<number | null>(null);
  useEffect(() => {
    if (!uid || !hasProfile || !run || !ended || run.submitted || submitting.current === run.seed) return;
    const { seed, rounds } = run;
    submitting.current = seed;
    submitGauntlet(seed, rounds).then(
      (p) => {
        setProfile(p);
        setRun((r) => (r && r.seed === seed ? { ...r, submitted: true } : r));
      },
      (e: Error) => {
        submitting.current = null;
        onToast(`Couldn't save your run: ${e.message}`);
      },
    );
  }, [uid, hasProfile, run, ended, setProfile, onToast]);

  function start() {
    setRun({ seed: newSeed(), rounds: [[]], bestBefore: best });
  }

  function guess(id: string) {
    if (!run || !order) return;
    setRun({ ...run, ...guessRun(order, run, id) });
  }

  async function share() {
    if (!view) return;
    const text = gauntletShareText(title, view.cleared, view.stage, view.status === 'complete');
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        onToast('Copied results to clipboard');
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  if (!run || !view) {
    return (
      <section className="quote-card gauntlet-intro">
        <h2>The Gauntlet</h2>
        <p>
          Quotes keep coming, and each stage is harder than the last, with fewer guesses. Miss one and your run is over.
          How far can you get?
        </p>
        <ol className="stage-list">
          {STAGES.map((s) => (
            <li key={s.name} className={`stage-${s.name.toLowerCase()}`}>
              <span className="stage-pill">{s.name}</span>
              <span className="stage-levels">
                {Number.isFinite(s.length) ? `Quotes ${s.first}–${s.first + s.length - 1}` : `Quote ${s.first} on`}
              </span>
              <span className="stage-guesses">
                {s.guesses} {s.guesses === 1 ? 'guess' : 'guesses'}
              </span>
            </li>
          ))}
        </ol>
        <p className="gauntlet-best">
          Your best: <strong>{best}</strong> {best === 1 ? 'quote' : 'quotes'}
        </p>
        <button className="btn primary start-run" onClick={start}>
          Start a run
        </button>
      </section>
    );
  }

  const answer = CHARACTER_BY_ID.get(view.quote.characterId)!;
  const stageClass = `stage-${view.stage.name.toLowerCase()}`;
  const newBest = ended && view.cleared > run.bestBefore;

  return (
    <>
      <div className={`run-bar ${stageClass}`}>
        <span className="stage-pill">{view.stage.name}</span>
        <span>Quote {view.level}</span>
        <span>
          Score <strong>{view.cleared}</strong>
        </span>
      </div>

      <section className="quote-card" aria-live="polite">
        <span className="quote-mark">“</span>
        <blockquote key={view.level}>{view.quote.text}</blockquote>
        <div className="quote-foot">
          {view.status === 'playing' ? (
            <span>
              Guess {view.picks.length + 1} of {view.stage.guesses}
            </span>
          ) : (
            <span>
              — <strong>{answer.name}</strong>, “{view.quote.episode}” (Season {view.quote.season})
            </span>
          )}
        </div>
      </section>

      {view.status === 'playing' ? (
        <div className="gauntlet-input">
          <GuessInput key={view.level} exclude={view.picks} onGuess={guess} />
        </div>
      ) : view.status === 'advancing' ? (
        <p className="run-correct" role="status">
          ✓ Correct! Next quote…
        </p>
      ) : (
        <section className={`result ${view.status === 'complete' ? 'won' : 'lost'}`}>
          <div className="result-big">
            <Avatar character={answer} big />
            <div>
              <h2>{view.status === 'complete' ? 'You cleared them all!' : 'Run over!'}</h2>
              <p>
                {view.status === 'over' && <>It was {answer.name}. </>}
                You cleared <strong>{view.cleared}</strong> {view.cleared === 1 ? 'quote' : 'quotes'}
                {newBest ? ', a new personal best!' : '.'}
              </p>
            </div>
          </div>
          <div className="result-actions">
            <button className="btn primary" onClick={start}>
              Play again
            </button>
            <button className="btn" onClick={share}>
              Share
            </button>
            <button className="btn" onClick={profile ? onShowLeaderboard : onSignIn}>
              {profile ? 'Leaderboard' : 'Sign in to get ranked'}
            </button>
          </div>
        </section>
      )}

      <GuessGrid guesses={view.picks} answerId={answer.id} />
    </>
  );
}
