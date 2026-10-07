'use client';

import React, { useState, useEffect } from 'react';
import { GovOrg, OrgQuestion, User, UserRole, JurisdictionLevel } from '../types';
import { NavigationProvider, useNavigation } from '../lib/NavigationContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { InteractiveOrgGraph } from '../components/graph/InteractiveOrgGraph';
import { ListView } from '../components/ListView';
import { QuickSearch } from '../components/QuickSearch';
import { OrgDrawer } from '../components/OrgDrawer';
import { CsvModal } from '../components/CsvModal';
import { UserBadge } from '../components/auth/UserBadge';
import {
  Network,
  List,
  FileSpreadsheet,
  RotateCw,
  RotateCcw,
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
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  const { inspectorOrg, closeInspector, openInspector, navigateToOrg, collapseAll } = useNavigation();
  const { user: authUser, canManageOrg } = useAuth();

  const effectiveUser: User = authUser
    ? {
        id: authUser.userId,
        name: authUser.fullName,
        role: authUser.role === 'GLOBAL_ADMIN' || authUser.role === 'ORG_ADMIN' ? 'superadmin' : 'viewer',
      }
    : currentUser;

  // Сохранение сведений (компетенции, локация, юрисдикция, вопросы, наименования)
  const handleSaveContent = async (updatedData: {
    name?: string;
    fullName?: string;
    scope: string;
    theme?: string;
    locationAddress?: string;
    jurisdiction?: JurisdictionLevel;
    legalBasis?: string;
    questions: OrgQuestion[];
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
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-18 py-3 flex items-center justify-between gap-4">
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

          {/* Быстрый сквозной поиск организаций по центру (Автокомплит) */}
          <div className="flex-1 max-w-xl mx-4">
            <QuickSearch allOrgs={orgs} />
          </div>

          {/* Действия и тулбар */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Кнопка сброса/очистки доски (Свернуть все ветви к корню) */}
            <button
              type="button"
              onClick={collapseAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all shadow-xs active:scale-95 border border-slate-200/80 dark:border-slate-700"
              title="Очистить доску и свернуть все открытые карточки к корню (АП)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span>Очистить доску</span>
            </button>

            {/* Переключатель режимов: Граф / Список */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl text-xs">
              <button
                type="button"
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black transition-all ${
                  viewMode === 'graph'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Network className="w-4 h-4" />
                Интерактивный граф
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                Список
              </button>
            </div>

            {/* Авторизация и переключатель профилей */}
            <div className="pl-3 border-l border-slate-200 dark:border-slate-800">
              <UserBadge />
            </div>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6">
        <div className="w-full">
          {viewMode === 'graph' ? (
            <InteractiveOrgGraph allOrgs={orgs} />
          ) : (
            <ListView allOrgs={orgs} />
          )}
        </div>
      </main>

      {/* Боковое меню сведений об организации (Slide-out Drawer) */}
      <OrgDrawer
        org={inspectorOrg}
        allOrgs={orgs}
        currentUser={effectiveUser}
        isOpen={Boolean(inspectorOrg)}
        onClose={closeInspector}
        onSaveContent={handleSaveContent}
        onReparent={handleReparent}
        onCreateOrg={handleCreateOrg}
      />

      {/* Модальное окно импорта CSV */}
      <CsvModal
        currentUser={currentUser}
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImport={handleImportCsv}
      />
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
