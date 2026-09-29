// Signed admin session tokens (HMAC-SHA256 via Web Crypto).
// Works in both the Node.js runtime (API routes) and the Edge runtime (middleware).
//
// Token format: <adminId>.<expiresAtMs>.<base64url(hmac)>
// Requires ADMIN_SESSION_SECRET (>= 32 chars). Without it sessions are disabled (fail closed).

export const ADMIN_COOKIE = 'sberbits_admin';
export const SESSION_TTL_SEC = 60 * 60 * 12; // 12 hours

const encoder = new TextEncoder();

function getSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return secret;
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(adminId: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const payload = `${adminId}.${Date.now() + SESSION_TTL_SEC * 1000}`;
  return `${payload}.${await sign(payload, secret)}`;
}

/** Returns the admin id if the token is valid and not expired, otherwise null. */
export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [adminId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!adminId || !Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = await sign(`${adminId}.${expStr}`, secret);
  return constantTimeEqual(sig, expected) ? adminId : null;
}

/** Reads the admin cookie from a request and verifies it. */
export async function getAdminFromRequest(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ADMIN_COOKIE}=`));
  if (!match) return null;
  return verifySessionToken(decodeURIComponent(match.slice(ADMIN_COOKIE.length + 1)));
}
