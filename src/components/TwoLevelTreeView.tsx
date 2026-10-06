import React from 'react';
import { GovOrg } from '../types';
import { OrgCard } from './OrgCard';
import { ArrowDown, CornerLeftUp, Layers } from 'lucide-react';

interface TwoLevelTreeViewProps {
  currentParent: GovOrg | null;
  rootOrgs: GovOrg[];
  childrenOrgs: GovOrg[];
  allOrgs: GovOrg[];
  onSelectOrg: (org: GovOrg) => void;
  onOpenDetails: (org: GovOrg) => void;
  onGoUp: () => void;
  breadcrumbs: GovOrg[];
}

export const TwoLevelTreeView: React.FC<TwoLevelTreeViewProps> = ({
  currentParent,
  rootOrgs,
  childrenOrgs,
  allOrgs,
  onSelectOrg,
  onOpenDetails,
  onGoUp,
  breadcrumbs,
}) => {
  const getChildrenCount = (id: string) => {
    return allOrgs.filter((o) => o.parentId === id).length;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto py-4 px-4 space-y-6">
      {/* Хлебные крошки и подъем наверх */}
      <div className="flex items-center justify-between w-full border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={() => {
              if (breadcrumbs.length > 0) {
                // переход к корню
                const root = breadcrumbs[0];
                onSelectOrg(root);
              }
            }}
            className="hover:text-blue-600 dark:hover:text-blue-400 font-medium"
          >
            Главные органы
          </button>

          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <span>/</span>
              <button
                type="button"
                onClick={() => onSelectOrg(crumb)}
                className={`hover:text-blue-600 dark:hover:text-blue-400 ${
                  idx === breadcrumbs.length - 1 ? 'font-semibold text-slate-900 dark:text-white' : ''
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {currentParent && (
          <button
            type="button"
            onClick={onGoUp}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            <CornerLeftUp className="w-3.5 h-3.5" />
            Уровень выше
          </button>
        )}
      </div>

      {/* Уровень 1: Родительский узел (Корень или выбранное ведомство) */}
      <div className="w-full flex flex-col items-center">
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
          {currentParent ? 'Уровень 1: Вышестоящий орган' : 'Уровень 1: Высшие органы управления'}
        </div>

        {currentParent ? (
          <div className="w-full max-w-md">
            <OrgCard
              org={currentParent}
              isParent={true}
              isSelected={true}
              childrenCount={childrenOrgs.length}
              onSelect={onSelectOrg}
              onOpenDetails={onOpenDetails}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
            {rootOrgs.map((org) => (
              <OrgCard
                key={org.id}
                org={org}
                isSelected={false}
                childrenCount={getChildrenCount(org.id)}
                onSelect={onSelectOrg}
                onOpenDetails={onOpenDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* Соединительная стрелка вниз (если родитель выбран) */}
      {currentParent && (
        <div className="flex flex-col items-center my-1 text-slate-400 dark:text-slate-600">
          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
          <ArrowDown className="w-4 h-4 text-slate-400 -mt-1" />
        </div>
      )}

      {/* Уровень 2: Прямые дочерние организации */}
      {currentParent && (
        <div className="w-full flex flex-col items-center">
          <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Уровень 2: Подведомственные органы ({childrenOrgs.length})
          </div>

          {childrenOrgs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
              {childrenOrgs.map((child) => (
                <OrgCard
                  key={child.id}
                  org={child}
                  childrenCount={getChildrenCount(child.id)}
                  onSelect={onSelectOrg}
                  onOpenDetails={onOpenDetails}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 w-full max-w-md">
              У данного ведомства нет подчиненных органов следующего уровня.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
