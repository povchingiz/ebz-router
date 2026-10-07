import React, { useMemo } from 'react';
import { GovOrg } from '../types';
import { LEVEL_CONFIG } from './OrgCard';
import { Building2, ChevronRight, HelpCircle, Shield, Layers } from 'lucide-react';

interface SidebarNavProps {
  allOrgs: GovOrg[];
  selectedOrgId: string | null;
  onSelectOrg: (org: GovOrg) => void;
  onOpenDetails: (org: GovOrg) => void;
  searchQuery: string;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  allOrgs,
  selectedOrgId,
  onSelectOrg,
  onOpenDetails,
  searchQuery,
}) => {
  // Вычисляем ключевые центральные органы и акиматы
  const topOrgs = useMemo(() => {
    return allOrgs.filter(
      (o) =>
        o.level === 'central' ||
        o.level === 'agency' ||
        o.name.includes('Акимат') ||
        o.name.includes('Министерство')
    );
  }, [allOrgs]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return topOrgs;
    const q = searchQuery.toLowerCase();
    return allOrgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.fullName.toLowerCase().includes(q) ||
        (o.scope && o.scope.toLowerCase().includes(q))
    );
  }, [allOrgs, topOrgs, searchQuery]);

  return (
    <aside className="w-80 shrink-0 h-[calc(100vh-120px)] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Шапка левой панели */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
            {searchQuery.trim() ? 'Результаты поиска' : 'Опорные ведомства'}
          </h3>
        </div>
        <span className="text-[11px] font-bold text-slate-400">
          {filtered.length}
        </span>
      </div>

      {/* Список органов в левой панели */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800/40">
        {filtered.slice(0, 50).map((org) => {
          const isSelected = org.id === selectedOrgId;
          const config = LEVEL_CONFIG[org.level] || LEVEL_CONFIG.agency;

          return (
            <div
              key={org.id}
              onClick={() => onSelectOrg(org)}
              className={`group pt-1.5 first:pt-0 p-3 rounded-2xl transition-all cursor-pointer flex flex-col gap-1.5 ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/20'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                  {org.name}
                </span>

                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${config.badgeClass}`}
                >
                  {config.label.split(' ')[0]}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {org.fullName}
              </p>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-slate-400 font-medium">
                  {org.questions?.length ? `${org.questions.length} тем` : 'Базовый'}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(org);
                  }}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Карточка →
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            Ведомств не найдено
          </div>
        )}
      </div>
    </aside>
  );
};
