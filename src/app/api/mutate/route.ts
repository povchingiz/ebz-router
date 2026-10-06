import { NextResponse } from 'next/server';
import { orgStore } from '../../../lib/store';
import { User } from '../../../types';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, orgId, user, payload, version } = body as {
      action: 'lock' | 'unlock' | 'update_content' | 'reparent' | 'import_csv';
      orgId?: string;
      user: User;
      payload?: any;
      version?: number;
    };

    if (!user || !user.role) {
      return NextResponse.json({ error: 'Пользователь не авторизован' }, { status: 401 });
    }

    if (action === 'lock' && orgId) {
      const result = orgStore.acquireLock(orgId, user);
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 423 }); // 423 Locked
      }
      return NextResponse.json({ success: true, org: orgStore.getById(orgId) });
    }

    if (action === 'unlock' && orgId) {
      orgStore.releaseLock(orgId, user.id);
      return NextResponse.json({ success: true, org: orgStore.getById(orgId) });
    }

    if (action === 'update_content' && orgId) {
      const result = orgStore.updateContent(
        orgId,
        { scope: payload.scope, questions: payload.questions },
        version ?? 1,
        user
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 409 }); // 409 Conflict
      }
      return NextResponse.json({ success: true, org: result.org });
    }

    if (action === 'reparent' && orgId) {
      const result = orgStore.reparent(orgId, payload.newParentId, version ?? 1, user);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, org: result.org });
    }

    if (action === 'import_csv') {
      const result = orgStore.bulkImport(payload.items, user);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, count: result.count });
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ошибка сервера' }, { status: 500 });
  }
}
