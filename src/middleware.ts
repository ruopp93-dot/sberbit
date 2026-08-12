import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function safeEqual(a: string, b: string) {
  return a === b;
}

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="SberBits Admin"',
      'Cache-Control': 'no-store',
    },
  });
}

export function middleware(request: NextRequest) {
  const configuredLogin = process.env.ADMIN_LOGIN;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const authorization = request.headers.get('authorization');

  if (!configuredLogin || !configuredPassword || !authorization?.startsWith('Basic ')) {
    return unauthorized();
  }

  try {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) return unauthorized();

    const login = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    if (!safeEqual(login, configuredLogin) || !safeEqual(password, configuredPassword)) {
      return unauthorized();
    }
  } catch {
    return unauthorized();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
