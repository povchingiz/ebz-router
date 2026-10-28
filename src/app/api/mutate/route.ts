import { NextRequest, NextResponse } from 'next/server';
import { orgStore } from '../../../lib/store';
import { updateOrgContentInDb, reparentOrgInDb } from '../../../lib/db';
import { authService, canUserManageOrg } from '../../../lib/auth';
import { User } from '../../../types';

const ROLE_FOR_STORE: Record<string, User['role']> = {
  GLOBAL_ADMIN: 'superadmin',
  ORG_ADMIN: 'methodologist',
  VIEWER: 'viewer',
};

const HTML_ESCAPES: Record<string, string> = { '<': '&lt;', '>': '&gt;' };

/**
 * Рекурсивно экранирует угловые скобки во всех строках (идемпотентно: '&' не трогаем,
 * чтобы повторное сохранение уже экранированного текста не удваивало сущности).
 */
function sanitize<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(/[<>]/g, (c) => HTML_ESCAPES[c]) as unknown as T;
  }
  if (Array.isArray(value)) return value.map(sanitize) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitize(v);
    return out as T;
  }
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(authService.COOKIE_NAME)?.value;
    const sessionUser = token ? authService.verifySessionToken(token) : null;

    const body = await req.json();
    const { action, orgId, payload: rawPayload, version } = body as {
      action: 'lock' | 'unlock' | 'update_content' | 'reparent' | 'create_org' | 'import_csv' | 'convert_dept_to_org' | 'convert_org_to_dept';
      orgId?: string;
      payload?: any;
      version?: number;
    };

    const payload = sanitize(rawPayload);

    // Единственный источник идентичности — подписанная HttpOnly-кука сессии
    const effectiveUser = sessionUser;

    if (!effectiveUser) {
      return NextResponse.json(
        { error: 'Требуется авторизация в системе' },
        { status: 401 }
      );
    }

    // Структурные операции — только республиканский администратор
    const SUPERADMIN_ONLY = ['reparent', 'create_org', 'import_csv', 'convert_dept_to_org', 'convert_org_to_dept'];
    if (SUPERADMIN_ONLY.includes(action) && effectiveUser.role !== 'GLOBAL_ADMIN') {
      return NextResponse.json(
        { error: 'Изменение структуры (подчиненность, создание, конвертация, импорт) доступно только Супер-администратору' },
        { status: 403 }
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
      role: ROLE_FOR_STORE[effectiveUser.role] ?? 'viewer',
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
      // Строгое ограничение: изменять видимость/отображение карточки (showOnFrontend) разрешено ТОЛЬКО Суперюзеру (GLOBAL_ADMIN)
      const isSuperUser = effectiveUser.role === 'GLOBAL_ADMIN';
      const safeShowOnFrontend = isSuperUser ? payload.showOnFrontend : undefined;

      // 1. Попытка записи в PostgreSQL
      let dbResult: any = null;
      try {
        dbResult = await updateOrgContentInDb(
          orgId,
          {
            name: payload.name,
            fullName: payload.fullName,
            orgNameKk: payload.orgNameKk,
            shortNameKk: payload.shortNameKk,
            scope: payload.scope,
            theme: payload.theme,
            locationAddress: payload.locationAddress,
            jurisdiction: payload.jurisdiction,
            legalBasis: payload.legalBasis,
            questions: payload.questions,
            competenciesExcluded: payload.competenciesExcluded,
            forwardToGuidance: payload.forwardToGuidance,
            contacts: payload.contacts,
            showOnFrontend: safeShowOnFrontend,
          } as any,
          version ?? 1,
          userForStore
        );
      } catch (e: any) {
        console.warn('DB update failed, using memory store fallback:', e.message);
      }

      // 2. Синхронизируем локальный store
      const result = orgStore.updateContent(
        orgId,
        {
          name: payload.name,
          fullName: payload.fullName,
          orgNameKk: payload.orgNameKk,
          shortNameKk: payload.shortNameKk,
          scope: payload.scope,
          theme: payload.theme,
          locationAddress: payload.locationAddress,
          jurisdiction: payload.jurisdiction,
          legalBasis: payload.legalBasis,
          competenciesExcluded: payload.competenciesExcluded,
          forwardToGuidance: payload.forwardToGuidance,
          showOnFrontend: safeShowOnFrontend,
          contacts: payload.contacts,
          questions: payload.questions,
          departments: payload.departments,
          status: payload.status,
          katoCode: payload.katoCode,
          katoNameRu: payload.katoNameRu,
          locationId: payload.locationId,
          hasHumanTouch: payload.hasHumanTouch,
          llmNotes: payload.llmNotes,
        },
        version ?? 1,
        userForStore
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 409 }); // 409 Conflict
      }
      return NextResponse.json({ success: true, org: result.org || dbResult?.org, version: (result.org || dbResult?.org)?.version });
    }

    if (action === 'convert_dept_to_org') {
      const access = canUserManageOrg(effectiveUser, payload?.parentOrgId, allOrgs);
      if (!access.allowed) return NextResponse.json({ error: access.reason || 'Действие запрещено' }, { status: 403 });
      const result = orgStore.convertDeptToOrg(payload.parentOrgId, payload.deptId, userForStore);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    if (action === 'convert_org_to_dept') {
      const child = orgStore.getById(payload?.orgId);
      const parentId = payload?.targetParentId || child?.parentId;
      const access = canUserManageOrg(effectiveUser, parentId, allOrgs);
      if (!access.allowed) return NextResponse.json({ error: access.reason || 'Действие запрещено' }, { status: 403 });
      const result = orgStore.convertOrgToDept(payload.orgId, payload.targetParentId, userForStore);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (action === 'reparent' && orgId) {
      // 1. Попытка смены родителя в PostgreSQL
      let dbResult: any = null;
      try {
        dbResult = await reparentOrgInDb(orgId, payload.newParentId, version ?? 1, userForStore);
      } catch (e: any) {
        console.warn('DB reparent failed, using memory store fallback:', e.message);
      }

      // 2. Синхронизируем локальный store
      const result = orgStore.reparent(orgId, payload.newParentId, version ?? 1, userForStore);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, org: result.org || dbResult?.org });
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
