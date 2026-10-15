import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GovOrg } from '../../types';
import { ChevronDown, Search, PlusCircle, X, Layers } from 'lucide-react';

export interface MoreChildrenNodeData {
  parentId: string;
  parentName: string;
  hiddenChildren: GovOrg[];
  layoutDirection?: 'TB' | 'LR';
  onSelectChild: (org: GovOrg) => void;
  onShowAll?: () => void;
}

export const MoreChildrenCard = ({ data }: any) => {
  const {
    parentName,
    hiddenChildren = [],
    layoutDirection = 'TB',
    onSelectChild,
    onShowAll,
  } = data as MoreChildrenNodeData;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = hiddenChildren.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.fullName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative w-[280px] min-h-[125px] rounded-2xl border-2 border-dashed border-blue-400/70 dark:border-blue-600/60 bg-blue-50/50 dark:bg-blue-950/20 backdrop-blur-xs p-3.5 flex flex-col justify-between items-center text-center shadow-xs transition-all hover:border-blue-500 hover:bg-blue-50/80">
      {/* Ручка связи: сверху при TB, слева при LR */}
      <Handle
        type="target"
        position={layoutDirection === 'LR' ? Position.Left : Position.Top}
        className={`!w-2.5 !h-2.5 !bg-blue-600 !border-2 !border-white dark:!border-slate-900 ${
          layoutDirection === 'LR' ? '!-left-1.5' : '!-top-1.5'
        }`}
      />

      <div className="flex flex-col items-center">
        <div className="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1 bg-blue-100/60 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">
          <Layers className="w-3 h-3" />
          <span>Еще организации</span>
        </div>
        <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
          +{hiddenChildren.length} организаций
        </h4>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
          {parentName}
        </p>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 justify-center flex-wrap">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all"
        >
          <span>Список ({hiddenChildren.length})</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {onShowAll && (
          <button
            type="button"
            onClick={onShowAll}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-xs transition-all"
            title="Развернуть все скрытые организации на графе"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Все на граф</span>
          </button>
        )}
      </div>

      {/* Выпадающее окно выбора конкретного ведомства на доске */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="nowheel nodrag nopan absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-2.5 text-left animate-fadeIn"
        >
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по остальным..."
              className="w-full pl-8 pr-7 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border-none outline-none font-medium"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-2 text-slate-400"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="max-h-52 overflow-y-auto space-y-1 pr-1 nowheel nodrag">
            {filtered.map((org) => (
              <div
                key={org.id}
                onClick={() => {
                  onSelectChild(org);
                  setIsOpen(false);
                }}
                className="p-2 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-2 group"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">
                    {org.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {org.fullName}
                  </div>
                </div>
                <PlusCircle className="w-3.5 h-3.5 text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="p-3 text-center text-xs text-slate-400">
                Ничего не найдено
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
