import { NextRequest, NextResponse } from 'next/server';
import { orgStore } from '../../../lib/store';
import { getOrgsFromDb, getOrgByIdFromDb } from '../../../lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q') || searchParams.get('search') || undefined;
  const parentId = searchParams.get('parent_id') || undefined;
  const id = searchParams.get('id') || undefined;
  const rootOnly = searchParams.get('root_only') === 'true';

  try {
    // 1. Если запрошен конкретный орган
    if (id) {
      const dbOrg = await getOrgByIdFromDb(id);
      if (dbOrg) {
        return NextResponse.json({ status: 'ok', data: dbOrg });
      }
      const memOrg = orgStore.getById(id);
      return NextResponse.json({ status: memOrg ? 'ok' : 'not_found', data: memOrg });
    }

    // 2. Выборка из PostgreSQL
    const dbOrgs = await getOrgsFromDb({
      search,
      parentId,
      rootOnly,
      limit: search ? 50 : (parentId ? 100 : 500),
    });

    if (dbOrgs && dbOrgs.length > 0) {
      return NextResponse.json({
        status: 'ok',
        source: 'database',
        data: dbOrgs,
        meta: {
          count: dbOrgs.length,
          cachedAt: new Date().toISOString(),
        },
      });
    }

    // 3. Fallback на память
    const memOrgs = orgStore.getAll();
    return NextResponse.json({
      status: 'ok',
      source: 'memory_fallback',
      data: memOrgs,
      meta: {
        count: memOrgs.length,
        cachedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('API /api/orgs fallback to store:', err.message);
    const memOrgs = orgStore.getAll();
    return NextResponse.json({
      status: 'ok',
      source: 'memory_fallback',
      data: memOrgs,
      meta: {
        count: memOrgs.length,
        cachedAt: new Date().toISOString(),
      },
    });
  }
}
