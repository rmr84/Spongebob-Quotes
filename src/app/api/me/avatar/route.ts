import { Binary } from 'mongodb';
import { HttpError, handler, requireUid } from '@/server/auth';
import { collections, toProfile, type AvatarDoc } from '@/server/mongo';
import { CHARACTER_BY_ID } from '@/data/characters';
import type { AvatarRef } from '@/lib/profile';

export const dynamic = 'force-dynamic';

/** The browser shrinks photos to a small square first, so anything bigger than this is suspicious. */
const MAX_BYTES = 200 * 1024;

/** Works out the image type from the file's first bytes rather than trusting what the client says. */
function sniff(bytes: Buffer): AvatarDoc['type'] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Set your profile picture.
 *   { kind: 'character', id: 'patrick' }                 use a character portrait
 *   { kind: 'upload', image: 'data:image/jpeg;base64,…' } use your own photo
 */
export const PUT = handler(async (req) => {
  const uid = await requireUid(req);
  const body = await req.json().catch(() => ({}));
  const { users, avatars } = await collections();
  if (!(await users.findOne({ _id: uid }, { projection: { _id: 1 } }))) throw new HttpError(404, 'Create your profile first.');

  let avatar: AvatarRef;
  if (body.kind === 'character') {
    if (typeof body.id !== 'string' || !CHARACTER_BY_ID.get(body.id)?.image) throw new HttpError(400, 'Unknown character.');
    avatar = { kind: 'character', id: body.id };
    await avatars.deleteOne({ _id: uid });
  } else if (body.kind === 'upload') {
    const match = typeof body.image === 'string' ? body.image.match(/^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=]+)$/) : null;
    if (!match) throw new HttpError(400, 'That doesn’t look like an image.');
    const bytes = Buffer.from(match[1], 'base64');
    if (bytes.length > MAX_BYTES) throw new HttpError(413, 'That picture is too large.');
    const type = sniff(bytes);
    if (!type) throw new HttpError(400, 'Please use a JPEG, PNG or WebP image.');
    const now = new Date();
    await avatars.updateOne({ _id: uid }, { $set: { data: new Binary(bytes), type, updatedAt: now } }, { upsert: true });
    avatar = { kind: 'upload', v: now.getTime() };
  } else {
    throw new HttpError(400, 'Choose a character or upload a picture.');
  }

  const doc = await users.findOneAndUpdate({ _id: uid }, { $set: { avatar, updatedAt: new Date() } }, { returnDocument: 'after' });
  return Response.json({ profile: toProfile(doc!) });
});

/** Remove your profile picture (your initial is shown instead). */
export const DELETE = handler(async (req) => {
  const uid = await requireUid(req);
  const { users, avatars } = await collections();
  await avatars.deleteOne({ _id: uid });
  const doc = await users.findOneAndUpdate({ _id: uid }, { $set: { avatar: null, updatedAt: new Date() } }, { returnDocument: 'after' });
  if (!doc) throw new HttpError(404, 'Create your profile first.');
  return Response.json({ profile: toProfile(doc) });
});
