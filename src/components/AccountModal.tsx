'use client';

import { useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth } from '../lib/firebase';
import { createProfile, removeAvatar, renameProfile, setCharacterAvatar, uploadAvatar } from '../lib/account';
import { validateName, type AvatarRef, type Profile } from '../lib/profile';
import type { AccountState } from '../lib/useAccount';
import type { Stats } from '../lib/storage';
import type { GameState } from '../lib/game';
import { Modal } from './Modal';
import { CheckIcon, EyeIcon, EyeOffIcon, SignOutIcon } from './Icons';
import { PlayerAvatar } from './PlayerAvatar';
import { CHARACTERS } from '../data/characters';
import { Avatar } from './Avatar';

interface Props {
  account: AccountState;
  localStats: Stats;
  day: number;
  daily: GameState;
  onClose: () => void;
  onShowLeaderboard: () => void;
}

export function AccountModal({ account, localStats, day, daily, onClose, onShowLeaderboard }: Props) {
  const { user, profile } = account;
  // Lifted up so the title can follow the sign-in / create-account toggle.
  const [mode, setMode] = useState<AuthMode>('signin');
  const title = account.loading
    ? 'Account'
    : !user
      ? mode === 'signup'
        ? 'Create an account'
        : 'Sign in'
      : !profile
        ? 'Choose a name'
        : 'Your account';
  return (
    <Modal title={title} onClose={onClose}>
      {account.loading ? (
        <p>Loading…</p>
      ) : !user ? (
        <SignIn mode={mode} setMode={setMode} />
      ) : !profile ? (
        <CreateProfile
          suggested={user.displayName ?? ''}
          localStats={localStats}
          day={day}
          daily={daily}
          onCreated={account.setProfile}
        />
      ) : (
        <ManageAccount
          uid={user.uid}
          avatar={profile.avatar ?? null}
          email={user.email}
          name={profile.name}
          score={profile.score}
          onShowLeaderboard={onShowLeaderboard}
          onRenamed={account.setProfile}
        />
      )}
      {account.error && <p className="form-error">{account.error}</p>}
    </Modal>
  );
}

function friendly(err: unknown): string {
  const code = err instanceof FirebaseError ? err.code : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match an account.';
    case 'auth/email-already-in-use':
      return 'There’s already an account with that email. Try signing in.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'That doesn’t look like an email address.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method isn’t enabled for the app yet.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    default:
      return err instanceof Error ? err.message : 'Something went wrong.';
  }
}

type AuthMode = 'signin' | 'signup';

function SignIn({ mode, setMode }: { mode: AuthMode; setMode: (m: AuthMode) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    run(() =>
      mode === 'signin'
        ? signInWithEmailAndPassword(auth, email, password)
        : createUserWithEmailAndPassword(auth, email, password),
    );
  }

  function resetPassword() {
    if (!email) return setError('Enter your email above, then click “Forgot password?” again.');
    run(async () => {
      await sendPasswordResetEmail(auth, email);
      setNotice(`If there’s an account for ${email}, a reset link is on its way.`);
    });
  }

  return (
    <div className="account signin">
      <p>
        {mode === 'signin' ? 'Sign in' : 'Create an account'} to save your progress across devices and appear on the
        leaderboards.
      </p>
      <form onSubmit={submit} className="form">
        <label>
          Email
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <span className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </label>
        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-notice">{notice}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {mode === 'signin' ? 'Sign in' : 'Create an account'}
        </button>
      </form>
      <div className="form-links">
        <button className="text-btn" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
        {mode === 'signin' && (
          <button className="text-btn" onClick={resetPassword}>
            Forgot password?
          </button>
        )}
      </div>
    </div>
  );
}

interface CreateProps {
  suggested: string;
  localStats: Stats;
  day: number;
  daily: GameState;
  onCreated: (p: Profile) => void;
}

