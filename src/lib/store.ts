import { GovOrg, OrgQuestion, User } from '../types';
import ALL_566_ORGS from '../data/all_566_orgs.json';

class OrgStore {
  private orgs: Map<string, GovOrg> = new Map();

  constructor() {
    (ALL_566_ORGS as GovOrg[]).forEach((org) => {
      this.orgs.set(org.id, { ...org });
    });
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
      scope?: string;
      theme?: string;
      locationAddress?: string;
      jurisdiction?: 'republican' | 'regional' | 'district' | 'local';
      legalBasis?: string;
      questions?: OrgQuestion[];
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

    if (updates.name !== undefined && updates.name.trim()) org.name = updates.name.trim();
    if (updates.fullName !== undefined) org.fullName = updates.fullName.trim();
    if (updates.scope !== undefined) org.scope = updates.scope;
    if (updates.theme !== undefined) org.theme = updates.theme;
    if (updates.locationAddress !== undefined) org.locationAddress = updates.locationAddress;
    if (updates.jurisdiction !== undefined) org.jurisdiction = updates.jurisdiction;
    if (updates.legalBasis !== undefined) org.legalBasis = updates.legalBasis;
    if (updates.questions !== undefined) org.questions = updates.questions;

    org.version += 1;
    org.lockedBy = null; // сбрасываем soft lock после сохранения

    return { success: true, org: { ...org } };
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
