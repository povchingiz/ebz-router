import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { authService } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(authService.COOKIE_NAME)?.value;
    const user = token ? authService.verifySessionToken(token) : null;

    // Сводный дашборд доступен администраторам
    // (GLOBAL_ADMIN или ORG_ADMIN)
    if (user && user.role === 'VIEWER') {
      return NextResponse.json({ error: 'Доступ ограничен для роли Наблюдатель' }, { status: 403 });
    }

    // 1. Общая статистика по республике
    const totalStatsRes = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ks.status = 'verified') as verified,
        COUNT(*) FILTER (WHERE ks.status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE ks.status = 'unfilled' OR ks.status IS NULL) as unfilled,
        COUNT(*) FILTER (WHERE ks.has_human_touch = TRUE) as human_touched,
        COUNT(*) FILTER (WHERE m.show_on_frontend = FALSE) as hidden_online,
        COUNT(*) FILTER (WHERE ex.competencies_excluded IS NOT NULL AND length(trim(ex.competencies_excluded)) > 0) as with_anti_competencies,
        COUNT(*) FILTER (WHERE ex.phone_chancellery IS NOT NULL OR ex.phone_hotline IS NOT NULL) as with_phones,
        COUNT(*) FILTER (WHERE m.org_name_kk IS NOT NULL AND length(trim(m.org_name_kk)) > 0) as with_kazakh_name,
        ROUND(AVG(COALESCE(ks.completeness_score, 15))) as avg_score
      FROM platform.gov_organizations_master m
      LEFT JOIN knowledge.org_readiness_status ks ON m.org_id = ks.org_id
      LEFT JOIN knowledge.org_details_extra ex ON m.org_id = ex.org_id
      WHERE m.deleted = FALSE
    `);

    // 2. Статистика по министерствам и ключевым ведомствам
    const ministriesRes = await pool.query(`
      SELECT 
        p.org_id,
        p.short_name_ru,
        p.org_name_ru,
        p.path,
        COUNT(c.org_id) as branch_total,
        COUNT(c.org_id) FILTER (WHERE ks.status = 'verified') as branch_verified,
        COUNT(c.org_id) FILTER (WHERE ks.status = 'in_progress') as branch_in_progress,
        COUNT(c.org_id) FILTER (WHERE ks.status = 'unfilled' OR ks.status IS NULL) as branch_unfilled,
        ROUND(AVG(COALESCE(ks.completeness_score, 15))) as branch_avg_score
      FROM platform.gov_organizations_master p
      JOIN platform.gov_organizations_master c ON c.path LIKE (p.path || '%')
      LEFT JOIN knowledge.org_readiness_status ks ON c.org_id = ks.org_id
      WHERE p.parent_id = 30400 AND p.deleted = FALSE
      GROUP BY p.org_id, p.short_name_ru, p.org_name_ru, p.path
      ORDER BY branch_total DESC
    `);

    return NextResponse.json({
      summary: {
        total: parseInt(totalStatsRes.rows[0].total, 10),
        verified: parseInt(totalStatsRes.rows[0].verified, 10),
        inProgress: parseInt(totalStatsRes.rows[0].in_progress, 10),
        unfilled: parseInt(totalStatsRes.rows[0].unfilled, 10),
        humanTouched: parseInt(totalStatsRes.rows[0].human_touched, 10),
        hiddenOnline: parseInt(totalStatsRes.rows[0].hidden_online, 10),
        withAntiCompetencies: parseInt(totalStatsRes.rows[0].with_anti_competencies, 10),
        withPhones: parseInt(totalStatsRes.rows[0].with_phones, 10),
        withKazakhName: parseInt(totalStatsRes.rows[0].with_kazakh_name, 10),
        avgScore: parseInt(totalStatsRes.rows[0].avg_score, 10),
      },
      ministries: ministriesRes.rows.map((row) => {
        const total = parseInt(row.branch_total, 10);
        const verified = parseInt(row.branch_verified, 10);
        const inProgress = parseInt(row.branch_in_progress, 10);
        const unfilled = parseInt(row.branch_unfilled, 10);
        const avgScore = parseInt(row.branch_avg_score, 10);
        const readyPercent = total > 0 ? Math.round(((verified * 1.0 + inProgress * 0.5) / total) * 100) : 0;

        return {
          orgId: row.org_id,
          shortName: row.short_name_ru,
          fullName: row.org_name_ru,
          total,
          verified,
          inProgress,
          unfilled,
          avgScore,
          readyPercent,
        };
      }),
    });
  } catch (error: any) {
    console.error('Readiness analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
