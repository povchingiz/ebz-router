'use client';

import React, { useState, useEffect } from 'react';
import { GovOrg, OrgQuestion, User, UserRole } from '../types';
import { InteractiveOrgGraph } from '../components/graph/InteractiveOrgGraph';
import { ListView } from '../components/ListView';
import { SidebarNav } from '../components/SidebarNav';
import { OrgDrawer } from '../components/OrgDrawer';
import { CsvModal } from '../components/CsvModal';
import {
  Network,
  List,
  Search,
  FileSpreadsheet,
  RotateCw,
} from 'lucide-react';

export default function HomePage() {
  const [orgs, setOrgs] = useState<GovOrg[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [searchQuery, setSearchQuery] = useState('');

  // Текущий выбранный узел
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  // Модальные окна
  const [activeModalOrg, setActiveModalOrg] = useState<GovOrg | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Текущий пользователь
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'user-admin',
    name: 'Асет Сериков',
    role: 'superadmin',
  });

  // Загрузка организаций
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



  // Мутации данных
  const handleSaveContent = async (scope: string, questions: OrgQuestion[]) => {
    if (!activeModalOrg) return;
    const res = await fetch('/api/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_content',
        orgId: activeModalOrg.id,
        user: currentUser,
        version: activeModalOrg.version,
        payload: { scope, questions },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка при сохранении');
    setOrgs((prev) => prev.map((o) => (o.id === activeModalOrg.id ? data.org : o)));
    setActiveModalOrg(data.org);
  };

  const handleReparent = async (newParentId: string | null) => {
    if (!activeModalOrg) return;
    const res = await fetch('/api/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reparent',
        orgId: activeModalOrg.id,
        user: currentUser,
        version: activeModalOrg.version,
        payload: { newParentId },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка смены подчинения');
    setOrgs((prev) => prev.map((o) => (o.id === activeModalOrg.id ? data.org : o)));
    setActiveModalOrg(data.org);
  };

  const handleImportCsv = async (items: GovOrg[]) => {
    const res = await fetch('/api/mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'import_csv',
        user: currentUser,
        payload: { items },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка импорта');
    await loadOrgs();
  };



  return (
    <div className="flex flex-col min-h-screen">
      {/* Верхняя панель навигации */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Логотип и проект */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              ЕБЗ
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Единая база знаний
              </h1>
              <p className="text-[11px] text-slate-500">Маршрутизатор компетенций госорганов</p>
            </div>
          </div>

          {/* Быстрый поиск вопросов и органов */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по вопросу, жалобе или названию..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Действия и тулбар */}
          <div className="flex items-center gap-3">
            {/* Импорт CSV */}
            {currentUser.role === 'superadmin' && (
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Импорт CSV
              </button>
            )}

            {/* Переключатель режимов: Граф / Список */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl text-xs">
              <button
                type="button"
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                Список
              </button>
            </div>

            {/* Переключатель роли */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-medium hidden lg:inline">Роль:</span>
              <select
                value={currentUser.role}
                onChange={(e) =>
                  setCurrentUser({
                    ...currentUser,
                    role: e.target.value as UserRole,
                  })
                }
                className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl p-2 border-none outline-none font-bold cursor-pointer shadow-xs"
              >
                <option value="superadmin">Суперадмин</option>
                <option value="methodologist">Методолог</option>
                <option value="operator">Оператор</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 flex gap-6">
        {/* Левая треть экрана: Навигатор ведомств */}
        {!isLoading && (
          <div className="hidden lg:block">
            <SidebarNav
              allOrgs={orgs}
              selectedOrgId={selectedOrgId}
              onSelectOrg={(org) => setSelectedOrgId(org.id)}
              onOpenDetails={(org) => setActiveModalOrg(org)}
              searchQuery={searchQuery}
            />
          </div>
        )}

        {/* Правая часть: Интерактивный граф или Список */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 gap-2">
              <RotateCw className="w-7 h-7 animate-spin text-blue-600" />
              <span className="text-xs font-semibold">Загрузка базы знаний...</span>
            </div>
          ) : viewMode === 'graph' ? (
            <InteractiveOrgGraph
              allOrgs={orgs}
              onOpenDetails={(org) => setActiveModalOrg(org)}
              selectedOrgId={selectedOrgId}
              onSelectOrg={(org) => setSelectedOrgId(org.id)}
            />
          ) : (
            <ListView
              allOrgs={orgs}
              onOpenDetails={(org) => setActiveModalOrg(org)}
              searchQuery={searchQuery}
            />
          )}
        </div>
      </main>

      {/* Боковое меню сведений об организации (Slide-out Drawer) */}
      <OrgDrawer
        org={activeModalOrg}
        allOrgs={orgs}
        currentUser={currentUser}
        isOpen={Boolean(activeModalOrg)}
        onClose={() => setActiveModalOrg(null)}
        onSaveContent={handleSaveContent}
        onReparent={handleReparent}
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
