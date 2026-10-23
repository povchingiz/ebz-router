import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth';
import { UserRole } from '@/types/auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(authService.COOKIE_NAME)?.value;
  const requestingUser = token ? authService.verifySessionToken(token) : null;

  if (
    !requestingUser ||
    (requestingUser.role !== 'GLOBAL_ADMIN' && requestingUser.username !== 'superadmin')
  ) {
    return NextResponse.json({ status: 'error', error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { username, password, fullName, role, orgId, orgName } = body;

    if (!username || !password) {
      return NextResponse.json(
        { status: 'error', error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const user = authService.createUser({
      username,
      password,
      fullName: fullName ?? username,
      role: role as UserRole,
      orgId,
      orgName,
    });

    return NextResponse.json({
      status: 'ok',
      user: {
        username: user.username,
        role: user.role,
        orgId: user.orgId,
        orgName: user.orgName,
      },
    });
  } catch {
    return NextResponse.json(
      { status: 'error', error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
