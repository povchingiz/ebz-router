import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { GovOrg } from '../../types';
import { LEVEL_CONFIG } from '../OrgCard';
import { ChevronDown, ChevronUp, Lock, FileText, MapPin, Tag, EyeOff, Layers } from 'lucide-react';

export interface OrgNodeData {
  org: GovOrg;
  parentName?: string;
  isExpanded: boolean;
  hasChildren: boolean;
  childrenCount: number;
  isSelected: boolean;
  layoutDirection?: 'TB' | 'LR';
  hiddenCount?: number;
  hiddenChildren?: GovOrg[];
  showDepartments?: boolean;
  onToggleExpand: (id: string, e: React.MouseEvent) => void;
  onOpenDetails: (org: GovOrg) => void;
  onToggleDepartments?: () => void;
  onSelectChildFromDropdown?: (org: GovOrg) => void;
}

export const OrgFlowCard = ({ data, selected }: any) => {
  const {
    org,
    parentName,
    isExpanded,
    hasChildren,
    childrenCount,
    layoutDirection = 'TB',
    showDepartments = false,
    onToggleExpand,
    onOpenDetails,
    onToggleDepartments,
  } = data as OrgNodeData;
  const config = LEVEL_CONFIG[org.level] || LEVEL_CONFIG.agency;

  // Определение стилей 4 этапов жизненного цикла данных:
  // 1. 🔴 Красный: предзаполнено нами, человек никогда не трогал (!hasHumanTouch)
  // 2. 🌸 Розовый: человек дополнил сведения, проверка LLM на адекватность (status === 'llm_check')
  // 3. 🟡 Желтый: проверка человека ожидает верификации (status === 'human_review' или 'in_progress')
  const isLlmCheck = org.status === 'llm_check';
  const isHumanReview = (org.status === 'human_review' || org.status === 'in_progress') && Boolean(org.hasHumanTouch);
  const isVerified = org.status === 'verified' && Boolean(org.hasHumanTouch);
  const isUnfilled = !isVerified && !isHumanReview && !isLlmCheck;
  const isHiddenOnline = org.showOnFrontend === false;

  return (
    <div
      className={`group relative w-[280px] rounded-2xl border-2 bg-white dark:bg-slate-900 shadow-md transition-all duration-150 select-none p-3.5 flex flex-col justify-between ${
        selected
          ? 'border-blue-600 ring-4 ring-blue-500/20 shadow-blue-500/10'
          : isHiddenOnline
          ? 'border-dashed border-slate-400 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-900/60 opacity-80'
          : isVerified
          ? 'border-emerald-400 dark:border-emerald-700 hover:border-emerald-500 bg-emerald-50/15 dark:bg-emerald-950/15'
          : isHumanReview
          ? 'border-amber-400 dark:border-amber-700 hover:border-amber-500 bg-amber-50/15 dark:bg-amber-950/15'
          : isLlmCheck
          ? 'border-pink-400 dark:border-pink-700 hover:border-pink-500 bg-pink-50/15 dark:bg-pink-950/15'
          : 'border-rose-400 dark:border-rose-800 hover:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20'
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

      {/* Верх: Тип госоргана (скрываем если "Госорган") + Кнопка Сведения */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1 overflow-hidden">
          {org.orgType && org.orgType.toLowerCase() !== 'госорган' ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-[125px]">
              {org.orgType}
            </span>
          ) : null}
          {isHiddenOnline && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-0.5 shrink-0">
              <EyeOff className="w-2.5 h-2.5" />
              Скрыто
            </span>
          )}
        </div>
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
        <div className="flex items-center gap-1.5 flex-wrap">
          <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug line-clamp-2">
            {org.name}
          </h4>
          {org.name === 'АПр' && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Правительство РК
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 leading-relaxed">
          {org.fullName}
        </p>

        {/* Локация ведомства */}
        {org.locationAddress && (
          <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
            <span className="truncate">{org.locationAddress}</span>
          </div>
        )}
      </div>

      {/* Кнопка показа/скрытия внутренних подразделений */}
      {org.departments && org.departments.length > 0 && (
        <div className="pt-1.5 mt-1.5 border-t border-slate-100 dark:border-slate-800/80">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDepartments?.();
            }}
            className={`w-full inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl font-bold text-[10px] transition-all shadow-xs ${
              showDepartments
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
            }`}
            title="Показать / скрыть внутренние подразделения на графе"
          >
            <Layers className="w-3 h-3" />
            <span>{showDepartments ? 'Скрыть подразделения' : `Подразделения (${org.departments.length})`}</span>
          </button>
        </div>
      )}

      {/* Нижняя панель действий (только если есть подотчетные дочерние структуры) */}
      {hasChildren && (
        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-[11px]">
          {/* Кнопка Развернуть/Свернуть дочерние организации */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(org.id, e);
            }}
            className={`w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold transition-all shadow-xs ${
              isExpanded
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Свернуть ({childrenCount})</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>⬇️ Дочерние организации ({childrenCount})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Ручка связи снизу (при TB) или справа (при LR) для дочерних организаций */}
      {hasChildren && (
        <Handle
          type="source"
          position={layoutDirection === 'LR' ? Position.Right : Position.Bottom}
          className={`!w-2.5 !h-2.5 !bg-blue-600 !border-2 !border-white dark:!border-slate-900 ${
            layoutDirection === 'LR' ? '!-right-1.5' : '!-bottom-1.5'
          }`}
        />
      )}

      {/* Ручка связи для подразделений: строго перпендикулярна основному потоку!
          При TB (вертикаль) выходит СПРАВА (Position.Right).
          При LR (горизонталь) выходит СНИЗУ (Position.Bottom). */}
      {org.departments && org.departments.length > 0 && (
        <Handle
          type="source"
          id="dept-source"
          position={layoutDirection === 'TB' ? Position.Right : Position.Bottom}
          className={`!w-2.5 !h-2.5 !bg-indigo-600 !border-2 !border-white dark:!border-slate-900 ${
            layoutDirection === 'TB' ? '!-right-1.5 !top-1/2' : '!-bottom-1.5 !left-1/2'
          }`}
        />
      )}
    </div>
  );
};
