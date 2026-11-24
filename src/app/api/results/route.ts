import { HttpError, handler, requireUid } from '@/server/auth';
import { collections, toProfile, withTransaction } from '@/server/mongo';
import { assertRecentDay, replayDaily } from '@/server/validate';
import { pointsFor, withResult } from '@/lib/profile';

export const dynamic = 'force-dynamic';

/**
 * Record a finished daily puzzle: `{ day, picks: characterId[] }`.
 * The outcome is worked out by replaying the picks against that day's answer.
 * Recording the same day twice is a no-op.
 */
export const POST = handler(async (req) => {
  const uid = await requireUid(req);
  const body = await req.json().catch(() => ({}));
  const day = body.day;
  assertRecentDay(day);
  const { won, guesses, picks } = replayDaily(day, body.picks);
  const { users, results } = await collections();

  const outcome = await withTransaction(async (session) => {
    const user = await users.findOne({ _id: uid }, { session });
    if (!user) throw new HttpError(404, 'Create your profile first.');
    if (user.lastDay >= day) return { recorded: false, user };

    const next = withResult(user, day, won, guesses);
    const now = new Date();
    await results.insertOne(
      { _id: `${uid}:${day}`, uid, day, won, guesses, points: pointsFor(won, guesses), picks, name: user.name, createdAt: now },
      { session },
    );
    const fields = {
      score: next.score,
      played: next.played,
      wins: next.wins,
      distribution: next.distribution,
      currentStreak: next.currentStreak,
      maxStreak: next.maxStreak,
      lastDay: next.lastDay,
      lastWonDay: next.lastWonDay,
      updatedAt: now,
    };
    await users.updateOne({ _id: uid, lastDay: user.lastDay }, { $set: fields }, { session });
    return { recorded: true, user: { ...user, ...fields } };
  });

  return Response.json(
    { recorded: outcome.recorded, profile: toProfile(outcome.user) },
    { status: outcome.recorded ? 201 : 200 },
  );
});
