import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

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

    const session = authService.authenticate(username, password);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: 'Неверное имя пользователя или пароль' },
        { status: 401 }
      );
    }

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
