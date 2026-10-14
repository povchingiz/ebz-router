import { Pool } from 'pg';
import { GovOrg, OrgLevel, OrgQuestion, User } from '../types';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://eotinish_platform:BFhekbn2026@localhost:5432/eotinish_ai_demo';

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = pool;
export { pool };

function mapDbRowToGovOrg(row: any, questions: OrgQuestion[] = []): GovOrg {
  // Определяем уровень иерархии
  let level: OrgLevel = 'district';
  const orgType = (row.org_type_ru || '').toLowerCase();
  if (row.org_id === 77 || row.org_id === 30400 || orgType.includes('президента') || orgType.includes('министерство')) {
    level = 'central';
  } else if (orgType.includes('агентство') || orgType.includes('комитет') || orgType.includes('генеральная прокуратура')) {
    level = 'agency';
  } else if (orgType.includes('акимат области') || orgType.includes('город / область') || orgType.includes('управление')) {
    level = 'regional';
  }

  // ID для графа ReactFlow: если есть slug (например 'ap', 'miicr'), используем его, иначе строковый 'org-12345'
  const id = row.slug || `org-${row.org_id}`;
  const parentId = row.parent_slug || (row.parent_id ? `org-${row.parent_id}` : null);

  return {
    id,
    org_id: row.org_id,
    path: row.path,
    name: row.short_name_ru || (row.org_name_ru && row.org_name_ru.length <= 30 ? row.org_name_ru : `${row.org_name_ru?.substring(0, 28)}...`),
    fullName: row.org_name_ru || row.short_name_ru || '',
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    parentId: row.org_id === 77 ? null : parentId,
    level,
    orgType: row.org_type_ru || '',
    orgNameKk: row.org_name_kk || '',
    shortNameKk: row.short_name_kk || '',
    status: (row.knowledge_status as any) || (row.has_human_touch ? 'in_progress' : 'unfilled'),
    showOnFrontend: row.show_on_frontend !== false,
    hasHumanTouch: row.has_human_touch ?? false,
    completenessScore: row.completeness_score ?? (row.has_human_touch ? 65 : 15),
    competenciesExcluded: row.competencies_excluded || '',
    forwardToGuidance: row.forward_to_guidance || '',
    contacts: {
      phoneHotline: row.phone_hotline || (row.contacts?.hotline || ''),
      phoneChancellery: row.phone_chancellery || (row.contacts?.chancellery || ''),
      emailOfficial: row.email_official || (row.contacts?.email || ''),
      websiteUrl: row.website_url || (row.contacts?.website || ''),
      physicalAddress: row.physical_address || (row.location_name_ru || ''),
    },
    scope: row.scope || `Сфера ведения и компетенции ведомства: ${row.org_name_ru}`,
    theme: row.scope || '',
    locationAddress: row.location_name_ru || '',
    jurisdiction: (row.jurisdiction as any) || 'republican',
    legalBasis: row.legal_basis || '',
    questions,
    version: row.version || 1,
    lockedBy: row.locked_by_user
      ? {
          userId: row.locked_by_user,
          userName: row.locked_by_user,
          lockedAt: row.locked_at ? new Date(row.locked_at).toISOString() : new Date().toISOString(),
        }
      : null,
  };
}

/**
 * Получение списка организаций (с поддержкой Lazy Loading)
 */
