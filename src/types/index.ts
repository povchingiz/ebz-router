/**
 * Роли пользователей в ЕБЗ
 */
export type UserRole = 'superadmin' | 'methodologist' | 'operator' | 'viewer';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  organizationId?: string; // привязка к конкретному ведомству
}

/**
 * Права ролей:
 * - superadmin: смена родительской структуры, создание/удаление организаций, редактирование всего.
 * - methodologist (методолог): наполнение базы знаний (описание, регламенты, вопросы/FAQ), но ЗАПРЕЩЕНО менять структуру/родителей.
 * - operator: поиск по базе, использование маршрутизатора для переадресации, чтение.
 * - viewer: только просмотр.
 */
export const ROLE_PERMISSIONS = {
  superadmin: {
    canChangeStructure: true, // перепривязка родителей, удаление, добавление веток
    canEditContent: true,     // редактирование описания и вопросов
    canImportCsv: true,
  },
  methodologist: {
    canChangeStructure: false, // НЕЛЬЗЯ трогать структуру госаппарата
    canEditContent: true,      // МОЖНО наполнять регламенты и вопросы
    canImportCsv: false,
  },
  operator: {
    canChangeStructure: false,
    canEditContent: false,
    canImportCsv: false,
  },
  viewer: {
    canChangeStructure: false,
    canEditContent: false,
    canImportCsv: false,
  },
} as const;

/**
 * Уровни иерархии госорганов
 */
export type OrgLevel = 'central' | 'agency' | 'regional' | 'district';

export interface OrgQuestion {
  id: string;
  topic: string;           // Тематика (напр. "Тарифы на электроэнергию")
  description: string;     // Суть вопроса / типичные жалобы
  keywords: string[];      // Ключевые слова для мгновенного поиска и ИИ
  sampleResponse?: string; // Типовой ответ / регламент
}

export interface GovOrg {
  id: string;
  name: string;             // Краткое (Минэнерго РК)
  fullName: string;         // Полное
  parentId: string | null;  // Идентификатор вышестоящего органа
  level: OrgLevel;          // Ранг органа
  scope: string;            // Сфера ведения / чем занимается (кратко)
  questions: OrgQuestion[]; // Вопросы и компетенции (для маршрутизатора)
  version: number;          // Для оптимистической блокировки
  lockedBy?: {              // Для soft lock (подсветка одновременного редактирования)
    userId: string;
    userName: string;
    lockedAt: string;
  } | null;
}
