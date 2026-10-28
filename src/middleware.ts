import { NextRequest, NextResponse } from 'next/server';
import { GATE_COOKIE_NAME, verifyGateToken } from '@/lib/gateToken';
import { getAllowedOrigins } from '@/lib/secrets';

const isProd = process.env.NODE_ENV === 'production';

const PUBLIC_API = ['/api/health', '/api/gate'];
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function withSecurityHeaders(res: NextResponse, req: NextRequest): NextResponse {
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProd) {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // CORS: только явно разрешённые источники (ALLOWED_ORIGINS), без wildcard
  const origin = req.headers.get('origin');
  if (origin && getAllowedOrigins().includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
    res.headers.append('Vary', 'Origin');
  }
  return res;
}

function json(req: NextRequest, status: number, error: string): NextResponse {
  return withSecurityHeaders(NextResponse.json({ error }, { status }), req);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname === '/api' || pathname.startsWith('/api/');
  const origin = req.headers.get('origin');
  const allowed = getAllowedOrigins();

  if (isApi && req.method === 'OPTIONS') {
    if (origin && allowed.includes(origin)) {
      return withSecurityHeaders(new NextResponse(null, { status: 204 }), req);
    }
    return json(req, 403, 'Origin not allowed');
  }

  // CSRF: изменяющие запросы с чужого Origin отклоняем
  if (isApi && !SAFE_METHODS.includes(req.method) && origin) {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(origin).host === req.headers.get('host');
    } catch {}
    if (!sameOrigin && !allowed.includes(origin)) return json(req, 403, 'Cross-origin request blocked');
  }

  if (isApi && PUBLIC_API.includes(pathname)) {
    return withSecurityHeaders(NextResponse.next(), req);
  }

  const unlocked = await verifyGateToken(req.cookies.get(GATE_COOKIE_NAME)?.value);
  if (unlocked) return withSecurityHeaders(NextResponse.next(), req);

  if (isApi) return json(req, 401, 'Site gate locked');

  // Страницы без гейта: отдаём пустую заглушку, форму пароля рисует SiteGate
  const url = req.nextUrl.clone();
  url.pathname = '/gate-locked';
  return withSecurityHeaders(NextResponse.rewrite(url), req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|woff2?)$).*)'],
};