export async function getOrgsFromDb(options?: {
  parentId?: number | string | null;
  search?: string;
  limit?: number;
  rootOnly?: boolean;
}): Promise<GovOrg[]> {
  try {
    let query = `
      SELECT 
        m.*,
        p.slug as parent_slug,
        ks.status as knowledge_status,
        ks.has_human_touch,
        ks.completeness_score,
        ex.competencies_excluded,
        ex.forward_to_guidance,
        ex.phone_hotline,
        ex.phone_chancellery,
        ex.email_official,
        ex.website_url,
        ex.physical_address
      FROM platform.gov_organizations_master m
      LEFT JOIN platform.gov_organizations_master p ON m.parent_id = p.org_id
      LEFT JOIN knowledge.org_readiness_status ks ON m.org_id = ks.org_id
      LEFT JOIN knowledge.org_details_extra ex ON m.org_id = ex.org_id
      WHERE m.deleted = FALSE
    `;
    const params: any[] = [];

    if (options?.search && options.search.trim()) {
      params.push(`%${options.search.trim()}%`);
      query += ` AND (m.org_name_ru ILIKE $${params.length} OR m.short_name_ru ILIKE $${params.length} OR m.slug ILIKE $${params.length} OR array_to_string(m.aliases, ' ') ILIKE $${params.length})`;
      query += ` ORDER BY 
        CASE 
          WHEN m.slug = 'gov' OR m.org_id = 30400 THEN 0
          WHEN m.short_name_ru ILIKE $${params.length} THEN 1
          WHEN m.slug IS NOT NULL THEN 2
          WHEN m.parent_id IN (77, 30400) THEN 3
          ELSE 4
        END,
        LENGTH(m.org_name_ru) ASC
        LIMIT ${options.limit || 50}`;
    } else if (options?.parentId !== undefined && options?.parentId !== null) {
      // Ищем по родительскому числовому ID или slug
      let parentNumericId: number | null = null;
      if (typeof options.parentId === 'number') {
        parentNumericId = options.parentId;
      } else if (options.parentId.startsWith('org-')) {
        parentNumericId = parseInt(options.parentId.replace('org-', ''), 10);
      } else {
        // Поиск по slug
        const parentRow = await pool.query(
          'SELECT org_id FROM platform.gov_organizations_master WHERE slug = $1 LIMIT 1',
          [options.parentId]
        );
        if (parentRow.rows.length > 0) {
          parentNumericId = parentRow.rows[0].org_id;
        }
      }

      if (parentNumericId) {
        params.push(parentNumericId);
        query += ` AND m.parent_id = $${params.length}`;
      } else {
        return [];
      }
      query += ` ORDER BY m.org_id ASC LIMIT ${options.limit || 100}`;
    } else if (options?.rootOnly) {
      // Только верхний эшелон: глубина <= 2
      query += ` AND (m.org_id = 77 OR m.parent_id = 77 OR m.parent_id = 30400 OR m.slug IS NOT NULL)`;
      query += ` ORDER BY m.org_id ASC LIMIT ${options.limit || 150}`;
    } else {
      // По умолчанию: верхние 500 органов с заполненными slug или верхнего уровня
      query += ` AND (m.slug IS NOT NULL OR m.parent_id IS NULL OR m.parent_id IN (77, 30400))`;
      query += ` ORDER BY m.org_id ASC LIMIT ${options?.limit || 600}`;
    }

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) return [];

    // Подтягиваем FAQ для найденных органов
    const orgIds = rows.map((r: any) => r.org_id);
    const faqResult = await pool.query(
      `SELECT * FROM platform.gov_organization_faq WHERE org_id = ANY($1::int[]) AND is_active = TRUE`,
      [orgIds]
    );

    const faqMap = new Map<number, OrgQuestion[]>();
    faqResult.rows.forEach((f: any) => {
      const q: OrgQuestion = {
        id: f.id,
        topic: f.question_ru || f.topic || '',
        description: f.answer_ru || f.description || '',
        keywords: Array.isArray(f.tags) ? f.tags : (Array.isArray(f.keywords) ? f.keywords : []),
        sampleResponse: f.answer_ru || '',
      };
      const arr = faqMap.get(f.org_id) || [];
      arr.push(q);
      faqMap.set(f.org_id, arr);
    });

    return rows.map((r: any) => mapDbRowToGovOrg(r, faqMap.get(r.org_id) || []));
  } catch (error) {
    console.error('Error fetching orgs from DB:', error);
    throw error;
  }
}

/**
 * Получение одного органа по ID (slug или numeric org_id)
 */
