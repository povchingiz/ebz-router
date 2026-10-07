'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GovOrg } from '@/types';
import { LEVEL_CONFIG } from './OrgCard';
import { useNavigation } from '@/lib/NavigationContext';
import { getAncestryPath } from '@/lib/navigationStore';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Sparkles,
  Minimize2,
  Building2,
  Search,
  CornerDownRight,
} from 'lucide-react';

interface ListViewProps {
  allOrgs: GovOrg[];
  searchQuery?: string;
}

export const ListView: React.FC<ListViewProps> = ({ allOrgs, searchQuery = '' }) => {
  const {
    navState,
    openInspector,
    toggleExpandParent,
    navigateToOrg,
    collapseAll,
  } = useNavigation();

  const [localSearch, setLocalSearch] = useState('');
  const focusedRowRef = useRef<HTMLDivElement>(null);

  // Карта всех организаций для мгновенного поиска предков
  const orgMap = useMemo(() => {
    return new Map<string, GovOrg>(allOrgs.map((o) => [o.id, o]));
  }, [allOrgs]);

  // При изменении фокуса мягко прокручиваем к целевой карточке
  useEffect(() => {
    if (navState.focusedOrgId && navState.focusedOrgId !== 'ap') {
      const timer = setTimeout(() => {
        focusedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [navState.focusedOrgId]);

  const activeQuery = localSearch.trim() || searchQuery.trim();

  // Детерминированная фильтрация по токенам
  const isMatchSearch = (org: GovOrg) => {
    if (!activeQuery) return true;
    const tokens = activeQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const text = `${org.name} ${org.fullName} ${org.scope || ''}`.toLowerCase();
    return tokens.every((t) => text.includes(t));
  };

  // Корневые ведомства (АП)
  const rootOrgs = useMemo(() => {
    if (activeQuery) {
      // При активном локальном поиске показываем все совпавшие ведомства
      return allOrgs.filter(isMatchSearch);
    }
    // В древовидном режиме показываем только корень (АП)
    return allOrgs.filter((org) => !org.parentId);
  }, [allOrgs, activeQuery]);

  // Рендер строки организации
  const renderOrgRow = (org: GovOrg, depth = 0) => {
    const children = allOrgs.filter((o) => o.parentId === org.id);
    const hasChildren = children.length > 0 && !activeQuery;
    const isExpanded = navState.expandedIds.has(org.id);
    const isFocused = navState.focusedOrgId === org.id;
    const config = LEVEL_CONFIG[org.level] || LEVEL_CONFIG.agency;

    // Расчет цепочки хлебных крошек
    const ancestryIds = getAncestryPath(org.id, orgMap);
    const parentNames = ancestryIds
      .slice(0, -1)
      .map((id) => orgMap.get(id)?.name)
      .filter(Boolean);

    return (
      <div key={org.id} className="flex flex-col">
        <div
          ref={isFocused ? focusedRowRef : null}
          onClick={() => {
            navigateToOrg(org.id);
          }}
          className={`group flex items-center justify-between p-4 my-1.5 rounded-2xl border-2 transition-all cursor-pointer ${
            isFocused
              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 shadow-md ring-4 ring-blue-500/20'
              : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 hover:shadow-xs'
          } ${depth > 0 && !activeQuery ? 'ml-6 sm:ml-10 border-l-4 border-l-blue-500' : ''}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Кнопка раскрытия детей */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpandParent(org.id);
                }}
                className={`p-1.5 rounded-xl transition-colors ${
                  isExpanded
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
                }`}
                title={isExpanded ? 'Свернуть подчиненных' : 'Развернуть подчиненных'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <div className="w-7 flex justify-center">
                {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />}
              </div>
            )}

            <div className="flex flex-col min-w-0">
              {/* Хлебные крошки подчинения (родители) */}
              {parentNames.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-0.5 truncate">
                  <span>Подчинение:</span>
                  {parentNames.map((pName, idx) => (
                    <React.Fragment key={idx}>
                      <span className="text-slate-600 dark:text-slate-400 font-extrabold">{pName}</span>
                      {idx < parentNames.length - 1 && <span>›</span>}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* Название ведомства */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                  {org.name}
                </span>

                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border truncate ${config.badgeClass}`}>
                  {config.label}
                </span>

                {isFocused && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-600 text-white shadow-xs">
                    <Sparkles className="w-2.5 h-2.5" /> В фокусе
                  </span>
                )}
              </div>

              <span className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {org.fullName}
              </span>
            </div>
          </div>

          {/* Кнопка "Сведения" */}
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openInspector(org.id);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white transition-all shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Сведения</span>
            </button>
          </div>
        </div>

        {/* Дочерние ведомства при раскрытии родителя */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {children.map((child) => renderOrgRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-2 px-2 space-y-3">
      {/* Панель управления списком */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border-2 border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Фильтр по списку ведомств..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 font-bold outline-none"
          />
        </div>

        {navState.expandedIds.size > 0 && !activeQuery && (
          <button
            type="button"
            onClick={collapseAll}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Свернуть список</span>
          </button>
        )}
      </div>

      {/* Список организаций */}
      {rootOrgs.length > 0 ? (
        rootOrgs.map((org) => renderOrgRow(org, 0))
      ) : (
        <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
          Ведомств по данному запросу не найдено.
        </div>
      )}
    </div>
  );
};
