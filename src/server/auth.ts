import 'server-only';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Verifying Firebase ID tokens only needs the project id (Google's public
// signing keys are fetched automatically), so no service-account secret is
// required. If FIREBASE_AUTH_EMULATOR_HOST is set, tokens from the local Auth
// emulator are accepted instead.
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'spongebob-quotes-fb8af';

function adminAuth() {
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  return getAuth(app);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The signed-in user's uid, or null if the request has no valid token. */
export async function optionalUid(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    throw new HttpError(401, 'Your sign-in has expired. Please sign in again.');
  }
}

export async function requireUid(req: Request): Promise<string> {
  const uid = await optionalUid(req);
  if (!uid) throw new HttpError(401, 'Sign in required.');
  return uid;
}

/** Wraps a route handler: HttpErrors become JSON error responses; anything else is a 500. */
export function handler(fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
      console.error(err);
      return Response.json({ error: 'Something went wrong on our end.' }, { status: 500 });
    }
  };
}
