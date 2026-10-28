import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getGatePassword } from '@/lib/secrets';
import {
  GATE_COOKIE_NAME,
  GATE_TTL_SECONDS,
  createGateToken,
  verifyGateToken,
} from '@/lib/gateToken';
import { blockedFor, clientIp, recordFailure, reset } from '@/lib/rateLimit';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

function passwordMatches(input: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const unlocked = await verifyGateToken(req.cookies.get(GATE_COOKIE_NAME)?.value);
  return NextResponse.json({ unlocked });
}

export async function POST(req: NextRequest) {
  const key = `gate:${clientIp(req)}`;
  const wait = blockedFor(key, MAX_FAILURES, WINDOW_MS);
  if (wait > 0) {
    return NextResponse.json(
      { success: false, error: 'Слишком много попыток. Повторите позже.' },
      { status: 429, headers: { 'Retry-After': String(wait) } }
    );
  }

  let password = '';
  try {
    const body = await req.json();
    password = String(body?.password || '').trim();
  } catch {
    return NextResponse.json({ success: false, error: 'Некорректный запрос' }, { status: 400 });
  }

  if (!passwordMatches(password, getGatePassword())) {
    recordFailure(key, WINDOW_MS);
    return NextResponse.json(
      { success: false, error: 'Неверный пароль доступа к контуру' },
      { status: 401 }
    );
  }

  reset(key);
  const res = NextResponse.json({ success: true, message: 'Доступ предоставлен' });
  res.cookies.set(GATE_COOKIE_NAME, await createGateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GATE_TTL_SECONDS,
  });
  return res;
}
