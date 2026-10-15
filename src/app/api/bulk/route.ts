import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { authService, canUserManageOrg } from '@/lib/auth';
import { GovOrg } from '@/types';

import * as XLSX from 'xlsx';

import { validateAndParseExcel } from '@/lib/excelSecurity';

export const dynamic = 'force-dynamic';

// Сопоставление понятных человеческих заголовков Excel с колонками PostgreSQL
const EXCEL_MAPPING = [
  { key: 'org_id', header: 'ID организации', required: true },
  { key: 'short_name_ru', header: 'Краткое наименование (RU)', required: true },
  { key: 'org_name_ru', header: 'Полное официальное наименование (RU)', required: true },
  { key: 'org_name_kk', header: 'Официальное наименование (KZ)', required: false },
  { key: 'org_type_ru', header: 'Тип ведомства', required: false },
  { key: 'location_name_ru', header: 'Локация / Населенный пункт', required: false },
  { key: 'scope', header: 'Полномочия (Что входит)', required: false },
  { key: 'competencies_excluded', header: 'Анти-компетенции (Что НЕ входит)', required: false },
  { key: 'forward_to_guidance', header: 'Куда перенаправлять ошибки', required: false },
  { key: 'phone_chancellery', header: 'Телефон канцелярии', required: false },
  { key: 'phone_hotline', header: 'Горячая линия (1414)', required: false },
  { key: 'email_official', header: 'Официальный Email', required: false },
  { key: 'website_url', header: 'Официальный сайт', required: false },
  { key: 'show_on_frontend', header: 'Отображать онлайн (Да/Нет)', required: false },
];

// Защита от CSV/Excel Formula Injection
function sanitizeFormulaInjection(value: any): string {
  if (value === null || value === undefined) return '';
  let str = String(value).trim();
  // Если ячейка начинается с опасных символов формул (=, +, -, @, |, %)
  if (/^[=+\-@|%]/.test(str)) {
    str = "'" + str; // Экранируем одинарной кавычкой для безопасности
  }
  return str;
}

// Удаление опасных символов при чтении
function cleanImportCell(value: any): string {
  if (value === null || value === undefined) return '';
  let str = String(value).trim();
  // Снимаем ведущую одинарную кавычку экранирования
  if (str.startsWith("'") && str.length > 1) {
    str = str.substring(1);
  }
  return str;
}

