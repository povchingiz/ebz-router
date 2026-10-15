'use client';

import React, { useState, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { OrgDepartment } from '../../types';
import { Layers, Search, X, ChevronRight, FileText } from 'lucide-react';

export interface DepartmentClusterNodeData {
  parentOrgName: string;
  departments: OrgDepartment[];
  layoutDirection: 'TB' | 'LR';
  onClose: () => void;
  onSelectDepartment: (dept: OrgDepartment) => void;
}

export const DepartmentClusterNode: React.FC<{ data: DepartmentClusterNodeData }> = ({ data }) => {
  const { parentOrgName, departments, layoutDirection, onClose, onSelectDepartment } = data;
  const [search, setSearch] = useState('');

  const targetPosition = layoutDirection === 'TB' ? Position.Left : Position.Top;

  const filtered = useMemo(() => {
    if (!search.trim()) return departments;
    const q = search.toLowerCase();
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.responsible && d.responsible.toLowerCase().includes(q))
    );
  }, [departments, search]);

  return (
    <div
      onWheel={(e) => e.stopPropagation()}
      className="nowheel nodrag w-[380px] h-[440px] rounded-3xl border-2 border-indigo-400/90 dark:border-indigo-600/80 bg-white/95 dark:bg-slate-900/95 shadow-2xl p-4 flex flex-col justify-between select-none text-left backdrop-blur-md"
    >
      <Handle
        type="target"
        position={targetPosition}
        className={`!w-2.5 !h-2.5 !bg-indigo-600 !border-2 !border-white dark:!border-slate-900 ${
          layoutDirection === 'TB' ? '!-left-1.5' : '!-top-1.5'
        }`}
      />

      {/* Шапка блока подразделений */}
      <div className="pb-2.5 border-b border-indigo-100 dark:border-indigo-900/60 shrink-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                Подразделения ({departments.length})
              </h3>
              <p className="text-[10px] text-slate-500 font-medium truncate max-w-[230px]">
                {parentOrgName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Скрыть подразделения"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Быстрый поиск подразделения по названию и функциям */}
        <div className="relative mt-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию или функциям..."
            className="w-full pl-8 pr-3 py-1.5 text-[11px] rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 outline-none font-medium text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 transition-colors"
          />
        </div>
      </div>

      {/* Список подразделений без технических кодов и путей */}
      <div
        onWheel={(e) => e.stopPropagation()}
        className="nowheel nodrag flex-1 overflow-y-auto my-2 pr-1 space-y-2 overscroll-contain"
      >
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            Подразделения не найдены
          </div>
        ) : (
          filtered.map((dept) => (
            <div
              key={dept.id}
              onClick={() => onSelectDepartment(dept)}
              className="p-2.5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-indigo-100/80 dark:border-indigo-900/40 hover:border-indigo-300 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-1">
                <h4 className="text-xs font-black text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {dept.name}
                </h4>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all mt-0.5" />
              </div>

              {dept.responsible && (
                <p className="text-[10px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                  {dept.responsible}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Нижняя информационная плашка */}
      <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/60 flex items-center justify-between text-[10px] text-slate-400 shrink-0 font-medium">
        <span>Показано: {filtered.length} из {departments.length}</span>
        <span className="text-indigo-600 dark:text-indigo-400 font-bold">Нажмите для деталей</span>
      </div>
    </div>
  );
};
