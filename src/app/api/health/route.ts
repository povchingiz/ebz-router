import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'disconnected';
  let totalOrgs = 0;
  let latencyMs = 0;

  try {
    const res = await db.query('SELECT count(*) FROM platform.gov_organizations_master');
    totalOrgs = parseInt(res.rows[0]?.count || '0', 10);
    latencyMs = Date.now() - startTime;
    dbStatus = totalOrgs > 0 ? 'healthy' : 'empty';
  } catch (err: any) {
    dbStatus = 'error: ' + (err.message || 'unknown');
    latencyMs = Date.now() - startTime;
  }

  const isHealthy = dbStatus === 'healthy';

  return NextResponse.json(
    {
      status: isHealthy ? 'pass' : 'warn',
      timestamp: new Date().toISOString(),
      service: 'eotinish-ebz-router',
      environment: process.env.NODE_ENV || 'production',
      database: {
        status: dbStatus,
        totalOrganizations: totalOrgs,
        latencyMs,
      },
      airgap: {
        mode: 'standalone',
        externalCallAllowed: false,
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
