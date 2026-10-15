'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { OrgDepartment } from '../../types';
import { Layers } from 'lucide-react';

export interface DepartmentNodeData {
  department: OrgDepartment;
  parentOrgName: string;
  layoutDirection: 'TB' | 'LR';
  onSelect: (dept: OrgDepartment) => void;
}

export const DepartmentNode: React.FC<{ data: DepartmentNodeData }> = ({ data }) => {
  const { department, layoutDirection, onSelect } = data;

  // Если основной граф расположен вертикально (TB), то точка входа находится СЛЕВА (Position.Left).
  // Если граф расположен горизонтально (LR), то точка входа находится СВЕРХУ (Position.Top).
  const targetPosition = layoutDirection === 'TB' ? Position.Left : Position.Top;

  return (
    <div
      onClick={() => onSelect(department)}
      className="group w-[260px] rounded-2xl border-2 border-indigo-300/90 dark:border-indigo-700/80 bg-indigo-50/95 dark:bg-indigo-950/90 p-3 shadow-md hover:shadow-lg hover:border-indigo-500 transition-all cursor-pointer select-none text-left"
    >
      <Handle
        type="target"
        position={targetPosition}
        className={`!w-2.5 !h-2.5 !bg-indigo-600 !border-2 !border-white dark:!border-slate-900 ${
          layoutDirection === 'TB' ? '!-left-1.5' : '!-top-1.5'
        }`}
      />

      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider mb-1">
        <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span>Подразделение</span>
      </div>

      <h4 className="text-xs font-black text-slate-900 dark:text-white leading-tight line-clamp-2">
        {department.name}
      </h4>

      {department.responsible && (
        <p className="text-[10px] text-slate-600 dark:text-slate-300 line-clamp-3 mt-1.5 leading-snug">
          {department.responsible}
        </p>
      )}
    </div>
  );
};
