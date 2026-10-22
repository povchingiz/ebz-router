import { GovOrg, OrgQuestion, User, OrgDepartment } from '../types';
import ALL_566_ORGS from '../data/all_566_orgs.json';
import fs from 'fs';
import path from 'path';

class OrgStore {
  private orgs: Map<string, GovOrg> = new Map();
  private auditLogs: Map<string, any[]> = new Map();

  private appendAudit(orgId: string, user: User, action: string, changes: any[] = []): void {
    const logs = this.auditLogs.get(orgId) || [];
    logs.unshift({ id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, orgId, timestamp: new Date().toISOString(), userId: user.id, userName: user.name, userRole: user.role, action, changes });
    this.auditLogs.set(orgId, logs);
  }

  public getAuditLogs(orgId: string): any[] { return [...(this.auditLogs.get(orgId) || [])]; }

  constructor() {
    (ALL_566_ORGS as GovOrg[]).forEach((org) => {
      const hasHumanTouch = Boolean(org.hasHumanTouch);
      this.orgs.set(org.id, {
        ...org,
        hasHumanTouch,
        status: hasHumanTouch ? (org.status || 'in_progress') : 'unfilled',
      });
    });
  }

  /**
   * Сброс изменений в локальный файл хранилища (Fallback без БД с атомарной записью)
   */
  private persistToDisk(): void {
    try {
      const filePath = path.join(process.cwd(), 'src', 'data', 'all_566_orgs.json');
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      const allList = Array.from(this.orgs.values());
      fs.writeFileSync(tempPath, JSON.stringify(allList, null, 2), 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      console.warn('Failed to persist orgStore to disk atomically:', err);
    }
  }

  public getAll(): GovOrg[] {
    return Array.from(this.orgs.values());
  }

  public getById(id: string): GovOrg | undefined {
    const org = this.orgs.get(id);
    return org ? { ...org } : undefined;
  }

  /**
   * Захват карточки на редактирование (Soft Lock)
   */
  public acquireLock(orgId: string, user: User): { success: boolean; message?: string } {
    const org = this.orgs.get(orgId);
    if (!org) return { success: false, message: 'Организация не найдена' };

    const now = new Date().getTime();
    if (org.lockedBy && org.lockedBy.userId !== user.id) {
      const lockTime = new Date(org.lockedBy.lockedAt).getTime();
      // Лок действует 2 минуты, если не обновлялся
      if (now - lockTime < 120_000) {
        return {
          success: false,
          message: `Организацию сейчас редактирует оператор: ${org.lockedBy.userName}. Доступ только для чтения.`,
        };
      }
    }

    org.lockedBy = {
      userId: user.id,
      userName: user.name,
      lockedAt: new Date().toISOString(),
    };
    return { success: true };
  }

  public releaseLock(orgId: string, userId: string): void {
    const org = this.orgs.get(orgId);
    if (org && org.lockedBy?.userId === userId) {
      org.lockedBy = null;
    }
  }

  /**
   * Обновление содержания (scope, questions, name, fullName) — доступно для Superadmin и Methodologist
   */
  public updateContent(
    orgId: string,
    updates: {
      name?: string;
      fullName?: string;
      orgNameKk?: string;
      shortNameKk?: string;
      scope?: string;
      theme?: string;
      locationAddress?: string;
      jurisdiction?: 'republican' | 'regional' | 'district' | 'local';
      legalBasis?: string;
      competenciesExcluded?: string;
      forwardToGuidance?: string;
      showOnFrontend?: boolean;
      contacts?: {
        phoneHotline?: string;
        phoneChancellery?: string;
        emailOfficial?: string;
        websiteUrl?: string;
        physicalAddress?: string;
      };
      questions?: OrgQuestion[];
      departments?: OrgDepartment[];
      status?: 'unfilled' | 'llm_check' | 'human_review' | 'verified' | 'in_progress';
      katoCode?: string;
      katoNameRu?: string;
      locationId?: string;
      hasHumanTouch?: boolean;
      llmNotes?: string;
    },
    expectedVersion: number,
    user: User
  ): { success: boolean; org?: GovOrg; error?: string } {
    const org = this.orgs.get(orgId);
    if (!org) return { success: false, error: 'Организация не найдена' };

    // Проверка прав
    if (user.role !== 'superadmin' && user.role !== 'methodologist') {
      return { success: false, error: 'Недостаточно прав для наполнения базы знаний' };
    }

    // Оптимистическая блокировка
    if (org.version !== expectedVersion) {
      return {
        success: false,
        error: `Конфликт версий: карточка была обновлена другим оператором (текущая версия v${org.version}, вы пытались сохранить v${expectedVersion}). Обновите страницу.`,
      };
    }

    const changes: any[] = [];
    const before = { ...org };
    if (updates.name !== undefined && updates.name.trim()) org.name = updates.name.trim();
    if (updates.fullName !== undefined) org.fullName = updates.fullName.trim();
    if (updates.orgNameKk !== undefined) org.orgNameKk = updates.orgNameKk.trim();
    if (updates.shortNameKk !== undefined) org.shortNameKk = updates.shortNameKk.trim();
    if (updates.scope !== undefined) org.scope = updates.scope;
    if (updates.theme !== undefined) org.theme = updates.theme;
    if (updates.locationAddress !== undefined) org.locationAddress = updates.locationAddress;
    if (updates.jurisdiction !== undefined) org.jurisdiction = updates.jurisdiction;
    if (updates.legalBasis !== undefined) org.legalBasis = updates.legalBasis;
    if (updates.competenciesExcluded !== undefined) org.competenciesExcluded = updates.competenciesExcluded;
    if (updates.forwardToGuidance !== undefined) org.forwardToGuidance = updates.forwardToGuidance;
    if (updates.showOnFrontend !== undefined) org.showOnFrontend = updates.showOnFrontend;
    if (updates.contacts !== undefined) org.contacts = updates.contacts;
    if (updates.questions !== undefined) org.questions = updates.questions;
    if (updates.departments !== undefined) org.departments = updates.departments;
    if (updates.status !== undefined) org.status = updates.status;
    if (updates.katoCode !== undefined) org.katoCode = updates.katoCode;
    if (updates.katoNameRu !== undefined) org.katoNameRu = updates.katoNameRu;
    if (updates.locationId !== undefined) org.locationId = updates.locationId;
    if (updates.hasHumanTouch !== undefined) org.hasHumanTouch = updates.hasHumanTouch;
    if (updates.llmNotes !== undefined) org.llmNotes = updates.llmNotes;

    const labels: Record<string, string> = { name: 'Краткое наименование', fullName: 'Полное наименование', orgNameKk: 'Наименование на казахском', shortNameKk: 'Краткое наименование на казахском', scope: 'Сфера ответственности', theme: 'Тематика', locationAddress: 'Адрес', jurisdiction: 'Юрисдикция', legalBasis: 'Правовая основа', competenciesExcluded: 'Исключенные компетенции', forwardToGuidance: 'Перенаправление', showOnFrontend: 'Отображение', contacts: 'Контакты', questions: 'Вопросы', departments: 'Отделы', status: 'Статус', katoCode: 'Код КАТО', katoNameRu: 'Населенный пункт', locationId: 'Локация', hasHumanTouch: 'Проверено человеком', llmNotes: 'Заметки' };
    for (const field of Object.keys(updates) as Array<keyof typeof updates>) {
      const oldValue = (before as any)[field]; const newValue = (org as any)[field];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) changes.push({ field, fieldLabel: labels[field] || field, oldValue, newValue });
    }
    org.version = (org.version || 1) + 1;
    this.appendAudit(orgId, user, 'update_content', changes);
    org.lockedBy = null; // сбрасываем soft lock после сохранения

    this.persistToDisk();

    return { success: true, org: { ...org } };
  }

