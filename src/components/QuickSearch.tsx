import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GovOrg } from '../types';
import { Search, Building2, X, Sparkles } from 'lucide-react';

interface QuickSearchProps {
  allOrgs: GovOrg[];
  onSelectOrg: (org: GovOrg) => void;
  onOpenDetails: (org: GovOrg) => void;
}

export const QuickSearch: React.FC<QuickSearchProps> = ({
  allOrgs,
  onSelectOrg,
  onOpenDetails,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
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

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    return allOrgs
      .filter((org) => {
        const target = `${org.name} ${org.fullName} ${org.scope || ''}`.toLowerCase();
        return tokens.every((token) => target.includes(token));
      })
      .slice(0, 10);
  }, [allOrgs, query]);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl">
      {/* Акцентная подсветка поля поиска (Градиентная рамка для привлечения внимания) */}
      <div className="relative p-0.5 rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-sky-400 shadow-md shadow-blue-500/10">
        <div className="relative flex items-center bg-white dark:bg-slate-900 rounded-[14px]">
          <Search className="w-4 h-4 text-blue-600 dark:text-blue-400 absolute left-3.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Быстрый поиск: введите ведомство (Минэнерго, Телерадиокомплекс, Акимат)..."
            className="w-full pl-10 pr-9 py-2.5 text-xs font-bold bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
          />
          {query && (
            <button
              type="button"
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-fadeIn">
          {results.length > 0 ? (
            results.map((org) => (
              <div
                key={org.id}
                onClick={() => {
                  onSelectOrg(org);
                  setQuery('');
                  setIsOpen(false);
                }}
                className="p-3.5 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">
                      {org.name}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {org.level === 'central'
                        ? 'Высший'
                        : org.level === 'agency'
                        ? 'Министерство'
                        : org.level === 'regional'
                        ? 'Акимат'
                        : 'Ведомство'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {org.fullName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails(org);
                    setQuery('');
                    setIsOpen(false);
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-blue-600 hover:text-white transition-all shrink-0 shadow-xs"
                >
                  Карточка
                </button>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-xs text-slate-400">
              Организаций не найдено
            </div>
          )}
        </div>
      )}
    </div>
  );
};
