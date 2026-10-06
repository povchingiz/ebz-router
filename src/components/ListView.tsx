import React, { useState } from 'react';
import { GovOrg } from '@/types';
import { LEVEL_CONFIG } from './OrgCard';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

interface ListViewProps {
  allOrgs: GovOrg[];
  onOpenDetails: (org: GovOrg) => void;
  searchQuery: string;
}

export const ListView: React.FC<ListViewProps> = ({
  allOrgs,
  onOpenDetails,
  searchQuery,
}) => {
  // По умолчанию ветки в списке тоже свернуты для порядка
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Фильтрация
  const filteredOrgs = allOrgs.filter((org) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const inName = org.name.toLowerCase().includes(q) || org.fullName.toLowerCase().includes(q);
    const inScope = (org.scope || '').toLowerCase().includes(q);
    const inQuestions = (org.questions || []).some(
      (ques) =>
        ques.topic.toLowerCase().includes(q) ||
        ques.keywords.some((kw) => kw.toLowerCase().includes(q))
    );
    return inName || inScope || inQuestions;
  });

  // Корневые для вывода
  const rootOrgs = filteredOrgs.filter((org) => !org.parentId || searchQuery.trim() !== '');

  const renderOrgRow = (org: GovOrg, depth = 0) => {
    const children = allOrgs.filter((o) => o.parentId === org.id);
    const hasChildren = children.length > 0 && !searchQuery.trim();
    const isExpanded = expandedIds.has(org.id);
    const config = LEVEL_CONFIG[org.level] || LEVEL_CONFIG.agency;

    return (
      <div key={org.id} className="flex flex-col">
        <div
          onClick={() => onOpenDetails(org)}
          className={`group flex items-center justify-between p-4 my-1.5 rounded-2xl border-2 border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer ${
            depth > 0 ? 'ml-6 sm:ml-10 border-l-4 border-l-blue-500' : ''
          }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(org.id, e)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                title={isExpanded ? 'Свернуть' : 'Развернуть'}
              >
                {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </button>
            ) : (
              <div className="w-7" />
            )}

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                  {org.name}
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${config.badgeClass}`}>
                  {config.label}
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {org.fullName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
              <FileText className="w-3.5 h-3.5" />
              Открыть карточку
            </span>
          </div>
        </div>

        {/* Дети при раскрытии */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {children.map((child) => renderOrgRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-2 px-2 space-y-1">
      {rootOrgs.length > 0 ? (
        rootOrgs.map((org) => renderOrgRow(org, 0))
      ) : (
        <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          Ведомств по данному запросу не найдено.
        </div>
      )}
    </div>
  );
};
