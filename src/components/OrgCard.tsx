import React from 'react';
import { GovOrg, OrgLevel } from '../types';
import { ChevronRight, Lock, Shield, Building, Building2, MapPin } from 'lucide-react';

interface OrgCardProps {
  org: GovOrg;
  isParent?: boolean;
  isSelected?: boolean;
  childrenCount?: number;
  onSelect: (org: GovOrg) => void;
  onOpenDetails: (org: GovOrg) => void;
}

export const LEVEL_CONFIG: Record<
  OrgLevel,
  { label: string; badgeClass: string; borderClass: string; icon: React.ReactNode }
> = {
  central: {
    label: 'Высший орган',
    badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    borderClass: 'border-indigo-500/40 hover:border-indigo-500',
    icon: <Shield className="w-3.5 h-3.5" />,
  },
  agency: {
    label: 'Министерство / Ведомство',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    borderClass: 'border-emerald-500/40 hover:border-emerald-500',
    icon: <Building2 className="w-3.5 h-3.5" />,
  },
  regional: {
    label: 'Комитет / Департамент',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    borderClass: 'border-amber-500/40 hover:border-amber-500',
    icon: <Building className="w-3.5 h-3.5" />,
  },
  district: {
    label: 'Районный уровень',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    borderClass: 'border-purple-500/40 hover:border-purple-500',
    icon: <MapPin className="w-3.5 h-3.5" />,
  },
};

export const OrgCard: React.FC<OrgCardProps> = ({
  org,
  isParent = false,
  isSelected = false,
  childrenCount = 0,
  onSelect,
  onOpenDetails,
}) => {
  const config = LEVEL_CONFIG[org.level] || LEVEL_CONFIG.agency;

  return (
    <div
      onClick={() => onSelect(org)}
      className={`group relative flex flex-col justify-between p-4 rounded-xl border bg-white dark:bg-slate-900 transition-all duration-150 cursor-pointer text-left shadow-sm hover:shadow-md ${
        isSelected
          ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/20 dark:bg-blue-950/20'
          : config.borderClass
      } ${org.lockedBy ? 'border-amber-400 bg-amber-50/20 ring-1 ring-amber-400/50' : ''}`}
    >
      {/* Soft Lock Badge */}
      {org.lockedBy && (
        <div className="absolute -top-2.5 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500 text-white shadow">
          <Lock className="w-3 h-3" />
          <span>Правки: {org.lockedBy.userName}</span>
        </div>
      )}

      <div>
        {/* Ранг и бейджи */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${config.badgeClass}`}
          >
            {config.icon}
            {config.label}
          </span>

          {childrenCount > 0 && (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {childrenCount} подвед.
            </span>
          )}
        </div>

        {/* Название */}
        <h4 className="text-base font-semibold text-slate-900 dark:text-white leading-tight mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {org.name}
        </h4>

        {/* Сфера ответственности (лаконично) */}
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
          {org.scope || org.fullName}
        </p>
      </div>

      {/* Нижняя панель действий */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-auto">
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          {org.questions?.length || 0} компетенций
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation(); // Не переключает узел, а открывает карточку!
            onOpenDetails(org);
          }}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline px-2 py-1 rounded"
        >
          Инфо и вопросы
        </button>
      </div>
    </div>
  );
};
