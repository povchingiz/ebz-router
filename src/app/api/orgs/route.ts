import { NextRequest, NextResponse } from 'next/server';
import { orgStore } from '../../../lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q') || searchParams.get('search') || undefined;
  const parentId = searchParams.get('parent_id') || undefined;
  const id = searchParams.get('id') || undefined;
  const rootOnly = searchParams.get('root_only') === 'true';

  try {
    // 1. Если запрошен конкретный орган по ID / slug
    if (id) {
      const org = orgStore.getById(id);
      if (org) {
        return NextResponse.json({ status: 'ok', data: org });
      }
      return NextResponse.json({ status: 'not_found', message: 'Организация не найдена' }, { status: 404 });
    }

    // 2. Базовая выборка чистой проверенной иерархии (до 27k)
    let orgs = orgStore.getAll();

    // Фильтрация по поисковой строке
    if (search && search.trim()) {
      const query = search.trim().toLowerCase();
      orgs = orgs.filter((o) => {
        const inName = o.name?.toLowerCase().includes(query);
        const inFullName = o.fullName?.toLowerCase().includes(query);
        const inAliases = Array.isArray(o.aliases) && o.aliases.some((a) => a.toLowerCase().includes(query));
        const inScope = o.scope?.toLowerCase().includes(query);
        return inName || inFullName || inAliases || inScope;
      });
      return NextResponse.json({
        status: 'ok',
        source: 'verified_hierarchy',
        data: orgs.slice(0, 50),
        meta: {
          count: orgs.length,
          cachedAt: new Date().toISOString(),
        },
      });
    }

    // Фильтрация по родителю
    if (parentId !== undefined && parentId !== null) {
      orgs = orgs.filter((o) => o.parentId === parentId);
      return NextResponse.json({
        status: 'ok',
        source: 'verified_hierarchy',
        data: orgs,
        meta: {
          count: orgs.length,
          cachedAt: new Date().toISOString(),
        },
      });
    }

    // Фильтрация только корневого эшелона
    if (rootOnly) {
      orgs = orgs.filter((o) => !o.parentId || o.parentId === 'ap' || o.id === 'ap');
      return NextResponse.json({
        status: 'ok',
        source: 'verified_hierarchy',
        data: orgs,
        meta: {
          count: orgs.length,
          cachedAt: new Date().toISOString(),
        },
      });
    }

    // По умолчанию: вся чистая иерархия (все министерства под АПр, центральные агентства под АП)
    return NextResponse.json({
      status: 'ok',
      source: 'verified_hierarchy',
      data: orgs,
      meta: {
        count: orgs.length,
        cachedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('API /api/orgs error:', err.message);
    const fallbackOrgs = orgStore.getAll();
    return NextResponse.json({
      status: 'ok',
      source: 'fallback',
      data: fallbackOrgs,
      meta: {
        count: fallbackOrgs.length,
        cachedAt: new Date().toISOString(),
      },
    });
  }
}
