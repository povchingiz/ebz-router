import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { GovOrg } from '../../types';
import { LEVEL_CONFIG } from '../OrgCard';
import { ChevronDown, ChevronUp, Lock, FileText, ChevronRight } from 'lucide-react';

export interface OrgNodeData {
  org: GovOrg;
  isExpanded: boolean;
  hasChildren: boolean;
  childrenCount: number;
  isSelected: boolean;
  hiddenCount?: number;
  hiddenChildren?: GovOrg[];
  onToggleExpand: (id: string, e: React.MouseEvent) => void;
  onOpenDetails: (org: GovOrg) => void;
  onSelectChildFromDropdown?: (org: GovOrg) => void;
}

export const OrgFlowCard = ({ data, selected }: any) => {
  const {
    org,
    isExpanded,
    hasChildren,
    childrenCount,
    hiddenCount = 0,
    hiddenChildren = [],
    onToggleExpand,
    onOpenDetails,
    onSelectChildFromDropdown,
  } = data as OrgNodeData;
  const config = LEVEL_CONFIG[org.level] || LEVEL_CONFIG.agency;
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredHidden = hiddenChildren.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className={`group relative w-[270px] rounded-2xl border-2 bg-white dark:bg-slate-900 shadow-md transition-all duration-150 select-none p-3.5 flex flex-col justify-between ${
        selected
          ? 'border-blue-600 ring-4 ring-blue-500/20 shadow-blue-500/10'
          : `${config.borderClass}`
      } ${org.lockedBy ? 'border-amber-400 ring-2 ring-amber-400/40' : ''}`}
    >
      {/* Ручка связи сверху */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-blue-600 !border-2 !border-white dark:!border-slate-900 !-top-1.5"
      />

      {/* Индикатор блокировки */}
      {org.lockedBy && (
        <div className="absolute -top-3 right-4 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-sm">
          <Lock className="w-2.5 h-2.5" />
          <span>{org.lockedBy.userName}</span>
        </div>
      )}

      {/* Верх: Ранг + Кнопка Сведения */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border truncate max-w-[170px] ${config.badgeClass}`}
        >
          {config.icon}
          <span className="truncate">{config.label}</span>
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(org);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white transition-all shadow-xs shrink-0"
          title="Открыть сведения о ведомстве"
        >
          <FileText className="w-3 h-3" />
          <span>Сведения</span>
        </button>
      </div>

      {/* Название и описание */}
      <div className="my-1">
        <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug line-clamp-2">
          {org.name}
        </h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 leading-relaxed">
          {org.fullName}
        </p>
      </div>

      {/* Нижняя панель действий */}
      <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-[11px]">
        {/* Кнопка Развернуть/Свернуть подчиненных */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(org.id, e);
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold transition-all shadow-xs ${
              isExpanded
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Свернуть</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>+ Подчиненные</span>
              </>
            )}
          </button>
        ) : (
          <span className="text-[10px] text-slate-400">Конечный орган</span>
        )}

        {/* Интерактивный выпадающий список прямо на карточке органа */}
        {hasChildren && isExpanded && hiddenCount > 0 && onSelectChildFromDropdown && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 hover:bg-indigo-100 transition-colors border border-indigo-200 dark:border-indigo-800"
            >
              <span>Еще +{hiddenCount}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isDropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-full mb-2 w-64 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2.5 text-left animate-fadeIn"
              >
                <div className="text-[10px] font-extrabold uppercase text-slate-400 px-1 mb-1.5">
                  Выбрать ведомство в центр:
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по остальным..."
                  className="w-full px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 dark:bg-slate-800 border-none outline-none font-medium mb-1.5"
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredHidden.map((child) => (
                    <div
                      key={child.id}
                      onClick={() => {
                        onSelectChildFromDropdown(child);
                        setIsDropdownOpen(false);
                      }}
                      className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-1 group"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-900 dark:text-white group-hover:text-blue-600 truncate">
                          {child.name}
                        </div>
                        <div className="text-[9px] text-slate-500 truncate">
                          {child.fullName}
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 shrink-0" />
                    </div>
                  ))}
                  {filteredHidden.length === 0 && (
                    <div className="p-3 text-center text-[10px] text-slate-400">
                      Не найдено
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ручка связи снизу */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-blue-600 !border-2 !border-white dark:!border-slate-900 !-bottom-1.5"
      />
    </div>
  );
};
