import { NextResponse } from 'next/server';
import { orgStore } from '../../../lib/store';

export async function GET() {
  const orgs = orgStore.getAll();
  return NextResponse.json({
    status: 'ok',
    data: orgs,
    meta: {
      count: orgs.length,
      cachedAt: new Date().toISOString(),
    },
  });
}