export async function getOrgByIdFromDb(id: string | number): Promise<GovOrg | null> {
  try {
    let numericId: number | null = null;
    let slug: string | null = null;

    if (typeof id === 'number') {
      numericId = id;
    } else if (id.startsWith('org-')) {
      numericId = parseInt(id.replace('org-', ''), 10);
    } else if (/^\d+$/.test(id)) {
      numericId = parseInt(id, 10);
    } else {
      slug = id;
    }

    const selectFields = `
      m.*,
      p.slug as parent_slug,
      ks.status as knowledge_status,
      ks.has_human_touch,
      ks.completeness_score,
      ex.competencies_excluded,
      ex.forward_to_guidance,
      ex.phone_hotline,
      ex.phone_chancellery,
      ex.email_official,
      ex.website_url,
      ex.physical_address
      FROM platform.gov_organizations_master m
      LEFT JOIN platform.gov_organizations_master p ON m.parent_id = p.org_id
      LEFT JOIN knowledge.org_readiness_status ks ON m.org_id = ks.org_id
      LEFT JOIN knowledge.org_details_extra ex ON m.org_id = ex.org_id
    `;
    const query = numericId
      ? `SELECT ${selectFields} WHERE m.org_id = $1`
      : `SELECT ${selectFields} WHERE m.slug = $1`;

    const { rows } = await pool.query(query, [numericId || slug]);
    if (rows.length === 0) return null;

    const row = rows[0];
    const faqResult = await pool.query(
      `SELECT * FROM platform.gov_organization_faq WHERE org_id = $1 AND is_active = TRUE`,
      [row.org_id]
    );

    const questions: OrgQuestion[] = faqResult.rows.map((f: any) => ({
      id: f.id,
      topic: f.question_ru || f.topic || '',
      description: f.answer_ru || f.description || '',
      keywords: Array.isArray(f.tags) ? f.tags : [],
      sampleResponse: f.answer_ru || '',
    }));

    return mapDbRowToGovOrg(row, questions);
  } catch (error) {
    console.error('Error fetching single org from DB:', error);
    return null;
  }
}

/**
 * Обновление содержания органа в БД с фиксацией в аудит-логе
 */
