import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { GovOrg } from '../../types';
import { ChevronDown, Search, PlusCircle, X } from 'lucide-react';

export interface MoreChildrenNodeData {
  parentId: string;
  parentName: string;
  hiddenChildren: GovOrg[];
  onSelectChild: (org: GovOrg) => void;
}

export const MoreChildrenCard = ({ data }: any) => {
  const { parentName, hiddenChildren, onSelectChild } = data as MoreChildrenNodeData;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = hiddenChildren.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.fullName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative w-[310px] min-h-[120px] rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 p-4 flex flex-col justify-between items-center text-center shadow-xs">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-600 !border-2 !border-white dark:!border-slate-900 !-top-1.5"
      />

      <div className="flex flex-col items-center">
        <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
          Подчиненные ведомства
        </span>
        <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
          Еще +{hiddenChildren.length} ведомств
        </h4>
        <p className="text-[11px] text-slate-500 mt-0.5">
          в ведении «{parentName}»
        </p>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
      >
        <span>Выбрать ведомство</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {/* Выпадающее окно выбора конкретного ведомства */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl z-50 p-3 text-left animate-fadeIn">
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по остальным..."
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none outline-none font-medium"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-2 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {filtered.map((org) => (
              <div
                key={org.id}
                onClick={() => {
                  onSelectChild(org);
                  setIsOpen(false);
                }}
                className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-2 group"
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
              <div className="p-4 text-center text-xs text-slate-400">
                Ничего не найдено
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