/**
 * GET /api/bulk?branch_id=...
 * Выгрузка шаблона / среза ведомства в настоящий формат Excel (.xlsx)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branch_id'); // e.g. '17862' (Минэнерго) или null (все)
    const limit = parseInt(searchParams.get('limit') || '500', 10);

    let query = `
      SELECT 
        m.org_id,
        m.short_name_ru,
        m.org_name_ru,
        m.org_name_kk,
        m.org_type_ru,
        m.location_name_ru,
        m.scope,
        m.show_on_frontend,
        ex.competencies_excluded,
        ex.forward_to_guidance,
        ex.phone_chancellery,
        ex.phone_hotline,
        ex.email_official,
        ex.website_url
      FROM platform.gov_organizations_master m
      LEFT JOIN knowledge.org_details_extra ex ON m.org_id = ex.org_id
      WHERE m.deleted = FALSE
    `;
    const params: any[] = [];

    if (branchId) {
      params.push(parseInt(branchId, 10));
      query += ` AND (m.org_id = $1 OR m.parent_id = $1)`;
    }

    query += ` ORDER BY m.org_id ASC LIMIT ${limit}`;

    const { rows } = await pool.query(query, params);

    // Формируем структурированные данные для листа Excel
    const excelRows = rows.map((row) => {
      const obj: Record<string, any> = {};
      for (const m of EXCEL_MAPPING) {
        let val = row[m.key];
        if (m.key === 'show_on_frontend') {
          val = val !== false ? 'Да' : 'Нет';
        }
        val = sanitizeFormulaInjection(val);
        obj[m.header] = val ?? '';
      }
      return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Оптимальная ширина колонок для комфортной работы в Excel
    worksheet['!cols'] = [
      { wch: 15 }, // ID организации
      { wch: 25 }, // Краткое наименование (RU)
      { wch: 45 }, // Полное официальное наименование (RU)
      { wch: 45 }, // Официальное наименование (KZ)
      { wch: 20 }, // Тип ведомства
      { wch: 25 }, // Локация
      { wch: 50 }, // Полномочия
      { wch: 50 }, // Анти-компетенции
      { wch: 30 }, // Куда перенаправлять
      { wch: 20 }, // Телефон канцелярии
      { wch: 20 }, // Горячая линия
      { wch: 25 }, // Email
      { wch: 30 }, // Сайт
      { wch: 25 }, // Отображать онлайн
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Реестр ведомств');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reestr_gosorganov_${branchId || 'rk'}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/bulk
 * Пакетная загрузка и валидация таблицы с проверкой прав, схемы и защитой от инъекций
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get(authService.COOKIE_NAME)?.value;
  const user = token ? authService.verifySessionToken(token) : null;

  if (!user || user.role === 'VIEWER') {
    return NextResponse.json(
      { error: 'У вас нет прав на пакетное обновление данных' },
      { status: 403 }
    );
  }

  try {
    let rows: any[] = [];
    let dryRun = false;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      dryRun = formData.get('dryRun') === 'true';

      if (!file) {
        return NextResponse.json({ error: 'Файл Excel не был прикреплен' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const secResult = validateAndParseExcel(buffer, file.name);

      if (!secResult.isValid || !secResult.rows) {
        return NextResponse.json(
          { error: secResult.error || 'Ошибка проверки безопасности Excel файла' },
          { status: 400 }
        );
      }
      rows = secResult.rows;
    } else {
      const body = await req.json();
      rows = body.rows || [];
      dryRun = Boolean(body.dryRun);
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Таблица не содержит данных' }, { status: 400 });
    }

    // Лимит пакета: защита от перегрузки памяти и DoS
    if (rows.length > 5000) {
      return NextResponse.json(
        { error: 'Превышен лимит пакета: максимум 5000 строк за одну загрузку' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const validationErrors: { row: number; org_id: any; error: string }[] = [];
      const successfulRows: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i];
        const rowNum = i + 2; // +1 для заголовка, +1 для 1-based index

        // 1. Поиск org_id
        const rawId = rawRow['ID организации'] || rawRow['org_id'] || rawRow['id'];
        const orgId = rawId ? parseInt(String(rawId).trim(), 10) : null;

        if (!orgId || isNaN(orgId)) {
          validationErrors.push({ row: rowNum, org_id: rawId, error: 'Отсутствует валидный ID организации' });
          continue;
        }

        // 2. Проверка существования и юрисдикции
        const existingOrgRes = await client.query(
          'SELECT org_id, path, short_name_ru, org_name_ru, show_on_frontend FROM platform.gov_organizations_master WHERE org_id = $1 AND deleted = FALSE',
          [orgId]
        );

        if (existingOrgRes.rows.length === 0) {
          validationErrors.push({ row: rowNum, org_id: orgId, error: 'Организация с таким ID не найдена в базе' });
          continue;
        }

        const existingOrg = existingOrgRes.rows[0];

        // 3. Проверка каскадных прав юрисдикции (Materialized Path)
        if (user.role === 'ORG_ADMIN' && user.orgId) {
          const userOrgRes = await client.query(
            'SELECT path FROM platform.gov_organizations_master WHERE org_id = $1 OR slug = $2 LIMIT 1',
            [/^\d+$/.test(user.orgId) ? parseInt(user.orgId, 10) : -1, user.orgId]
          );
          if (userOrgRes.rows.length > 0) {
            const userPath = userOrgRes.rows[0].path;
            if (!existingOrg.path.startsWith(userPath)) {
              validationErrors.push({
                row: rowNum,
                org_id: orgId,
                error: `Запрещено: организация вне юрисдикции вашего ведомства (${user.orgName})`,
              });
              continue;
            }
          }
        }

        // 4. Очистка и санитизация ячеек
        const shortNameRu = cleanImportCell(rawRow['Краткое наименование (RU)'] || rawRow['short_name_ru'] || existingOrg.short_name_ru);
        const orgNameRu = cleanImportCell(rawRow['Полное официальное наименование (RU)'] || rawRow['org_name_ru'] || existingOrg.org_name_ru);
        const orgNameKk = cleanImportCell(rawRow['Официальное наименование (KZ)'] || rawRow['org_name_kk'] || '');
        const orgTypeRu = cleanImportCell(rawRow['Тип ведомства'] || rawRow['org_type_ru'] || '');
        const locationNameRu = cleanImportCell(rawRow['Локация / Населенный пункт'] || rawRow['location_name_ru'] || '');
        const scope = cleanImportCell(rawRow['Полномочия (Что входит)'] || rawRow['scope'] || '');
        const competenciesExcluded = cleanImportCell(rawRow['Анти-компетенции (Что НЕ входит)'] || rawRow['competencies_excluded'] || '');
        const forwardToGuidance = cleanImportCell(rawRow['Куда перенаправлять ошибки'] || rawRow['forward_to_guidance'] || '');
        const phoneChancellery = cleanImportCell(rawRow['Телефон канцелярии'] || rawRow['phone_chancellery'] || '');
        const phoneHotline = cleanImportCell(rawRow['Горячая линия (1414)'] || rawRow['phone_hotline'] || '');
        const emailOfficial = cleanImportCell(rawRow['Официальный Email'] || rawRow['email_official'] || '');
        const websiteUrl = cleanImportCell(rawRow['Официальный сайт'] || rawRow['website_url'] || '');

        const showOnFrontendRaw = String(rawRow['Отображать онлайн (Да/Нет)'] || rawRow['show_on_frontend'] || '').toLowerCase();
        // Менять статус отображения организации онлайн разрешено строго Суперюзеру (GLOBAL_ADMIN)
        const isSuperAdmin = user.role === 'GLOBAL_ADMIN';
        const effectiveShowOnFrontend = isSuperAdmin
          ? (showOnFrontendRaw === 'нет' || showOnFrontendRaw === 'false' ? false : true)
          : (existingOrg.show_on_frontend !== false);

        if (!dryRun) {
          // Обновляем мастер-таблицу
          await client.query(
            `
            UPDATE platform.gov_organizations_master
            SET 
              short_name_ru = $1,
              org_name_ru = $2,
              org_name_kk = COALESCE(NULLIF($3, ''), org_name_kk),
              org_type_ru = COALESCE(NULLIF($4, ''), org_type_ru),
              location_name_ru = COALESCE(NULLIF($5, ''), location_name_ru),
              scope = COALESCE(NULLIF($6, ''), scope),
              show_on_frontend = $7,
              version = version + 1,
              updated_at = NOW()
            WHERE org_id = $8
            `,
            [shortNameRu, orgNameRu, orgNameKk, orgTypeRu, locationNameRu, scope, effectiveShowOnFrontend, orgId]
          );

          // Обновляем knowledge.org_readiness_status
          await client.query(
            `
            INSERT INTO knowledge.org_readiness_status (org_id, status, has_human_touch, completeness_score, last_touched_by, last_touched_at, updated_at)
            VALUES ($1, 'in_progress', TRUE, 70, $2, NOW(), NOW())
            ON CONFLICT (org_id) DO UPDATE
            SET status = 'in_progress', has_human_touch = TRUE, completeness_score = 70, last_touched_by = EXCLUDED.last_touched_by, last_touched_at = NOW(), updated_at = NOW()
            `,
            [orgId, `Пакетный импорт (${user.fullName})`]
          );

          // Обновляем knowledge.org_details_extra
          await client.query(
            `
            INSERT INTO knowledge.org_details_extra (org_id, competencies_excluded, forward_to_guidance, phone_chancellery, phone_hotline, email_official, website_url, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (org_id) DO UPDATE
            SET 
              competencies_excluded = COALESCE(NULLIF(EXCLUDED.competencies_excluded, ''), knowledge.org_details_extra.competencies_excluded),
              forward_to_guidance = COALESCE(NULLIF(EXCLUDED.forward_to_guidance, ''), knowledge.org_details_extra.forward_to_guidance),
              phone_chancellery = COALESCE(NULLIF(EXCLUDED.phone_chancellery, ''), knowledge.org_details_extra.phone_chancellery),
              phone_hotline = COALESCE(NULLIF(EXCLUDED.phone_hotline, ''), knowledge.org_details_extra.phone_hotline),
              email_official = COALESCE(NULLIF(EXCLUDED.email_official, ''), knowledge.org_details_extra.email_official),
              website_url = COALESCE(NULLIF(EXCLUDED.website_url, ''), knowledge.org_details_extra.website_url),
              updated_at = NOW()
            `,
            [orgId, competenciesExcluded, forwardToGuidance, phoneChancellery, phoneHotline, emailOfficial, websiteUrl]
          );

          // Фиксация в аудит-логе
          await client.query(
            `
            INSERT INTO platform.org_audit_log (org_id, action, user_id, user_name, user_role, diff_payload)
            VALUES ($1, 'bulk_excel_import', $2, $3, $4, $5::jsonb)
            `,
            [
              orgId,
              user.userId,
              user.fullName,
              user.role,
              JSON.stringify({
                action: 'bulk_excel_import',
                updated_fields: { shortNameRu, scope, competenciesExcluded, showOnFrontend: effectiveShowOnFrontend },
              }),
            ]
          );
        }

        successfulRows.push({
          org_id: orgId,
          name: shortNameRu,
          status: 'success',
        });
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: validationErrors.length === 0,
        totalRows: rows.length,
        processed: successfulRows.length,
        errorsCount: validationErrors.length,
        errors: validationErrors.slice(0, 50), // Возвращаем до 50 ошибок для отображения
        dryRun: Boolean(dryRun),
      });
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error('Transaction bulk error:', e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Bulk API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
