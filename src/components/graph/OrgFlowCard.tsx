import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { GovOrg } from '../../types';
import { LEVEL_CONFIG } from '../OrgCard';
import { ChevronDown, ChevronUp, Lock, FileText } from 'lucide-react';

export interface OrgNodeData {
  org: GovOrg;
  isExpanded: boolean;
  hasChildren: boolean;
  childrenCount: number;
  isSelected: boolean;
  onToggleExpand: (id: string, e: React.MouseEvent) => void;
  onOpenDetails: (org: GovOrg) => void;
}

export const OrgFlowCard = ({ data, selected }: any) => {
  const { org, isExpanded, hasChildren, childrenCount, onToggleExpand, onOpenDetails } =
    data as OrgNodeData;
  const config = LEVEL_CONFIG[org.level] || LEVEL_CONFIG.agency;

  return (
    <div
      className={`group relative w-[310px] rounded-2xl border-2 bg-white dark:bg-slate-900 shadow-md transition-all duration-150 select-none p-4 flex flex-col justify-between ${
        selected
          ? 'border-blue-600 ring-4 ring-blue-500/20 shadow-blue-500/10'
          : `${config.borderClass}`
      } ${org.lockedBy ? 'border-amber-400 ring-2 ring-amber-400/40' : ''}`}
    >
      {/* Ручка связи сверху */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-blue-600 !border-2 !border-white dark:!border-slate-900 !-top-1.5"
      />

      {/* Индикатор блокировки */}
      {org.lockedBy && (
        <div className="absolute -top-3 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-sm">
          <Lock className="w-3 h-3" />
          <span>Редактирует: {org.lockedBy.userName}</span>
        </div>
      )}

      {/* Верх: Ранг */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${config.badgeClass}`}
        >
          {config.icon}
          {config.label}
        </span>

        {/* Кнопка "Сведения" (Явное открытие карточки только по кнопке!) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(org);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white transition-all shadow-xs"
          title="Открыть сведения о ведомстве"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Сведения</span>
        </button>
      </div>

      {/* Название и описание */}
      <div className="my-1">
        <h4 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
          {org.name}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
          {org.fullName}
        </p>
      </div>

      {/* Нижняя панель действий */}
      <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">
          {org.questions?.length ? `${org.questions.length} вопросов` : 'Базовые регламенты'}
        </span>

        {/* Кнопка Развернуть/Свернуть подчиненных */}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(org.id, e);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              isExpanded
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Свернуть</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>+ Подчиненные</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Ручка связи снизу */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-blue-600 !border-2 !border-white dark:!border-slate-900 !-bottom-1.5"
      />
    </div>
  );
};
