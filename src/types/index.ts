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

export type JurisdictionLevel = 'republican' | 'regional' | 'district' | 'local';

export interface GovOrg {
  id: string;
  org_id?: number;          // Внутренний технический код из БД (напр. 77, 30400) - НЕ отображается в UI
  path?: string;            // Внутренний материализованный путь (напр. 77/30400/...) - НЕ отображается в UI
  classifierPath?: string;  // Системный путь по классификатору
  name: string;             // Краткое (Минэнерго РК)
  fullName: string;         // Полное
  aliases?: string[];       // Синонимы и альтернативные наименования (напр. ['Правительство', 'АПр'])
  parentId: string | null;  // Идентификатор вышестоящего органа
  level: OrgLevel;          // Ранг органа
  scope: string;            // Сфера ведения / чем занимается (кратко)
  theme?: string;           // Предметная тематика / вопросы обращений граждан
  locationAddress?: string; // Фактическое местонахождение (адрес/город)
  jurisdiction?: JurisdictionLevel; // Зона ответственности (Республиканский, Областной, Районный, Сельский)
  legalBasis?: string;      // Нормативно-правовая база (указ/положение/закон)
  orgType?: string;         // Тип ведомства: Министерство, Агентство, Комитет, Акимат
  orgNameKk?: string;       // Официальное наименование на казахском языке
  shortNameKk?: string;     // Краткое наименование на казахском языке
  katoCode?: string;        // Код КАТО (напр. 710000000)
  katoNameRu?: string;      // Наименование населенного пункта по КАТО
  locationId?: string;      // ID локации из locations_4classifier
  status?: 'unfilled' | 'llm_check' | 'human_review' | 'verified' | 'in_progress'; // 🔴 Не проверено / 🌸 Проверка ИИ / 🟡 Ожидает верификации / 🟢 Верифицировано
  showOnFrontend?: boolean; // Флаг отображения на платформе онлайн (true = видно, false = скрыто)
  hasHumanTouch?: boolean;  // Редактировался ли живым человеком
  completenessScore?: number; // Внутренний скор (не выводится на карточки)
  llmNotes?: string;        // Замечания и вердикт LLM валидатора
  competenciesExcluded?: string; // Что НЕ входит в компетенцию
  forwardToGuidance?: string;    // Куда перенаправлять типовые ошибки
  contacts?: {
    phoneHotline?: string;
    phoneChancellery?: string;
    emailOfficial?: string;
    websiteUrl?: string;
    physicalAddress?: string;
  };
  questions: OrgQuestion[]; // Вопросы и компетенции (для маршрутизатора)
  departments?: OrgDepartment[]; // Внутренние структурные подразделения ведомства
  version: number;          // Для оптимистической блокировки
  lockedBy?: {              // Для soft lock (подсветка одновременного редактирования)
    userId: string;
    userName: string;
    lockedAt: string;
  } | null;
}

export interface OrgDepartment {
  id: string | number;
  name: string;
  responsible: string;
  orgId: string;
  path?: string;
}

export interface EbzArticle {
  id: string;
  orgId?: string;
  orgNameRu?: string;
  orgNameKk?: string;
  titleRu: string;
  titleKk?: string;
  summaryRu: string;
  summaryKk?: string;
  fullResponseRu: string;
  fullResponseKk?: string;
  relatedNpaRu?: string;
  relatedNpaKk?: string;
  tags?: string[];
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassifierLocation {
  id: string;
  parentId: string;
  name: string;
  nameKk?: string;
  type: string;
  kato: string;
  breadcrumb: string;
}
