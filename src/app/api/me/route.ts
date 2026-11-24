import { HttpError, handler, requireUid } from '@/server/auth';
import { collections, toProfile, withTransaction } from '@/server/mongo';
import { importedProfile } from '@/server/validate';
import { validateName } from '@/lib/profile';

export const dynamic = 'force-dynamic';

/** The signed-in player's profile, or `{ profile: null }` if they haven't created one yet. */
export const GET = handler(async (req) => {
  const uid = await requireUid(req);
  const { users } = await collections();
  const doc = await users.findOne({ _id: uid });
  return Response.json({ profile: doc ? toProfile(doc) : null });
});

/** Create a profile: `{ name, imported?: Stats }`. */
export const POST = handler(async (req) => {
  const uid = await requireUid(req);
  const body = await req.json().catch(() => ({}));
  const profile = importedProfile(body.name, body.imported);
  const { users } = await collections();
  const now = new Date();
  // Only the first create wins; a repeat (e.g. a double click) just returns the existing profile.
  await users.updateOne({ _id: uid }, { $setOnInsert: { ...profile, createdAt: now, updatedAt: now } }, { upsert: true });
  const doc = await users.findOne({ _id: uid });
  return Response.json({ profile: toProfile(doc!) }, { status: 201 });
});

/** Rename: `{ name }`. Past results show the new name too. */
export const PATCH = handler(async (req) => {
  const uid = await requireUid(req);
  const body = await req.json().catch(() => ({}));
  const error = validateName(body.name);
  if (error) throw new HttpError(400, error);
  const name = (body.name as string).trim();
  const { users, results } = await collections();
  const doc = await withTransaction(async (session) => {
    const updated = await users.findOneAndUpdate(
      { _id: uid },
      { $set: { name, updatedAt: new Date() } },
      { session, returnDocument: 'after' },
    );
    if (!updated) throw new HttpError(404, 'Create your profile first.');
    await results.updateMany({ uid }, { $set: { name } }, { session });
    return updated;
  });
  return Response.json({ profile: toProfile(doc) });
});
