import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(authService.COOKIE_NAME)?.value;
    let user = null;
    if (token) {
      user = authService.verifySessionToken(token);
    }

    // Для удобства тестирования и демонстраций возвращаем также список демо-учеток
    const testAccounts = authService.getPresetCredentialsInfo();

    return NextResponse.json({
      ok: true,
      user,
      testAccounts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
