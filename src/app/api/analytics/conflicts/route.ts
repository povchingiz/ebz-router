import { NextRequest, NextResponse } from 'next/server';
import { pool, T_ORG_EXTRA } from '@/lib/db';
import { authService } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface ConflictTopic {
  id: string;
  title: string;
  category: string;
  description: string;
  riskScenario: string;
  parties: {
    orgId: number;
    name: string;
    expectedRole: string;
    oppositeRole: string;
  }[];
}

const CONFLICT_TOPICS: ConflictTopic[] = [
  {
    id: 'fuel-tariffs',
    title: 'Цены на ГСМ, оптовые поставки и антимонопольные тарифы',
    category: 'Энергетика и конкуренция',
    description: 'Разграничение полномочий по регулированию цен на бензин, дизель и коммунальные тарифы.',
    riskScenario: 'Граждане подают жалобы на спекуляцию и рост цен на АЗС в Минэнерго вместо АЗРК, либо на тарифы ТЭЦ в АЗРК вместо КРЕМ МНЭ.',
    parties: [
      { orgId: 17862, name: 'Минэнерго РК', expectedRole: 'Добыча, переработка, баланс производства и график поставок нефти', oppositeRole: 'Не расследует ценовой сговор на розничных АЗС' },
      { orgId: 78, name: 'МИИЦР / АЗРК', expectedRole: 'Антимонопольное расследование сговоров и спекуляций', oppositeRole: 'Не регулирует физическую добычу и технический регламент нефтебаз' },
    ],
  },
  {
    id: 'water-floods',
    title: 'Водные объекты, паводковые дамбы и охрана природы',
    category: 'Природные ресурсы',
    description: 'Разграничение между распределением поливной воды, безопасностью гидротехнических сооружений и экологическим надзором.',
    riskScenario: 'Жалобы на прорыв дамб или незаконный забор воды направляются в Минэкологии вместо Минводных ресурсов или МЧС.',
    parties: [
      { orgId: 78, name: 'Минэкологии РК', expectedRole: 'Экологический контроль, сбросы загрязняющих веществ, биоресурсы', oppositeRole: 'Не отвечает за эксплуатацию и ремонт магистральных каналов' },
      { orgId: 17862, name: 'Минводных ресурсов РК', expectedRole: 'Управление водным фондом, гидроузлы, ирригация и водопользование', oppositeRole: 'Не осуществляет штрафные санкции за общее загрязнение окружающей среды' },
    ],
  },
  {
    id: 'consumer-ecommerce',
    title: 'Защита прав потребителей и электронная коммерция / маркетплейсы',
    category: 'Торговля и IT',
    description: 'Разграничение споров о возврате бракованного товара, финансовых пирамидах и IT-платформах.',
    riskScenario: 'Потребители при задержке товара на маркетплейсах пишут заявления в МЦРИАП или МВД вместо Комитета защиты прав потребителей.',
    parties: [
      { orgId: 17860, name: 'МВД РК', expectedRole: 'Уголовные преступления, интернет-мошенничество, хищение средств', oppositeRole: 'Не решает гражданско-правовые споры о возврате исправного/бракованного товара' },
      { orgId: 78, name: 'МТИ (Комитет защиты прав потребителей)', expectedRole: 'Защита прав покупателей, возврат денег, экспертиза качества товаров', oppositeRole: 'Не возбуждает уголовные дела по интернет-мошенникам' },
    ],
  },
  {
    id: 'roads-traffic',
    title: 'Содержание автодорог и организация дорожного движения',
    category: 'Транспорт и безопасность',
    description: 'Разграничение между ремонтом дорожного полотна республиканских трасс, городских улиц и установкой дорожных знаков.',
    riskScenario: 'Жалобы на ямы на дорогах поступают в дорожную полицию МВД вместо акиматов или Минтранса.',
    parties: [
      { orgId: 17860, name: 'МВД РК (КАП)', expectedRole: 'Надзор за соблюдением ПДД, схемы разметки и установка светофоров', oppositeRole: 'Не ремонтирует асфальтовое покрытие и не финансирует укладку дорог' },
      { orgId: 10199, name: 'Акимат г. Астаны (Управление транспорта)', expectedRole: 'Ремонт дорог, ямочный ремонт, маршруты автобусов, коммунальная техника', oppositeRole: 'Не налагает штрафы по нарушениям правил движения' },
    ],
  },
];

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(authService.COOKIE_NAME)?.value;
    const user = token ? authService.verifySessionToken(token) : null;

    // Детектор коллизий строго конфиденциален: доступен исключительно главному супер-администратору
    const isSuperAdmin = user?.role === 'GLOBAL_ADMIN' || user?.username === 'superadmin';
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Детектор коллизий доступен только главному администратору платформы' },
        { status: 403 }
      );
    }

    // Извлекаем актуальные данные по организациям из БД
    const orgIds = Array.from(new Set(CONFLICT_TOPICS.flatMap((t) => t.parties.map((p) => p.orgId))));
    const { rows } = await pool.query(
      `
      SELECT 
        m.org_id,
        m.short_name_ru,
        m.org_name_ru,
        m.scope,
        ex.competencies_excluded,
        ex.forward_to_guidance
      FROM platform.gov_organizations_master m
      LEFT JOIN ${T_ORG_EXTRA} ex ON m.org_id = ex.org_id
      WHERE m.org_id = ANY($1)
      `,
      [orgIds]
    );

    const orgsMap = new Map<number, any>();
    rows.forEach((r) => orgsMap.set(r.org_id, r));

    // Анализ каждого конфликта
    const results = CONFLICT_TOPICS.map((topic) => {
      let resolvedCount = 0;
      const analyzedParties = topic.parties.map((party) => {
        const dbData = orgsMap.get(party.orgId);
        const hasAntiComp = Boolean(
          dbData?.competencies_excluded && dbData.competencies_excluded.trim().length > 10
        );
        const hasForwarding = Boolean(
          dbData?.forward_to_guidance && dbData.forward_to_guidance.trim().length > 5
        );

        if (hasAntiComp && hasForwarding) {
          resolvedCount++;
        }

        return {
          ...party,
          orgNameRu: dbData?.org_name_ru || party.name,
          competenciesExcluded: dbData?.competencies_excluded || '',
          forwardToGuidance: dbData?.forward_to_guidance || '',
          hasRulesConfigured: hasAntiComp && hasForwarding,
        };
      });

      let status: 'resolved' | 'partial' | 'unresolved' = 'unresolved';
      if (resolvedCount === topic.parties.length) {
        status = 'resolved';
      } else if (resolvedCount > 0) {
        status = 'partial';
      }

      return {
        ...topic,
        parties: analyzedParties,
        status,
        score: Math.round((resolvedCount / topic.parties.length) * 100),
      };
    });

    return NextResponse.json({
      conflicts: results,
      totalConflicts: results.length,
      unresolvedCount: results.filter((c) => c.status === 'unresolved').length,
      partialCount: results.filter((c) => c.status === 'partial').length,
      resolvedCount: results.filter((c) => c.status === 'resolved').length,
    });
  } catch (error: any) {
    console.error('Conflicts analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