function CreateProfile({ suggested, localStats, day, daily, onCreated }: CreateProps) {
  const [name, setName] = useState(suggested.slice(0, 20));
  const [importLocal, setImportLocal] = useState(localStats.played > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validateName(name);
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    try {
      onCreated(await createProfile(name, importLocal ? localStats : null, day, daily));
    } catch (err) {
      setError(friendly(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form account signin">
      <p>This is the name other players see on the leaderboards.</p>
      <label>
        Display name
        <input autoFocus maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {localStats.played > 0 && (
        <label className="check">
          <input type="checkbox" checked={importLocal} onChange={(e) => setImportLocal(e.target.checked)} />
          Bring over my {localStats.played} {localStats.played === 1 ? 'game' : 'games'} from this device
        </label>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="form-row">
        <button className="btn primary" type="submit" disabled={busy}>
          Save
        </button>
        <button type="button" className="text-btn" onClick={() => signOut(auth)}>
          Cancel and sign out
        </button>
      </div>
    </form>
  );
}

interface ManageProps {
  uid: string;
  avatar: AvatarRef | null;
  email: string | null;
  name: string;
  score: number;
  onShowLeaderboard: () => void;
  onRenamed: (p: Profile) => void;
}

function ManageAccount({ uid, avatar, email, name, score, onShowLeaderboard, onRenamed }: ManageProps) {
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function rename(e: FormEvent) {
    e.preventDefault();
    const problem = validateName(draft);
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    try {
      onRenamed(await renameProfile(draft));
      setSaved(true);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account">
      <ProfilePicture uid={uid} name={name} avatar={avatar} onChanged={onRenamed} />
      <p>
        Signed in{email ? <> as <strong>{email}</strong></> : null}. You have <strong>{score}</strong>{' '}
        {score === 1 ? 'point' : 'points'}.
      </p>
      <form onSubmit={rename} className="form">
        <label>
          Display name
          <input
            maxLength={20}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSaved(false);
            }}
          />
        </label>
        {saved && <p className="form-notice">Saved.</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary btn-icon" type="submit" disabled={busy || draft.trim() === name}>
          <CheckIcon /> Save
        </button>
      </form>
      <hr className="divider-line" />
      <button className="btn btn-icon" onClick={onShowLeaderboard}>
        <span className="btn-emoji" aria-hidden="true">🏆</span> Leaderboards
      </button>
      <button className="btn btn-icon danger" onClick={() => signOut(auth)}>
        <SignOutIcon /> Sign out
      </button>
    </div>
  );
}

interface PictureProps {
  uid: string;
  name: string;
  avatar: AvatarRef | null;
  onChanged: (p: Profile) => void;
}

/** Big profile picture with the ways to change it: upload a photo, pick a character, or remove it. */
function ProfilePicture({ uid, name, avatar, onChanged }: PictureProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);

  async function run(action: () => Promise<Profile>) {
    setBusy(true);
    setError('');
    try {
      onChanged(await action());
      setPicking(false);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-picture" aria-busy={busy}>
      <PlayerAvatar uid={uid} name={name} avatar={avatar} size={104} className="big" />
      <div className="profile-name">{name}</div>
      <div className="picture-actions">
        <label className={`btn btn-icon ${busy ? 'is-disabled' : ''}`}>
          <span aria-hidden="true">📷</span> Upload photo
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ''; // allow picking the same file again
              if (file) run(() => uploadAvatar(file));
            }}
          />
        </label>
        <button type="button" className="btn btn-icon" disabled={busy} onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
          <span aria-hidden="true">🍍</span> {picking ? 'Hide characters' : 'Pick a character'}
        </button>
        {avatar && (
          <button type="button" className="text-btn" disabled={busy} onClick={() => run(removeAvatar)}>
            Remove picture
          </button>
        )}
      </div>
      {picking && (
        <div className="character-picker" role="listbox" aria-label="Choose a character">
          {CHARACTERS.filter((c) => c.image).map((c) => {
            const selected = avatar?.kind === 'character' && avatar.id === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={c.name}
                title={c.name}
                className={selected ? 'selected' : ''}
                disabled={busy}
                onClick={() => run(() => setCharacterAvatar(c.id))}
              >
                <Avatar character={c} />
              </button>
            );
          })}
        </div>
      )}
      {busy && <p className="form-notice">Saving…</p>}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