export async function updateOrgContentInDb(
  id: string,
  updates: {
    name?: string;
    fullName?: string;
    scope?: string;
    theme?: string;
    locationAddress?: string;
    jurisdiction?: string;
    legalBasis?: string;
    questions?: OrgQuestion[];
  },
  expectedVersion: number,
  user: User
): Promise<{ success: boolean; org?: GovOrg; error?: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Находим орган
    let numericId: number | null = null;
    if (id.startsWith('org-')) {
      numericId = parseInt(id.replace('org-', ''), 10);
    } else if (/^\d+$/.test(id)) {
      numericId = parseInt(id, 10);
    } else {
      const sRow = await client.query('SELECT org_id FROM platform.gov_organizations_master WHERE slug = $1', [id]);
      if (sRow.rows.length > 0) numericId = sRow.rows[0].org_id;
    }

    if (!numericId) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Организация не найдена в базе данных' };
    }

    const cur = await client.query('SELECT * FROM platform.gov_organizations_master WHERE org_id = $1 FOR UPDATE', [numericId]);
    if (cur.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Организация не найдена' };
    }

    const currentOrg = cur.rows[0];
    if (currentOrg.version !== expectedVersion) {
      await client.query('ROLLBACK');
      return {
        success: false,
        error: `Конфликт версий: карточка была обновлена другим оператором (версия в БД v${currentOrg.version}, вы отправили v${expectedVersion}). Обновите страницу.`,
      };
    }

    // 2. Подготовка апдейта
    const newName = updates.name !== undefined ? updates.name.trim() : currentOrg.short_name_ru;
    const newFullName = updates.fullName !== undefined ? updates.fullName.trim() : currentOrg.org_name_ru;
    const newScope = updates.scope !== undefined ? updates.scope : currentOrg.scope;
    const newLegalBasis = updates.legalBasis !== undefined ? updates.legalBasis : currentOrg.legal_basis;
    const newJurisdiction = updates.jurisdiction !== undefined ? updates.jurisdiction : currentOrg.jurisdiction;
    const newLocation = updates.locationAddress !== undefined ? updates.locationAddress : currentOrg.location_name_ru;
    const newShowOnFrontend = (updates as any).showOnFrontend !== undefined ? (updates as any).showOnFrontend : (currentOrg.show_on_frontend !== false);

    await client.query(
      `
      UPDATE platform.gov_organizations_master
      SET 
        short_name_ru = $1,
        org_name_ru = $2,
        scope = $3,
        legal_basis = $4,
        jurisdiction = $5,
        location_name_ru = $6,
        show_on_frontend = $7,
        version = version + 1,
        locked_by_user = NULL,
        locked_at = NULL,
        updated_at = now()
      WHERE org_id = $8
      `,
      [newName, newFullName, newScope, newLegalBasis, newJurisdiction, newLocation, newShowOnFrontend, numericId]
    );

    // 3. Обновление FAQ если переданы
    if (updates.questions) {
      await client.query('DELETE FROM platform.gov_organization_faq WHERE org_id = $1', [numericId]);
      for (const q of updates.questions) {
        await client.query(
          `INSERT INTO platform.gov_organization_faq (org_id, question_ru, answer_ru, tags) VALUES ($1, $2, $3, $4::jsonb)`,
          [numericId, q.topic, q.description || '', JSON.stringify(q.keywords || [])]
        );
      }
    }

    // 3.5 Обновление статуса в knowledge.org_readiness_status
    await client.query(
      `
      INSERT INTO knowledge.org_readiness_status (org_id, status, has_human_touch, completeness_score, last_touched_by, last_touched_at, updated_at)
      VALUES ($1, 'in_progress', TRUE, 75, $2, NOW(), NOW())
      ON CONFLICT (org_id) DO UPDATE
      SET status = 'in_progress', has_human_touch = TRUE, completeness_score = 75, last_touched_by = EXCLUDED.last_touched_by, last_touched_at = NOW(), updated_at = NOW()
      `,
      [numericId, user.name || user.id]
    );

    // 3.6 Обновление knowledge.org_details_extra если переданы
    if ((updates as any).competenciesExcluded !== undefined || (updates as any).contacts) {
      const u = updates as any;
      await client.query(
        `
        INSERT INTO knowledge.org_details_extra (org_id, competencies_excluded, forward_to_guidance, phone_hotline, phone_chancellery, email_official, website_url, physical_address, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (org_id) DO UPDATE
        SET 
          competencies_excluded = COALESCE(EXCLUDED.competencies_excluded, knowledge.org_details_extra.competencies_excluded),
          forward_to_guidance = COALESCE(EXCLUDED.forward_to_guidance, knowledge.org_details_extra.forward_to_guidance),
          phone_hotline = COALESCE(EXCLUDED.phone_hotline, knowledge.org_details_extra.phone_hotline),
          phone_chancellery = COALESCE(EXCLUDED.phone_chancellery, knowledge.org_details_extra.phone_chancellery),
          email_official = COALESCE(EXCLUDED.email_official, knowledge.org_details_extra.email_official),
          website_url = COALESCE(EXCLUDED.website_url, knowledge.org_details_extra.website_url),
          physical_address = COALESCE(EXCLUDED.physical_address, knowledge.org_details_extra.physical_address),
          updated_at = NOW()
        `,
        [
          numericId,
          u.competenciesExcluded || null,
          u.forwardToGuidance || null,
          u.contacts?.phoneHotline || null,
          u.contacts?.phoneChancellery || null,
          u.contacts?.emailOfficial || null,
          u.contacts?.websiteUrl || null,
          u.contacts?.physicalAddress || null,
        ]
      );
    }

    // 4. Фиксация в аудит-логе
    const diff = {
      action: 'update_content',
      old: {
        short_name_ru: currentOrg.short_name_ru,
        org_name_ru: currentOrg.org_name_ru,
        scope: currentOrg.scope,
        version: currentOrg.version,
      },
      new: {
        short_name_ru: newName,
        org_name_ru: newFullName,
        scope: newScope,
        version: currentOrg.version + 1,
      },
    };

    await client.query(
      `
      INSERT INTO platform.org_audit_log (org_id, action, user_id, user_name, user_role, diff_payload)
      VALUES ($1, 'update_content', $2, $3, $4, $5::jsonb)
      `,
      [numericId, user.id, user.name, user.role, JSON.stringify(diff)]
    );

    await client.query('COMMIT');

    const updated = await getOrgByIdFromDb(numericId);
    return { success: true, org: updated || undefined };
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error updating org content in DB:', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Смена родителя в БД с каскадным пересчетом path
 */
