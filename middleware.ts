import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Origins allowed to call this API from a browser — e.g. the Mac frontend
// (http://localhost:3002 on the Mac) syncing with this Ubuntu server. Auth is a
// Bearer token, never a cookie, so allowing an origin does not let a page act as
// the user unless it also holds their token.
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3001')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const ALLOW_METHODS = 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS';
// Every custom header the sync client sends (lib/sync/syncEngine) must be listed,
// or the browser blocks the request and it looks like being offline.
const ALLOW_HEADERS = 'Content-Type, Authorization, If-None-Match, If-Match, X-Ars-Sha256, X-Ars-Name, X-Ars-Metadata, X-Ars-Reuse';
const EXPOSE_HEADERS = 'ETag, X-Ars-Sha256, X-Ars-Server-Time, Retry-After';

function applyCors(response: NextResponse, origin: string) {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', ALLOW_METHODS);
  response.headers.set('Access-Control-Allow-Headers', ALLOW_HEADERS);
  response.headers.set('Access-Control-Expose-Headers', EXPOSE_HEADERS);
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Vary', 'Origin');
    if (isAllowed) {
      applyCors(response, origin);
      response.headers.set('Access-Control-Max-Age', '86400');
    }
    return response;
  }

  const response = NextResponse.next();
  response.headers.set('Vary', 'Origin');
  if (isAllowed) applyCors(response, origin);
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
