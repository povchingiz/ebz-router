import React from 'react';
import { GovOrg, OrgLevel } from '@/types';
import { Shield, Building2, MapPin, Layers } from 'lucide-react';

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
    label: 'Высший госорган',
    badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    borderClass: 'border-indigo-500/40 hover:border-indigo-500',
    icon: <Shield className="w-3.5 h-3.5" />,
  },
  agency: {
    label: 'Министерство / Агентство',
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    borderClass: 'border-emerald-500/40 hover:border-emerald-500',
    icon: <Building2 className="w-3.5 h-3.5" />,
  },
  regional: {
    label: 'Местный исполнительный орган (Акимат)',
    badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    borderClass: 'border-purple-500/40 hover:border-purple-500',
    icon: <MapPin className="w-3.5 h-3.5" />,
  },
  district: {
    label: 'Ведомство / Подразделение',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    borderClass: 'border-slate-300/60 dark:border-slate-700 hover:border-slate-400',
    icon: <Layers className="w-3.5 h-3.5" />,
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
      <div>
        <h4 className="text-base font-semibold text-slate-900 dark:text-white leading-tight mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {org.name}
        </h4>

        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">
          {org.scope || org.fullName}
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-auto">
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          {org.questions?.length || 0} компетенций
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(org);
          }}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline px-2 py-1 rounded"
        >
          Сведения
        </button>
      </div>
    </div>
  );
};
