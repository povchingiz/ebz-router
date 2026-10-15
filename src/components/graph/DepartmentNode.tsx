'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { OrgDepartment } from '../../types';
import { Layers, ChevronRight, FileText } from 'lucide-react';

export interface DepartmentNodeData {
  department: OrgDepartment;
  parentOrgName: string;
  layoutDirection: 'TB' | 'LR';
  onSelect: (dept: OrgDepartment) => void;
}

export const DepartmentNode: React.FC<{ data: DepartmentNodeData }> = ({ data }) => {
  const { department, parentOrgName, layoutDirection, onSelect } = data;

  // Если основной граф расположен вертикально (TB), то подразделения выходят горизонтально вправо,
  // поэтому точка входа (target Handle) находится СЛЕВА (Position.Left).
  // Если граф расположен горизонтально (LR), то подразделения выходят вертикально вниз,
  // поэтому точка входа находится СВЕРХУ (Position.Top).
  const targetPosition = layoutDirection === 'TB' ? Position.Left : Position.Top;

  return (
    <div
      onClick={() => onSelect(department)}
      className="group w-[260px] rounded-2xl border-2 border-indigo-300/90 dark:border-indigo-700/80 bg-indigo-50/90 dark:bg-indigo-950/80 p-3 shadow-md hover:shadow-lg hover:border-indigo-500 transition-all cursor-pointer select-none text-left"
    >
      <Handle
        type="target"
        position={targetPosition}
        className={`!w-2.5 !h-2.5 !bg-indigo-600 !border-2 !border-white dark:!border-slate-900 ${
          layoutDirection === 'TB' ? '!-left-1.5' : '!-top-1.5'
        }`}
      />

      <div className="flex items-center justify-between gap-1 mb-1">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider">
          <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Подразделение</span>
        </div>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
          ID: {department.id}
        </span>
      </div>

      <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight line-clamp-2">
        {department.name}
      </h4>

      {department.responsible && (
        <p className="text-[10px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-1 leading-snug">
          {department.responsible}
        </p>
      )}

      {department.path && (
        <div className="mt-1.5 pt-1.5 border-t border-indigo-200/70 dark:border-indigo-800/60 flex items-center justify-between text-[9px] text-indigo-600 dark:text-indigo-400 font-medium">
          <span className="truncate max-w-[200px]" title={department.path}>
            {department.path}
          </span>
          <ChevronRight className="w-3 h-3 shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" />
        </div>
      )}
    </div>
  );
};
