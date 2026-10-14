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
  layoutDirection?: 'TB' | 'LR';
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
    layoutDirection = 'TB',
    onToggleExpand,
    onOpenDetails,
  } = data as OrgNodeData;
  const config = LEVEL_CONFIG[org.level] || LEVEL_CONFIG.agency;

  return (
    <div
      className={`group relative w-[270px] rounded-2xl border-2 bg-white dark:bg-slate-900 shadow-md transition-all duration-150 select-none p-3.5 flex flex-col justify-between ${
        selected
          ? 'border-blue-600 ring-4 ring-blue-500/20 shadow-blue-500/10'
          : `${config.borderClass}`
      } ${org.lockedBy ? 'border-amber-400 ring-2 ring-amber-400/40' : ''}`}
    >
      {/* Ручка связи сверху (при TB) или слева (при LR) */}
      <Handle
        type="target"
        position={layoutDirection === 'LR' ? Position.Left : Position.Top}
        className={`!w-2.5 !h-2.5 !bg-blue-600 !border-2 !border-white dark:!border-slate-900 ${
          layoutDirection === 'LR' ? '!-left-1.5' : '!-top-1.5'
        }`}
      />

      {/* Индикатор блокировки */}
      {org.lockedBy && (
        <div className="absolute -top-3 right-4 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-sm">
          <Lock className="w-2.5 h-2.5" />
          <span>{org.lockedBy.userName}</span>
        </div>
      )}

      {/* Верх: Кнопка Сведения */}
      <div className="flex items-center justify-end gap-1 mb-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(org);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white transition-all shadow-xs shrink-0"
          title="Открыть сведения об организации"
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

      {/* Нижняя панель действий (только если есть подотчетные) */}
      {hasChildren && (
        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-[11px]">
          {/* Кнопка Развернуть/Свернуть подотчетных */}
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
                <span>+ Подотчетные ({childrenCount})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Ручка связи снизу (при TB) или справа (при LR) */}
      {hasChildren && (
        <Handle
          type="source"
          position={layoutDirection === 'LR' ? Position.Right : Position.Bottom}
          className={`!w-2.5 !h-2.5 !bg-blue-600 !border-2 !border-white dark:!border-slate-900 ${
            layoutDirection === 'LR' ? '!-right-1.5' : '!-bottom-1.5'
          }`}
        />
      )}
    </div>
  );
};
