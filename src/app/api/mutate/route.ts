import { NextRequest, NextResponse } from 'next/server';
import { orgStore } from '../../../lib/store';
import { authService, canUserManageOrg } from '../../../lib/auth';
import { User } from '../../../types';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(authService.COOKIE_NAME)?.value;
    let sessionUser = token ? authService.verifySessionToken(token) : null;

    const body = await req.json();
    const { action, orgId, user: bodyUser, payload, version } = body as {
      action: 'lock' | 'unlock' | 'update_content' | 'reparent' | 'create_org' | 'import_csv';
      orgId?: string;
      user?: User;
      payload?: any;
      version?: number;
    };

    // Если нет куки, но передан bodyUser (для совместимости)
    const effectiveUser = sessionUser || (bodyUser ? {
      userId: bodyUser.id,
      username: bodyUser.id,
      fullName: bodyUser.name,
      role: bodyUser.role === 'superadmin' ? ('GLOBAL_ADMIN' as const) : ('VIEWER' as const),
      orgId: null,
      expiresAt: Date.now() + 3600000,
    } : null);

    if (!effectiveUser) {
      return NextResponse.json(
        { error: 'Требуется авторизация в системе' },
        { status: 401 }
      );
    }

    const allOrgs = orgStore.getAll();

    // Проверка прав юрисдикции
    if (action === 'lock' || action === 'unlock' || action === 'update_content' || action === 'reparent') {
      const access = canUserManageOrg(effectiveUser, orgId, allOrgs);
      if (!access.allowed) {
        return NextResponse.json(
          { error: access.reason || 'Действие запрещено: организация вне вашей юрисдикции' },
          { status: 403 }
        );
      }
    } else if (action === 'create_org') {
      const parentId = payload?.parentId;
      const access = canUserManageOrg(effectiveUser, parentId, allOrgs);
      if (!access.allowed) {
        return NextResponse.json(
          { error: access.reason || 'Запрещено создавать дочернюю структуру в чужом ведомстве' },
          { status: 403 }
        );
      }
    } else if (action === 'import_csv') {
      if (effectiveUser.role === 'VIEWER') {
        return NextResponse.json(
          { error: 'Импорт данных недоступен для режима просмотра' },
          { status: 403 }
        );
      }
    }

    const userForStore: User = {
      id: effectiveUser.userId,
      name: effectiveUser.fullName,
      role: effectiveUser.role === 'GLOBAL_ADMIN' || effectiveUser.role === 'ORG_ADMIN' ? 'superadmin' : 'viewer',
    };

    if (action === 'lock' && orgId) {
      const result = orgStore.acquireLock(orgId, userForStore);
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 423 }); // 423 Locked
      }
      return NextResponse.json({ success: true, org: orgStore.getById(orgId) });
    }

    if (action === 'unlock' && orgId) {
      orgStore.releaseLock(orgId, userForStore.id);
      return NextResponse.json({ success: true, org: orgStore.getById(orgId) });
    }

    if (action === 'update_content' && orgId) {
      const result = orgStore.updateContent(
        orgId,
        {
          name: payload.name,
          fullName: payload.fullName,
          scope: payload.scope,
          theme: payload.theme,
          locationAddress: payload.locationAddress,
          jurisdiction: payload.jurisdiction,
          legalBasis: payload.legalBasis,
          questions: payload.questions,
        },
        version ?? 1,
        userForStore
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 409 }); // 409 Conflict
      }
      return NextResponse.json({ success: true, org: result.org });
    }

    if (action === 'reparent' && orgId) {
      const result = orgStore.reparent(orgId, payload.newParentId, version ?? 1, userForStore);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, org: result.org });
    }

    if (action === 'create_org') {
      const result = orgStore.createOrg(payload, userForStore);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, org: result.org });
    }

    if (action === 'import_csv') {
      const result = orgStore.bulkImport(payload.items, userForStore);
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
