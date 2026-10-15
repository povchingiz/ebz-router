'use client';

import React, { useState, useEffect } from 'react';
import { GovOrg, OrgQuestion, User, UserRole, JurisdictionLevel, OrgDepartment } from '../types';
import { NavigationProvider, useNavigation } from '../lib/NavigationContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { InteractiveOrgGraph } from '../components/graph/InteractiveOrgGraph';
import { ListView } from '../components/ListView';
import { QuickSearch } from '../components/QuickSearch';
import { OrgDrawer } from '../components/OrgDrawer';
import { BulkExcelModal } from '../components/BulkExcelModal';
import { ExecutiveDashboardModal } from '../components/ExecutiveDashboardModal';
import { ConflictDetectorModal } from '../components/ConflictDetectorModal';
import { UserBadge } from '../components/auth/UserBadge';
import { EbzWorkspace } from '../components/ebz/EbzWorkspace';
import { McpChatModal } from '../components/mcp/McpChatModal';
import Link from 'next/link';
import {
  Network,
  List,
  BookOpen,
  FileSpreadsheet,
  BarChart3,
  ShieldAlert,
  RotateCw,
  RotateCcw,
  ArrowLeftRight,
  ArrowDownUp,
  Terminal,
  Sparkles,
} from 'lucide-react';

