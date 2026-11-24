import { handler } from '@/server/auth';
import { collections } from '@/server/mongo';

export const dynamic = 'force-dynamic';

/**
 * A player's uploaded profile picture. Public, like the leaderboards it appears on.
 * The URL carries ?v=<upload time>, so each version can be cached for a long time.
 */
export const GET = handler(async (_req, { params }) => {
  const uid = (await params).uid;
  const { avatars } = await collections();
  const doc = await avatars.findOne({ _id: uid });
  if (!doc) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(doc.data.buffer), {
    headers: {
      'Content-Type': doc.type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    },
  });
});