  public convertDeptToOrg(parentOrgId: string, deptId: string | number, user: User): { success: boolean; parentOrg?: GovOrg; newOrg?: GovOrg; error?: string } {
    const parent = this.orgs.get(parentOrgId);
    if (!parent) return { success: false, error: 'Родительская организация не найдена' };
    const index = (parent.departments || []).findIndex(d => String(d.id) === String(deptId));
    if (index < 0) return { success: false, error: 'Отдел не найден' };
    const [dept] = parent.departments!.splice(index, 1);
    const newOrg: GovOrg = { id: `org-from-dept-${Date.now()}`, name: dept.name, fullName: dept.name, parentId: parent.id, level: 'district', scope: dept.responsible || dept.theme || '', theme: dept.theme || '', questions: dept.questions || [], departments: [], version: 1, createdAt: new Date().toISOString() } as GovOrg;
    this.orgs.set(newOrg.id, newOrg); parent.version = (parent.version || 1) + 1;
    this.appendAudit(parent.id, user, `Отдел ${dept.name} преобразован в подотчетную организацию`, [{ field: 'departments', fieldLabel: 'Отделы', oldValue: dept, newValue: null }]);
    this.persistToDisk(); return { success: true, parentOrg: { ...parent }, newOrg: { ...newOrg } };
  }

