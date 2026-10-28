import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { blockedFor, clientIp, recordFailure, reset } from '@/lib/rateLimit';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IP = 20;
const MAX_FAILURES_PER_USER = 8;

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { ok: false, error: 'Слишком много попыток входа. Повторите позже.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: 'Укажите имя пользователя и пароль' },
        { status: 400 }
      );
    }

    const ipKey = `login:ip:${clientIp(req)}`;
    const userKey = `login:user:${String(username).trim().toLowerCase()}`;
    const wait = Math.max(
      blockedFor(ipKey, MAX_FAILURES_PER_IP, WINDOW_MS),
      blockedFor(userKey, MAX_FAILURES_PER_USER, WINDOW_MS)
    );
    if (wait > 0) return tooMany(wait);

    const session = await authService.authenticate(String(username), String(password));
    if (!session) {
      recordFailure(ipKey, WINDOW_MS);
      recordFailure(userKey, WINDOW_MS);
      return NextResponse.json(
        { ok: false, error: 'Неверное имя пользователя или пароль' },
        { status: 401 }
      );
    }

    reset(userKey);
    const token = authService.createSignedSessionToken(session);

    const response = NextResponse.json({
      ok: true,
      user: session,
    });

    response.cookies.set({
      name: authService.COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 дней
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
