import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ArrowRight,
  ExternalLink,
  Ban,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

interface ConflictParty {
  orgId: number;
  name: string;
  orgNameRu: string;
  expectedRole: string;
  oppositeRole: string;
  competenciesExcluded: string;
  forwardToGuidance: string;
  hasRulesConfigured: boolean;
}

interface ConflictItem {
  id: string;
  title: string;
  category: string;
  description: string;
  riskScenario: string;
  parties: ConflictParty[];
  status: 'resolved' | 'partial' | 'unresolved';
  score: number;
}

interface ConflictDetectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOrgDrawer?: (orgId: string) => void;
}

export const ConflictDetectorModal: React.FC<ConflictDetectorModalProps> = ({
  isOpen,
  onClose,
  onOpenOrgDrawer,
}) => {
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConflicts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/conflicts');
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Ошибка загрузки детектора коллизий');
      }
      const json = await res.json();
      setConflicts(json.conflicts || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchConflicts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/75 backdrop-blur-sm animate-fadeIn">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200/60 dark:border-rose-950 overflow-hidden">
        {/* Шапка */}
        <div className="p-6 border-b border-rose-100 dark:border-rose-950 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-600 text-white shadow-md">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Детектор конфликтов компетенций
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                  Конфиденциально (АП РК)
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Автоматический мониторинг спорных сфер, предотвращающий «футбол обращений» граждан
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchConflicts}
              title="Обновить проверку"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 transition-all"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Тело модалки */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && conflicts.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RotateCw className="w-8 h-8 animate-spin text-rose-600" />
              <span className="text-xs font-semibold">Анализ пересечений полномочий ведомств в базе знаний...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                <strong>Принцип работы детектора:</strong> Когда граждане подают заявления на спорные темы (например, рост тарифов или возврат товара), ИИ сверяет правила исключений. Если у ведомства не заполнена графа «Анти-компетенция», обращение рискует быть отправлено по ложному маршруту.
              </div>

              {conflicts.map((item) => (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    item.status === 'resolved'
                      ? 'border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900'
                      : item.status === 'partial'
                      ? 'border-amber-200 dark:border-amber-900 bg-amber-50/20 dark:bg-amber-950/10'
                      : 'border-rose-200 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {item.category}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {item.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.description}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {item.status === 'resolved' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Разграничено (100%)
                        </span>
                      ) : item.status === 'partial' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Частично настроено
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Коллизия не устранена
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Сценарий риска */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Риск путаницы: </span>
                    <span className="text-slate-600 dark:text-slate-400">{item.riskScenario}</span>
                  </div>

                  {/* Стороны и статус их анти-компетенций */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {item.parties.map((party) => (
                      <div
                        key={party.orgId}
                        className={`p-3.5 rounded-xl border ${
                          party.hasRulesConfigured
                            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                            : 'border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {party.name}
                          </span>
                          {party.hasRulesConfigured ? (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Правило есть
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                              <Ban className="w-3 h-3" /> Нет исключения
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                          <div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Входит: </span>
                            {party.expectedRole}
                          </div>
                          <div>
                            <span className="font-semibold text-rose-600 dark:text-rose-400">НЕ входит: </span>
                            {party.oppositeRole}
                          </div>
                        </div>

                        {onOpenOrgDrawer && (
                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                onOpenOrgDrawer(String(party.orgId));
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              <span>Настроить в карточке</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Подвал */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">
            Анализ доступен только пользователям с прямым доступом Администрации Президента
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};
