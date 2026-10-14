import { NextRequest, NextResponse } from 'next/server';
import { orgStore } from '@/lib/store';
import { authService } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(authService.COOKIE_NAME)?.value;
    const user = token ? authService.verifySessionToken(token) : null;

    // Сводный дашборд доступен администраторам
    if (user && user.role === 'VIEWER') {
      return NextResponse.json({ error: 'Доступ ограничен для роли Наблюдатель' }, { status: 403 });
    }

    const allOrgs = orgStore.getAll();
    const total = allOrgs.length;

    let verified = 0;
    let inProgress = 0;
    let unfilled = 0;
    let hiddenOnline = 0;
    let withAntiCompetencies = 0;
    let withPhones = 0;
    let withKazakhName = 0;
    let totalScore = 0;

    for (const org of allOrgs) {
      const score = org.completenessScore ?? 40;
      totalScore += score;

      if (org.status === 'verified' || score >= 90) {
        verified++;
      } else if (org.status === 'in_progress' || score >= 50) {
        inProgress++;
      } else {
        unfilled++;
      }

      if (org.showOnFrontend === false) hiddenOnline++;
      if (org.competenciesExcluded && org.competenciesExcluded.trim().length > 0) withAntiCompetencies++;
      if (org.contacts?.phoneChancellery || org.contacts?.phoneHotline) withPhones++;
      if (org.orgNameKk && org.orgNameKk.trim().length > 0) withKazakhName++;
    }

    const avgScore = total > 0 ? Math.round(totalScore / total) : 0;

    // Статистика по министерствам и ключевым ведомствам (прямые потомки АПр)
    const ministries = allOrgs
      .filter((o) => o.parentId === 'apr')
      .map((ministry) => {
        const minPath = ministry.path || '';
        const branches = allOrgs.filter(
          (b) => b.id === ministry.id || (minPath && b.path?.startsWith(minPath + '.'))
        );

        const bTotal = branches.length;
        let bVerified = 0;
        let bInProgress = 0;
        let bUnfilled = 0;
        let bScoreSum = 0;

        for (const b of branches) {
          const sc = b.completenessScore ?? 40;
          bScoreSum += sc;
          if (b.status === 'verified' || sc >= 90) bVerified++;
          else if (b.status === 'in_progress' || sc >= 50) bInProgress++;
          else bUnfilled++;
        }

        const bAvgScore = bTotal > 0 ? Math.round(bScoreSum / bTotal) : 0;
        const readyPercent =
          bTotal > 0 ? Math.round(((bVerified * 1.0 + bInProgress * 0.5) / bTotal) * 100) : 0;

        return {
          orgId: ministry.id,
          shortName: ministry.name,
          fullName: ministry.fullName,
          total: bTotal,
          verified: bVerified,
          inProgress: bInProgress,
          unfilled: bUnfilled,
          avgScore: bAvgScore,
          readyPercent,
        };
      })
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      summary: {
        total,
        verified,
        inProgress,
        unfilled,
        humanTouched: verified + inProgress,
        hiddenOnline,
        withAntiCompetencies,
        withPhones,
        withKazakhName,
        avgScore,
      },
      ministries,
    });
  } catch (error: any) {
    console.error('Readiness analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
