import { HttpError, handler, optionalUid } from '@/server/auth';
import { collections } from '@/server/mongo';
import { MAX_GUESSES } from '@/lib/game';
import type { Board, LeaderboardResponse } from '@/lib/profile';

export const dynamic = 'force-dynamic';

const TOP = 50;
const BOARDS: Board[] = ['today', 'points', 'streak'];

/**
 * GET /api/leaderboard?board=today|points|streak&day=N
 * Public. With a sign-in token, also returns the caller's rank.
 */
export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const board = url.searchParams.get('board') as Board;
  if (!BOARDS.includes(board)) throw new HttpError(400, 'Unknown leaderboard.');
  const uid = await optionalUid(req);
  const { users, results } = await collections();

  let body: LeaderboardResponse;
  if (board === 'today') {
    const day = Number(url.searchParams.get('day'));
    if (!Number.isInteger(day)) throw new HttpError(400, 'Missing day.');
    const [docs, mine] = await Promise.all([
      results.find({ day }).sort({ points: -1, createdAt: 1 }).limit(TOP).toArray(),
      uid ? results.findOne({ _id: `${uid}:${day}` }) : null,
    ]);
    let me: LeaderboardResponse['me'] = null;
    if (mine) {
      const [ahead, total] = await Promise.all([
        results.countDocuments({ day, points: { $gt: mine.points } }),
        results.countDocuments({ day }),
      ]);
      me = { rank: ahead + 1, total, value: mine.points };
    }
    // Results don't store the picture (it can change), so look it up from the players' profiles.
    const pics = new Map(
      (await users.find({ _id: { $in: docs.map((r) => r.uid) } }, { projection: { avatar: 1 } }).toArray()).map((u) => [
        u._id,
        u.avatar ?? null,
      ]),
    );
    body = {
      rows: docs.map((r) => ({
        uid: r.uid,
        name: r.name,
        avatar: pics.get(r.uid) ?? null,
        value: r.points,
        detail: r.won ? `${r.guesses}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`,
      })),
      me,
    };
  } else {
    const field = board === 'points' ? 'score' : 'maxStreak';
    const [docs, mine] = await Promise.all([
      users.find().sort({ [field]: -1, _id: 1 }).limit(TOP).toArray(),
      uid ? users.findOne({ _id: uid }) : null,
    ]);
    let me: LeaderboardResponse['me'] = null;
    if (mine) {
      const [ahead, total] = await Promise.all([
        users.countDocuments({ [field]: { $gt: mine[field] } }),
        users.estimatedDocumentCount(),
      ]);
      me = { rank: ahead + 1, total, value: mine[field] };
    }
    body = {
      rows: docs.map((u) => ({
        uid: u._id,
        name: u.name,
        avatar: u.avatar ?? null,
        value: u[field],
        detail: board === 'points' ? `${u.wins}/${u.played} won` : `current ${u.currentStreak}`,
      })),
      me,
    };
  }
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
});
