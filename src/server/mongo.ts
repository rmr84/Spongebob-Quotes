import 'server-only';
import { MongoClient, type Binary, type ClientSession, type Collection, type Db } from 'mongodb';
import type { DailyResult, Profile } from '@/lib/profile';

export interface UserDoc extends Profile {
  _id: string; // Firebase uid
  createdAt: Date;
  updatedAt: Date;
}

export interface ResultDoc extends DailyResult {
  _id: string; // `${uid}:${day}` — one result per player per day
  uid: string;
  createdAt: Date;
}

/** Uploaded profile pictures, kept apart from users so leaderboard queries stay small. */
export interface AvatarDoc {
  _id: string; // Firebase uid
  data: Binary;
  type: 'image/jpeg' | 'image/png' | 'image/webp';
  updatedAt: Date;
}

const DB_NAME = process.env.MONGODB_DB || 'bikini_bottom_daily';

// Reuse one client across hot reloads (dev) and warm serverless invocations (Vercel).
interface Conn {
  client: MongoClient;
  db: Db;
}
const globalCache = globalThis as unknown as { _mongo?: Promise<Conn> };

async function connect(): Promise<Conn> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  const client = await new MongoClient(uri, { appName: 'bikini-bottom-daily', maxPoolSize: 10 }).connect();
  const db = client.db(DB_NAME);
  await Promise.all([
    db.collection<UserDoc>('users').createIndexes([
      { key: { score: -1 }, name: 'score' },
      { key: { maxStreak: -1 }, name: 'maxStreak' },
    ]),
    db.collection<ResultDoc>('results').createIndexes([
      { key: { day: 1, points: -1, createdAt: 1 }, name: 'daily_board' },
      { key: { uid: 1 }, name: 'uid' },
    ]),
  ]);
  return { client, db };
}

function getConn(): Promise<Conn> {
  if (!globalCache._mongo) {
    globalCache._mongo = connect().catch((err) => {
      globalCache._mongo = undefined; // retry on the next request
      throw err;
    });
  }
  return globalCache._mongo;
}

export async function getDb(): Promise<Db> {
  return (await getConn()).db;
}

export async function collections(): Promise<{
  users: Collection<UserDoc>;
  results: Collection<ResultDoc>;
  avatars: Collection<AvatarDoc>;
}> {
  const db = await getDb();
  return {
    users: db.collection<UserDoc>('users'),
    results: db.collection<ResultDoc>('results'),
    avatars: db.collection<AvatarDoc>('avatars'),
  };
}

/** The public profile fields of a user document. */
export function toProfile(doc: UserDoc): Profile {
  const { name, score, played, wins, currentStreak, maxStreak, distribution, lastDay, lastWonDay, avatar } = doc;
  return { name, score, played, wins, currentStreak, maxStreak, distribution, lastDay, lastWonDay, avatar: avatar ?? null };
}

/** Runs `fn` in a transaction (Atlas clusters are replica sets, so this is supported). */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const { client } = await getConn();
  const session = client.startSession();
  try {
    return await session.withTransaction(() => fn(session));
  } finally {
    await session.endSession();
  }
}
