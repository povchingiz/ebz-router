import { NextRequest, NextResponse } from 'next/server';

const GATE_PASSWORD = process.env.SITE_GATE_PASSWORD || 'localastana1!';
const GATE_COOKIE_NAME = 'site_gate_pass';

export async function GET(req: NextRequest) {
  const gateCookie = req.cookies.get(GATE_COOKIE_NAME)?.value;
  const isUnlocked = gateCookie === 'unlocked_2026';

  return NextResponse.json({
    unlocked: isUnlocked,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = String(body.password || '').trim();

    if (password === GATE_PASSWORD) {
      const res = NextResponse.json({
        success: true,
        message: 'Доступ предоставлен',
      });

      // Устанавливаем защищенную куку на 30 дней
      res.cookies.set(GATE_COOKIE_NAME, 'unlocked_2026', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 дней
      });

      return res;
    }

    return NextResponse.json(
      { success: false, error: 'Неверный пароль доступа к контуру' },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Ошибка проверки пароля' },
      { status: 500 }
    );
  }
}
