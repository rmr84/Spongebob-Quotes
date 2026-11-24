import { HttpError, handler, requireUid } from '@/server/auth';
import { collections, toProfile, withTransaction } from '@/server/mongo';
import { checkRun, gauntletOrder } from '@/lib/gauntlet';
import { QUOTE_DB } from '@/lib/quotes';

export const dynamic = 'force-dynamic';

/**
 * Record a finished Gauntlet run: `{ seed, rounds: characterId[][] }`.
 * The score is worked out by replaying the guesses against the quotes that
 * seed deals. Sending the same run twice is a no-op.
 */
export const POST = handler(async (req) => {
  const uid = await requireUid(req);
  const body = await req.json().catch(() => ({}));
  const seed = body.seed;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new HttpError(400, 'Invalid run.');
  const score = checkRun(gauntletOrder(QUOTE_DB, seed), body.rounds);
  if (score === null) throw new HttpError(400, 'That run doesn’t follow the rules, so it can’t be saved.');
  const rounds = body.rounds as string[][];
  const { users, runs } = await collections();

  const outcome = await withTransaction(async (session) => {
    const user = await users.findOne({ _id: uid }, { session });
    if (!user) throw new HttpError(404, 'Create your profile first.');
    const _id = `${uid}:${seed}`;
    if (await runs.findOne({ _id }, { session, projection: { _id: 1 } })) return { recorded: false, user };

    const now = new Date();
    await runs.insertOne({ _id, uid, seed, score, rounds, createdAt: now }, { session });
    const best = user.gauntletBest ?? 0;
    const fields = {
      gauntletPlayed: (user.gauntletPlayed ?? 0) + 1,
      ...(score > best ? { gauntletBest: score, gauntletBestAt: now } : {}),
      updatedAt: now,
    };
    await users.updateOne({ _id: uid }, { $set: fields }, { session });
    return { recorded: true, user: { ...user, ...fields } };
  });

  return Response.json(
    { recorded: outcome.recorded, profile: toProfile(outcome.user) },
    { status: outcome.recorded ? 201 : 200 },
  );
});
