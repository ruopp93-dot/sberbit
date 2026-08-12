import { timingSafeEqual } from 'node:crypto';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function isAdminAuthorized(request: Request): boolean {
  const configuredLogin = process.env.ADMIN_LOGIN;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredLogin || !configuredPassword) return false;

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Basic ')) return false;

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) return false;
    const login = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return safeEqual(login, configuredLogin) && safeEqual(password, configuredPassword);
  } catch {
    return false;
  }
}

export function unauthorizedResponse() {
  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="SberBits Admin"' },
  });
}