export async function reparentOrgInDb(
  id: string,
  newParentId: string | null,
  expectedVersion: number,
  user: User
): Promise<{ success: boolean; org?: GovOrg; error?: string }> {
  if (user.role !== 'superadmin') {
    return { success: false, error: 'Только Суперадминистратор имеет право изменять структуру подчиненности ведомств' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Находим числовые ID
    let orgNumericId: number | null = null;
    if (id.startsWith('org-')) orgNumericId = parseInt(id.replace('org-', ''), 10);
    else if (/^\d+$/.test(id)) orgNumericId = parseInt(id, 10);
    else {
      const r = await client.query('SELECT org_id FROM platform.gov_organizations_master WHERE slug = $1', [id]);
      if (r.rows.length > 0) orgNumericId = r.rows[0].org_id;
    }

    if (!orgNumericId) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Организация не найдена' };
    }

    let parentNumericId: number | null = null;
    if (newParentId) {
      if (newParentId.startsWith('org-')) parentNumericId = parseInt(newParentId.replace('org-', ''), 10);
      else if (/^\d+$/.test(newParentId)) parentNumericId = parseInt(newParentId, 10);
      else {
        const r = await client.query('SELECT org_id FROM platform.gov_organizations_master WHERE slug = $1', [newParentId]);
        if (r.rows.length > 0) parentNumericId = r.rows[0].org_id;
      }
    }

    if (parentNumericId === orgNumericId) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Организация не может быть родителем самой себя' };
    }

    const cur = await client.query('SELECT * FROM platform.gov_organizations_master WHERE org_id = $1 FOR UPDATE', [orgNumericId]);
    if (cur.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Организация не найдена' };
    }

    const currentOrg = cur.rows[0];
    const oldPath = currentOrg.path;

    // Проверка циклических связей: новый родитель не должен быть потомком текущего органа
    if (parentNumericId) {
      const parentRow = await client.query('SELECT * FROM platform.gov_organizations_master WHERE org_id = $1', [parentNumericId]);
      if (parentRow.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Выбранный родительский орган не существует' };
      }
      const parentPath = parentRow.rows[0].path;
      if (parentPath.startsWith(oldPath)) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Циклическая ошибка: нельзя передать орган в подчинение его же дочерней структуре!' };
      }

      const newPath = `${parentPath}${orgNumericId}/`;

      // Каскадный пересчет path для всех потомков
      await client.query(
        `
        UPDATE platform.gov_organizations_master
        SET 
          path = $1 || SUBSTRING(path FROM $2),
          updated_at = now()
        WHERE path LIKE $3
        `,
        [newPath, oldPath.length + 1, `${oldPath}%`]
      );

      // Обновляем родителя и версию
      await client.query(
        `
        UPDATE platform.gov_organizations_master
        SET parent_id = $1, path = $2, version = version + 1, updated_at = now()
        WHERE org_id = $3
        `,
        [parentNumericId, newPath, orgNumericId]
      );
    } else {
      // Перенос в корень
      const newPath = `${orgNumericId}/`;
      await client.query(
        `
        UPDATE platform.gov_organizations_master
        SET 
          path = $1 || SUBSTRING(path FROM $2),
          updated_at = now()
        WHERE path LIKE $3
        `,
        [newPath, oldPath.length + 1, `${oldPath}%`]
      );

      await client.query(
        `
        UPDATE platform.gov_organizations_master
        SET parent_id = NULL, path = $1, version = version + 1, updated_at = now()
        WHERE org_id = $2
        `,
        [newPath, orgNumericId]
      );
    }

    // Фиксация в аудит-логе
    await client.query(
      `
      INSERT INTO platform.org_audit_log (org_id, action, user_id, user_name, user_role, diff_payload)
      VALUES ($1, 'reparent', $2, $3, $4, $5::jsonb)
      `,
      [
        orgNumericId,
        user.id,
        user.name,
        user.role,
        JSON.stringify({ old_parent: currentOrg.parent_id, new_parent: parentNumericId, old_path: oldPath }),
      ]
    );

    await client.query('COMMIT');
    const updated = await getOrgByIdFromDb(orgNumericId);
    return { success: true, org: updated || undefined };
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error reparenting org in DB:', error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Получение истории аудита для карточки
 */
export async function getAuditLogsForOrg(id: string | number): Promise<any[]> {
  try {
    let numericId: number | null = null;
    if (typeof id === 'number') numericId = id;
    else if (id.startsWith('org-')) numericId = parseInt(id.replace('org-', ''), 10);
    else if (/^\d+$/.test(id)) numericId = parseInt(id, 10);
    else {
      const r = await pool.query('SELECT org_id FROM platform.gov_organizations_master WHERE slug = $1', [id]);
      if (r.rows.length > 0) numericId = r.rows[0].org_id;
    }

    if (!numericId) return [];
    const { rows } = await pool.query(
      `SELECT * FROM platform.org_audit_log WHERE org_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [numericId]
    );
    return rows;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
}
