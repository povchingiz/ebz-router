import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogsForOrg } from '../../../lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get('orgId') || searchParams.get('id');

  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  try {
    const logs = await getAuditLogsForOrg(orgId);
    return NextResponse.json({ status: 'ok', data: logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
