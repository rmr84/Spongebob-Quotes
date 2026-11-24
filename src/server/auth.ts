import 'server-only';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

// Firebase ID tokens are standard JWTs signed by Google. Verifying them only
// needs Google's public keys (fetched and cached by createRemoteJWKSet) and the
// project id — no service-account secret and no firebase-admin, whose
// dependencies don't load on Vercel's Node runtime.
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'spongebob-quotes-fb8af';
const GOOGLE_KEYS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

/** Returns the Firebase uid in a valid ID token, or throws. */
async function verifyIdToken(token: string): Promise<string> {
  // Local testing only: the Auth emulator issues unsigned tokens. Never set this in production.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    const claims = decodeJwt(token);
    if (claims.aud !== PROJECT_ID || typeof claims.sub !== 'string' || !claims.sub) throw new Error('bad emulator token');
    return claims.sub;
  }
  const { payload } = await jwtVerify(token, GOOGLE_KEYS, {
    algorithms: ['RS256'],
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
    clockTolerance: 60,
  }); // also checks the signature and that the token hasn't expired
  const now = Date.now() / 1000;
  const authTime = typeof payload.auth_time === 'number' ? payload.auth_time : Infinity;
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new Error('missing subject');
  if ((payload.iat ?? Infinity) > now + 60 || authTime > now + 60) throw new Error('token from the future');
  return payload.sub;
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
    return await verifyIdToken(token);
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