function HomeContent({
  orgs,
  setOrgs,
  loadOrgs,
  currentUser,
  setCurrentUser,
}: {
  orgs: GovOrg[];
  setOrgs: React.Dispatch<React.SetStateAction<GovOrg[]>>;
  loadOrgs: () => Promise<void>;
  currentUser: User;
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
}) {
  const [viewMode, setViewMode] = useState<'graph' | 'list' | 'ebz'>('graph');
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isMcpChatOpen, setIsMcpChatOpen] = useState(false);

  const { inspectorOrg, inspectorDepartmentId, closeInspector, openInspector, navigateToOrg, collapseAll } = useNavigation();
  const { user: authUser, canManageOrg } = useAuth();

  const effectiveUser: User = authUser
    ? {
        id: authUser.userId,
        name: authUser.fullName,
        role: authUser.role === 'GLOBAL_ADMIN' || authUser.role === 'ORG_ADMIN' ? 'superadmin' : 'viewer',
      }
    : currentUser;

  // Права доступа к сводному дашборду (Администраторы)
  const isAdminUser = Boolean(
    authUser
      ? authUser.role === 'GLOBAL_ADMIN' || authUser.role === 'ORG_ADMIN'
      : false
  );

  // Детектор коллизий «Пересечения» строго конфиденциален только для главного супер-админа
  const isSuperAdminOwner = Boolean(
    authUser
      ? authUser.username === 'superadmin' || authUser.role === 'GLOBAL_ADMIN'
      : false
  );

  // При смене учетной записи: автоматическая навигация и открытие ведомства пользователя
  useEffect(() => {
    if (!authUser) return;

    if (authUser.orgId) {
      // Ищем ведомство пользователя по ID или slug
      const targetOrg = orgs.find(
        (o) => o.id === authUser.orgId || String(o.org_id) === String(authUser.orgId)
      );
      if (targetOrg) {
        // Направляем граф прямо к этому ведомству, центрируем и открываем его паспорт
        navigateToOrg(targetOrg.id, true);
        openInspector(targetOrg.id);
      }
    } else if (authUser.role === 'GLOBAL_ADMIN') {
      // Для супер-админа центрируем на корневом органе (АП)
      navigateToOrg('ap', false);
      closeInspector();
    }
  }, [authUser?.userId, authUser?.orgId, orgs, navigateToOrg, openInspector, closeInspector]);

  // При переходе в реестр «Статьи ЕБЗ» боковая карточка организации обязана закрываться
  useEffect(() => {
    if (viewMode === 'ebz') {
      closeInspector();
    }
  }, [viewMode, closeInspector]);

  // Сохранение сведений (компетенции, локация, юрисдикция, вопросы, наименования)
  const handleSaveContent = async (updatedData: {
    name?: string;
    fullName?: string;
    orgNameKk?: string;
    shortNameKk?: string;
    scope: string;
    theme?: string;
    locationAddress?: string;
    jurisdiction?: JurisdictionLevel;
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
    questions: OrgQuestion[];
    departments?: OrgDepartment[];
    status?: 'unfilled' | 'llm_check' | 'human_review' | 'verified' | 'in_progress';
    katoCode?: string;
    katoNameRu?: string;
    locationId?: string;
    hasHumanTouch?: boolean;
    llmNotes?: string;
  }) => {
    if (!inspectorOrg) return;
    const access = canManageOrg(inspectorOrg.id, orgs);
    if (!access.allowed) {
      throw new Error(access.reason || 'Нет прав на редактирование данной организации');
    }

    const res = await fetch('/api/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_content',
        orgId: inspectorOrg.id,
        user: effectiveUser,
        version: inspectorOrg.version,
        payload: updatedData,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка при сохранении');
    setOrgs((prev) => prev.map((o) => (o.id === inspectorOrg.id ? data.org : o)));
  };

  // Создание новой подотчетной организации
  const handleCreateOrg = async (newOrgData: {
    name: string;
    fullName: string;
    parentId: string | null;
    scope: string;
    locationAddress: string;
    jurisdiction: JurisdictionLevel;
  }) => {
    const access = canManageOrg(newOrgData.parentId, orgs);
    if (!access.allowed) {
      throw new Error(access.reason || 'Нет прав на создание организации в чужом ведомстве');
    }

    const res = await fetch('/api/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_org',
        user: effectiveUser,
        payload: newOrgData,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка создания организации');

    setOrgs((prev) => [...prev, data.org]);
    navigateToOrg(data.org.id, true);
    openInspector(data.org.id);
  };

  // Смена подотчетности
  const handleReparent = async (newParentId: string | null) => {
    if (!inspectorOrg) return;
    const access = canManageOrg(inspectorOrg.id, orgs);
    if (!access.allowed) {
      throw new Error(access.reason || 'Нет прав на изменение структуры данной организации');
    }

    const res = await fetch('/api/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reparent',
        orgId: inspectorOrg.id,
        user: effectiveUser,
        version: inspectorOrg.version,
        payload: { newParentId },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка смены подотчетности');
    setOrgs((prev) => prev.map((o) => (o.id === inspectorOrg.id ? data.org : o)));
    // Гарантированно перенаправляем навигацию на ведомство в его новой ветке
    navigateToOrg(data.org.id, true);
  };

  const handleImportCsv = async (items: GovOrg[]) => {
    const res = await fetch('/api/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'import_csv',
        user: effectiveUser,
        payload: { items },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка импорта');
    await loadOrgs();
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Верхняя панель навигации */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b-2 border-slate-200/80 dark:border-slate-800">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 h-18 py-3 flex items-center justify-between gap-4">
          {/* Логотип */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md">
              ЕБЗ
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                Единая база знаний
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">Организационная структура госорганов</p>
            </div>
          </div>

          {/* Быстрый сквозной поиск организаций по центру - МАКСИМАЛЬНО ШИРОКАЯ ПЛАШКА */}
          <div className="flex-1 max-w-3xl mx-4">
            <QuickSearch allOrgs={orgs} />
          </div>

          {/* Правая часть: ИИ-Маршрутизатор и Профиль */}
          <div className="flex items-center gap-3 shrink-0">
            {/* ИИ-Маршрутизатор: активен строго для главного супер-админа */}
            {isSuperAdminOwner && (
              <button
                type="button"
                onClick={() => setIsMcpChatOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-black transition-all shadow-md active:scale-95 ${
                  isMcpChatOpen
                    ? 'bg-indigo-700 text-white ring-2 ring-indigo-400'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
                }`}
                title="Открыть ИИ-Маршрутизатор на базе Model Context Protocol (MCP)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>⚡ ИИ-Маршрутизатор (MCP)</span>
              </button>
            )}

            {/* Спецификация OpenAPI 3.0 и документация шлюза */}
            <Link
              href="/docs"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 transition-all shadow-2xs"
              title="Открыть документацию API, спецификацию OpenAPI 3.0 и протокол MCP"
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>API / Gateway</span>
            </Link>

            {/* Авторизация и переключатель профилей */}
            <UserBadge />
          </div>
        </div>
      </header>

      {/* Рабочее пространство: выделенный оффсет слева под меню, граф в центре */}
      <div className="flex-1 flex max-w-[1800px] w-full mx-auto px-4 sm:px-6 py-4 gap-5 items-start">
        {/* Боковая панель инструментов слева с постоянным выделенным оффсетом */}
        <aside
          aria-label="Панель инструментов"
          className="w-52 shrink-0 sticky top-22 flex flex-col gap-2 p-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border-2 border-slate-200/90 dark:border-slate-800 shadow-sm"
        >
          {/* Переключатель режимов: Граф / Список / Статьи ЕБЗ + Ориентация графа */}
          <div className="flex flex-col gap-1 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode('graph')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg font-black transition-all text-[11px] ${
                  viewMode === 'graph'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Интерактивный граф структуры госорганов"
              >
                <Network className="w-3.5 h-3.5 shrink-0" />
                <span>Граф</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg font-black transition-all text-[11px] ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Табличный список организаций"
              >
                <List className="w-3.5 h-3.5 shrink-0" />
                <span>Список</span>
              </button>
            </div>

            {/* Вкладка Статьи ЕБЗ */}
            <button
              type="button"
              onClick={() => {
                setViewMode('ebz');
                closeInspector();
              }}
              className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-black transition-all text-[11px] ${
                viewMode === 'ebz'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Полноэкранный реестр статей и регламентов ЕБЗ"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
              <span>Статьи ЕБЗ</span>
            </button>

            {/* Переключатель ориентации раскладки: встроен в левую менюшку */}
            {viewMode === 'graph' && (
              <button
                type="button"
                onClick={() => setLayoutDirection((prev) => (prev === 'TB' ? 'LR' : 'TB'))}
                className="mt-1 w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-bold text-slate-700 dark:text-slate-200 bg-white/70 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-900 border border-slate-200/70 dark:border-slate-700 transition-all text-[11px]"
                title="Сменить ориентацию раскладки графа"
              >
                {layoutDirection === 'TB' ? (
                  <>
                    <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>В горизонталь</span>
                  </>
                ) : (
                  <>
                    <ArrowDownUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>В вертикаль</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Сводный дашборд заполненности (Для администраторов) */}
          {isAdminUser && (
            <button
              type="button"
              onClick={() => setIsDashboardModalOpen(true)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all active:scale-95 border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
              title="Сводная заполненность базы знаний по всем ведомствам республики"
            >
              <BarChart3 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Заполненность</span>
            </button>
          )}

          {/* Предупреждения о пересечениях (Строго для главного супер-админа) */}
          {isSuperAdminOwner && (
            <button
              type="button"
              onClick={() => setIsConflictModalOpen(true)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-all active:scale-95 border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
              title="Предупреждения о пересечениях компетенций (только АП РК)"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Пересечения</span>
            </button>
          )}

          <div className="h-px bg-slate-200 dark:bg-slate-800 my-0.5" />

          {/* Кнопка сброса/очистки доски (Свернуть все ветви к корню) */}
          <button
            type="button"
            onClick={collapseAll}
            className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            title="Очистить доску и свернуть все открытые карточки к корню (АП)"
          >
            <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Очистить доску</span>
          </button>
        </aside>

        {/* Секция для графов и списков - чистая середина, никогда не перекрывается менюшкой */}
        <main className="flex-1 min-w-0">
          <div className="w-full">
            {viewMode === 'graph' ? (
              <InteractiveOrgGraph allOrgs={orgs} layoutDirection={layoutDirection} />
            ) : viewMode === 'list' ? (
              <ListView allOrgs={orgs} />
            ) : (
              <EbzWorkspace
                allOrgs={orgs}
                onSelectOrg={(targetOrgId) => {
                  setViewMode('graph');
                  navigateToOrg(targetOrgId, true);
                  openInspector(targetOrgId);
                }}
              />
            )}
          </div>
        </main>
      </div>

      {/* Боковое меню сведений об организации (Slide-out Drawer) */}
      <OrgDrawer
        org={inspectorOrg}
        allOrgs={orgs}
        currentUser={effectiveUser}
        isOpen={viewMode !== 'ebz' && Boolean(inspectorOrg)}
        initialDepartmentId={inspectorDepartmentId}
        onClose={closeInspector}
        onSaveContent={handleSaveContent}
        onReparent={handleReparent}
        onCreateOrg={handleCreateOrg}
      />

      {/* Модальное окно пакетной работы через Excel/CSV */}
      <BulkExcelModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={loadOrgs}
        selectedBranchId={inspectorOrg?.org_id ? String(inspectorOrg.org_id) : undefined}
      />

      {/* Модальное окно сводной готовности (Для администраторов) */}
      <ExecutiveDashboardModal
        isOpen={isDashboardModalOpen}
        onClose={() => setIsDashboardModalOpen(false)}
        onSelectOrg={(targetOrgId) => {
          const resolvedId = targetOrgId.startsWith('org-') ? targetOrgId : `org-${targetOrgId}`;
          navigateToOrg(resolvedId, true);
        }}
      />

      {/* Модальное окно детектора коллизий (Только для главного супер-админа) */}
      <ConflictDetectorModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        onOpenOrgDrawer={(targetOrgId) => {
          const resolvedId = targetOrgId.startsWith('org-') ? targetOrgId : `org-${targetOrgId}`;
          navigateToOrg(resolvedId, true);
          openInspector(resolvedId);
        }}
      />

      {/* Интерактивный ИИ-Маршрутизатор на базе MCP (Только для супер-админа) */}
      {isSuperAdminOwner && (
        <McpChatModal
          isOpen={isMcpChatOpen}
          onClose={() => setIsMcpChatOpen(false)}
          onSelectOrg={(targetOrgId) => {
            const resolvedId = targetOrgId.startsWith('org-') ? targetOrgId : targetOrgId;
            navigateToOrg(resolvedId, true);
            openInspector(resolvedId);
          }}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  const [orgs, setOrgs] = useState<GovOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Текущий пользователь
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'user-admin',
    name: 'Асет Сериков',
    role: 'superadmin',
  });

  const loadOrgs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/orgs');
      const json = await res.json();
      if (json.data) {
        setOrgs(json.data);
      }
    } catch (err) {
      console.error('Failed to load orgs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  if (isLoading || orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 gap-2 bg-slate-50 dark:bg-slate-950">
        <RotateCw className="w-7 h-7 animate-spin text-blue-600" />
        <span className="text-xs font-semibold">Загрузка базы знаний...</span>
      </div>
    );
  }

  return (
    <AuthProvider>
      <NavigationProvider allOrgs={orgs}>
        <HomeContent
          orgs={orgs}
          setOrgs={setOrgs}
          loadOrgs={loadOrgs}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
        />
      </NavigationProvider>
    </AuthProvider>
  );
}
