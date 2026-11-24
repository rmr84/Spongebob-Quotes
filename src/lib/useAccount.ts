import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';
import { fetchProfile } from './account';
import type { Profile } from './profile';

export interface AccountState {
  /** True until we know who is signed in and have loaded their profile. */
  loading: boolean;
  user: User | null;
  /** null when signed out, or signed in but the profile hasn't been created yet. */
  profile: Profile | null;
  error: string | null;
  /** Replace the cached profile with one the API just returned. */
  setProfile: (p: Profile) => void;
}

export function useAccount(): AccountState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setProfileState(null);
        setError(null);
        if (!u) return setLoading(false);
        setLoading(true);
        try {
          setProfileState(await fetchProfile());
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Couldn’t load your account.');
        } finally {
          setLoading(false);
        }
      }),
    [],
  );

  const setProfile = useCallback((p: Profile) => setProfileState(p), []);
  return { loading, user, profile, error, setProfile };
}
