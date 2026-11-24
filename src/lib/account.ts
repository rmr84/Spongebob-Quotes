// Browser-side client for the accounts API (src/app/api). The API stores
// everything in MongoDB; Firebase is only used to sign players in.
import { auth } from './firebase';
import type { GameState } from './game';
import type { Board, DailyResult, LeaderboardResponse, Profile } from './profile';
import type { Stats } from './storage';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit & { auth?: 'required' | 'optional' } = {}): Promise<T> {
  const user = auth.currentUser;
  if (init.auth === 'required' && !user) throw new ApiError(401, 'Sign in required.');
  const headers = new Headers(init.headers);
  if (user && init.auth) headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export async function fetchProfile(): Promise<Profile | null> {
  return (await api<{ profile: Profile | null }>('/api/me', { auth: 'required' })).profile;
}

/**
 * Local stats minus today's game, so that today's result is recorded the
 * normal way (and shows up on today's leaderboard) right after the import.
 */
function withoutToday(s: Stats, day: number, today: GameState): Stats {
  if (s.lastRecordedDay !== day || today.status === 'playing') return s;
  const won = today.status === 'won';
  const distribution = [...s.distribution];
  if (won) distribution[today.guesses.length - 1]--;
  const played = s.played - 1;
  const wins = s.wins - (won ? 1 : 0);
  const currentStreak = won ? Math.max(0, s.currentStreak - 1) : 0;
  return {
    played,
    wins,
    distribution,
    currentStreak,
    maxStreak: Math.min(s.maxStreak, wins),
    lastWonDay: currentStreak > 0 ? day - 1 : s.lastWonDay === day ? null : s.lastWonDay,
    lastRecordedDay: played > 0 ? day - 1 : null,
  };
}

/** Creates the profile, optionally carrying over stats saved on this device. */
export async function createProfile(name: string, local: Stats | null, day: number, today: GameState): Promise<Profile> {
  const s = local && withoutToday(local, day, today);
  const imported = s && {
    played: s.played,
    wins: s.wins,
    distribution: s.distribution,
    currentStreak: s.currentStreak,
    maxStreak: s.maxStreak,
    lastDay: s.lastRecordedDay ?? 0,
    lastWonDay: s.lastWonDay ?? 0,
  };
  const body = JSON.stringify({ name: name.trim(), imported });
  return (await api<{ profile: Profile }>('/api/me', { method: 'POST', body, auth: 'required' })).profile;
}

export async function renameProfile(name: string): Promise<Profile> {
  const body = JSON.stringify({ name: name.trim() });
  return (await api<{ profile: Profile }>('/api/me', { method: 'PATCH', body, auth: 'required' })).profile;
}

/** Records a finished daily puzzle. Safe to call repeatedly: a day is only ever recorded once. */
export async function submitDaily(day: number, state: GameState): Promise<Profile> {
  const body = JSON.stringify({ day, picks: state.guesses });
  return (await api<{ profile: Profile }>('/api/results', { method: 'POST', body, auth: 'required' })).profile;
}

export async function fetchResult(day: number): Promise<DailyResult | null> {
  return (await api<{ result: DailyResult | null }>(`/api/results/${day}`, { auth: 'required' })).result;
}

export async function fetchLeaderboard(board: Board, day: number): Promise<LeaderboardResponse> {
  return api<LeaderboardResponse>(`/api/leaderboard?board=${board}&day=${day}`, { auth: 'optional' });
}

// ------------------------------------------------------------ profile picture

export async function setCharacterAvatar(id: string): Promise<Profile> {
  const body = JSON.stringify({ kind: 'character', id });
  return (await api<{ profile: Profile }>('/api/me/avatar', { method: 'PUT', body, auth: 'required' })).profile;
}

export async function uploadAvatar(file: File): Promise<Profile> {
  const body = JSON.stringify({ kind: 'upload', image: await squareThumbnail(file) });
  return (await api<{ profile: Profile }>('/api/me/avatar', { method: 'PUT', body, auth: 'required' })).profile;
}

export async function removeAvatar(): Promise<Profile> {
  return (await api<{ profile: Profile }>('/api/me/avatar', { method: 'DELETE', auth: 'required' })).profile;
}

/**
 * Crops a photo to a centered square and shrinks it to 256×256 JPEG before
 * upload, so a 5 MB phone photo becomes ~15 KB.
 */
async function squareThumbnail(file: File, size = 256): Promise<string> {
  if (!file.type.startsWith('image/')) throw new ApiError(400, 'Please choose an image file.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ApiError(400, 'Couldn’t read that image. Try a JPEG or PNG.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