  public convertOrgToDept(orgId: string, targetParentId: string | undefined, user: User): { success: boolean; parentOrg?: GovOrg; error?: string } {
    const org = this.orgs.get(orgId); if (!org) return { success: false, error: 'Организация не найдена' };
    const parent = this.orgs.get(targetParentId || org.parentId || ''); if (!parent) return { success: false, error: 'Родительская организация не найдена' };
    const dept: OrgDepartment = { id: Date.now(), name: org.name, theme: org.theme || '', responsible: org.scope || '', orgId: parent.id, questions: org.questions || [] };
    parent.departments = [...(parent.departments || []), dept]; parent.version = (parent.version || 1) + 1; this.orgs.delete(orgId);
    this.appendAudit(parent.id, user, `Подотчетная организация ${org.name} преобразована во внутренний отдел`, [{ field: 'departments', fieldLabel: 'Отделы', oldValue: null, newValue: dept }]);
    this.persistToDisk(); return { success: true, parentOrg: { ...parent } };
  }

  /**
   * Создание новой организации / дочерней структуры
   */
  public createOrg(
    data: {
      name: string;
      fullName?: string;
      parentId: string | null;
      level?: 'central' | 'agency' | 'regional' | 'district';
      scope?: string;
      theme?: string;
      locationAddress?: string;
      jurisdiction?: 'republican' | 'regional' | 'district' | 'local';
      legalBasis?: string;
    },
    user: User
  ): { success: boolean; org?: GovOrg; error?: string } {
    if (user.role !== 'superadmin') {
      return { success: false, error: 'Только администратор имеет право создавать новые организации' };
    }
    if (!data.name || !data.name.trim()) {
      return { success: false, error: 'Укажите краткое наименование организации' };
    }

    const id = `org-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newOrg: GovOrg = {
      id,
      name: data.name.trim(),
      fullName: (data.fullName && data.fullName.trim()) || data.name.trim(),
      parentId: data.parentId || null,
      level: data.level || (data.parentId ? 'district' : 'central'),
      scope: data.scope || '',
      theme: data.theme || data.scope || '',
      locationAddress: data.locationAddress || '',
      jurisdiction: data.jurisdiction || 'republican',
      legalBasis: data.legalBasis || '',
      questions: [],
      version: 1,
    };

    this.orgs.set(id, newOrg);
    this.persistToDisk();
    return { success: true, org: { ...newOrg } };
  }

  /**
   * Смена подотчетности (parentId) — доступно ТОЛЬКО Superadmin.
   * Валидация циклических связей!
   */
  public reparent(
    orgId: string,
    newParentId: string | null,
    expectedVersion: number,
    user: User
  ): { success: boolean; org?: GovOrg; error?: string } {
    if (user.role !== 'superadmin') {
      return { success: false, error: 'Только Суперадминистратор имеет право менять структуру подотчетности ведомств' };
    }

    const org = this.orgs.get(orgId);
    if (!org) return { success: false, error: 'Организация не найдена' };

    if (org.version !== expectedVersion) {
      return { success: false, error: 'Конфликт версий при изменении родителя. Пожалуйста, обновите данные.' };
    }

    if (newParentId === orgId) {
      return { success: false, error: 'Организация не может быть родителем самой себя' };
    }

    // Проверка циклических ссылок: нельзя сделать родителем своего же потомка
    if (newParentId !== null) {
      let currentCheck: string | null = newParentId;
      while (currentCheck) {
        if (currentCheck === orgId) {
          return { success: false, error: 'Ошибка структуры: циклическая зависимость. Нельзя передать ведомство в подотчетность его же дочернему органу!' };
        }
        const parentNode = this.orgs.get(currentCheck);
        currentCheck = parentNode ? parentNode.parentId : null;
      }
    }

    org.parentId = newParentId;
    org.version += 1;
    org.lockedBy = null;

    this.persistToDisk();

    return { success: true, org: { ...org } };
  }

  /**
   * Пакетный импорт из структуры
   */
  public bulkImport(items: Array<Omit<GovOrg, 'version'> & { version?: number }>, user: User): { success: boolean; count: number; error?: string } {
    if (user.role !== 'superadmin') {
      return { success: false, count: 0, error: 'Импорт структуры разрешен только администраторам' };
    }

    let count = 0;
    for (const item of items) {
      const existing = this.orgs.get(item.id);
      this.orgs.set(item.id, {
        ...item,
        version: existing ? existing.version + 1 : 1,
        questions: item.questions || [],
      });
      count++;
    }

    return { success: true, count };
  }
}

// Глобальный синглтон для Node.js / Serverless рантайма
const globalForOrgStore = global as unknown as { orgStore: OrgStore };
export const orgStore = globalForOrgStore.orgStore || new OrgStore();
if (process.env.NODE_ENV !== 'production') globalForOrgStore.orgStore = orgStore;
