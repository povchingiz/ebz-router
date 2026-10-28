import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GovOrg } from '../types';
import { useNavigation } from '../lib/NavigationContext';
import { useAuth } from '../context/AuthContext';
import { CreateOrgUserModal } from './auth/CreateOrgUserModal';
import { Search, Building2, X, Sparkles, FileText, UserPlus } from 'lucide-react';

interface QuickSearchProps {
  allOrgs: GovOrg[];
  onSelectOrg?: (org: GovOrg) => void;
  onOpenDetails?: (org: GovOrg) => void;
}

export const QuickSearch: React.FC<QuickSearchProps> = ({
  allOrgs,
  onSelectOrg,
  onOpenDetails,
}) => {
  const { navigateToOrg, openInspector } = useNavigation();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [serverResults, setServerResults] = useState<GovOrg[] | null>(null);
  const [userOrg, setUserOrg] = useState<GovOrg | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!query.trim()) { setServerResults(null); return; }
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/orgs?search=${encodeURIComponent(query.trim())}`);
        const json = await response.json();
        setServerResults(Array.isArray(json.data) ? json.data : []);
      } catch { setServerResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const localResults = useMemo(() => {
    if (!query.trim()) return [];
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const orgResults = allOrgs.flatMap((org) => {
      const aliasesText = org.aliases ? org.aliases.join(' ') : '';
      const target = `${org.name} ${org.fullName} ${aliasesText} ${org.scope || ''}`.toLowerCase();
      const matches = tokens.every((token) => target.includes(token));
      const departments = (org.departments || []).filter((dept) => {
        const text = `${dept.name} ${dept.theme || ''} ${dept.responsible || ''} ${dept.path || ''}`.toLowerCase();
        return tokens.every((token) => text.includes(token));
      }).map((dept) => ({ kind: 'department' as const, org, dept, title: dept.name, subtitle: `📁 Отдел в: ${org.name}` }));
      return [...(matches ? [{ kind: 'org' as const, org, title: org.name, subtitle: org.fullName }] : []), ...departments];
    });
    return orgResults.slice(0, 10);
  }, [allOrgs, query]);
  const results = useMemo(() => {
    if (serverResults === null) return localResults;
    return serverResults.slice(0, 10).map((org) => ({ kind: 'org' as const, org, title: org.name, subtitle: org.fullName }));
  }, [serverResults, localResults]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Акцентная подсветка поля поиска (Градиентная рамка для привлечения внимания) */}
      <div className="relative p-0.5 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400 shadow-md shadow-blue-500/10">
        <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-[14px]">
          <Search className="w-4 h-4 text-blue-600 dark:text-blue-400 absolute left-3.5" />
          <input
            type="text"
            aria-label="Поиск организаций"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Поиск: напр. Минздрав"
            className="w-full pl-10 pr-9 py-2.5 text-xs font-bold bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
              }}
              className="absolute right-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Выпадающий список результатов */}
      {isOpen && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-fadeIn sm:min-w-[480px]">
          {results.length > 0 ? (
            results.map((result) => (
              <div
                key={result.kind === 'org' ? result.org.id : `${result.org.id}-dept-${result.dept.id}`}
                onClick={() => {
                  navigateToOrg(result.org.id, false);
                  if (result.kind === 'department') openInspector(result.org.id, result.dept.id);
                  else if (onSelectOrg) onSelectOrg(result.org);
                  setQuery('');
                  setIsOpen(false);
                }}
                className="p-3.5 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">
                      {result.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {result.subtitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToOrg(result.org.id, true);
                    if (result.kind === 'department') openInspector(result.org.id, result.dept.id);
                    else if (onOpenDetails) onOpenDetails(result.org);
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/60 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-600 hover:text-white transition-all shrink-0 shadow-xs"
                  title="Отобразить на доске и открыть сведения"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Сведения</span>
                </button>
                {result.kind === 'org' && (user?.role === 'GLOBAL_ADMIN' || user?.username === 'superadmin') && <button type="button" onClick={(event) => { event.stopPropagation(); setUserOrg(result.org); }} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100" title="Создать пользователя"><UserPlus className="h-4 w-4"/></button>}
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-slate-400">
              Организаций и подразделений не найдено
            </div>
          )}
        </div>
      )}
      {userOrg && <CreateOrgUserModal isOpen org={userOrg} onClose={() => setUserOrg(null)} />}
    </div>
  );
};
