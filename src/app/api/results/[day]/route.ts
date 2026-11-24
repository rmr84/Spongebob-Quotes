import { handler, requireUid } from '@/server/auth';
import { collections } from '@/server/mongo';

export const dynamic = 'force-dynamic';

/** The signed-in player's result for one day (used to restore the board on another device). */
export const GET = handler(async (req, { params }) => {
  const uid = await requireUid(req);
  const day = Number((await params).day);
  const { results } = await collections();
  const doc = await results.findOne({ _id: `${uid}:${day}` });
  if (!doc) return Response.json({ result: null });
  const { won, guesses, points, picks, name } = doc;
  return Response.json({ result: { day, won, guesses, points, picks, name } });
});
