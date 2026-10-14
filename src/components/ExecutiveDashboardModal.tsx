import React, { useState, useEffect } from 'react';
import {
  X,
  BarChart3,
  ShieldCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  Phone,
  Ban,
  Globe2,
  EyeOff,
  Search,
  RotateCw,
  TrendingUp,
  Building,
} from 'lucide-react';

interface MinistryStat {
  orgId: number;
  shortName: string;
  fullName: string;
  total: number;
  verified: number;
  inProgress: number;
  unfilled: number;
  avgScore: number;
  readyPercent: number;
}

interface SummaryData {
  total: number;
  verified: number;
  inProgress: number;
  unfilled: number;
  humanTouched: number;
  hiddenOnline: number;
  withAntiCompetencies: number;
  withPhones: number;
  withKazakhName: number;
  avgScore: number;
}

interface ExecutiveDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrg?: (orgId: string) => void;
}

export const ExecutiveDashboardModal: React.FC<ExecutiveDashboardModalProps> = ({
  isOpen,
  onClose,
  onSelectOrg,
}) => {
  const [data, setData] = useState<{ summary: SummaryData; ministries: MinistryStat[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/readiness');
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Не удалось загрузить сводные данные');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredMinistries = data?.ministries.filter(
    (m) =>
      m.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Шапка */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Сводная заполненность базы знаний
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Республиканский мониторинг
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Статус заполнения сведений, компетенций и готовности ведомств к ИИ-маршрутизации
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchStats}
              title="Обновить данные"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 transition-all"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
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

        {/* Тело модального окна */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && !data ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RotateCw className="w-8 h-8 animate-spin text-blue-600" />
              <span className="text-xs font-semibold">Формирование аналитического среза по 27 000+ организациям...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : data ? (
            <>
              {/* Верхние KPI карточки */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {/* Всего */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Всего в базе</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                    {data.summary.total.toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Организаций РК</div>
                </div>

                {/* Верифицировано */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Верифицировано</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {data.summary.verified.toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[11px] text-emerald-600/80 mt-0.5 font-semibold">
                    {((data.summary.verified / data.summary.total) * 100).toFixed(1)}% эталонных
                  </div>
                </div>

                {/* В работе */}
                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">В работе</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
                    {data.summary.inProgress.toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[11px] text-amber-600/80 mt-0.5 font-semibold">
                    Редактируются методологами
                  </div>
                </div>

                {/* Требует заполнения */}
                <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Требует внимания</span>
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">
                    {data.summary.unfilled.toLocaleString('ru-RU')}
                  </div>
                  <div className="text-[11px] text-rose-600/80 mt-0.5 font-semibold">
                    Не затронуто человеком
                  </div>
                </div>
              </div>

              {/* Метрики качества наполнения */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    <Ban className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {data.summary.withAntiCompetencies}
                    </div>
                    <div className="text-[10px] text-slate-500">Анти-компетенций</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {data.summary.withPhones}
                    </div>
                    <div className="text-[10px] text-slate-500">Телефонов канцелярий</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
                    <Globe2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {data.summary.withKazakhName}
                    </div>
                    <div className="text-[10px] text-slate-500">Казахских названий (KZ)</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {data.summary.hiddenOnline}
                    </div>
                    <div className="text-[10px] text-slate-500">Скрыто онлайн</div>
                  </div>
                </div>
              </div>

              {/* Таблица заполненности по ведомствам */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Заполненность ведомств и акиматов ({data.ministries.length})
                    </h3>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Фильтр ведомств..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2.5 px-4">Ведомство</th>
                        <th className="py-2.5 px-3 text-center">Всего подведемств</th>
                        <th className="py-2.5 px-3 text-center">Заполненность</th>
                        <th className="py-2.5 px-3 text-center">Светофор</th>
                        <th className="py-2.5 px-4 text-right">Действие</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
                      {filteredMinistries && filteredMinistries.length > 0 ? (
                        filteredMinistries.map((m) => (
                          <tr key={m.orgId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 dark:text-white leading-tight">
                                {m.shortName}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-sm mt-0.5">
                                {m.fullName}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                              {m.total}
                            </td>
                            <td className="py-3 px-3">
                              <div className="w-32 mx-auto">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                  <span>{m.readyPercent}%</span>
                                  <span>{m.inProgress + m.verified} из {m.total}</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-600 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, Math.max(5, m.readyPercent))}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                                <span className="text-emerald-600">● {m.verified}</span>
                                <span className="text-amber-500">● {m.inProgress}</span>
                                <span className="text-rose-500">● {m.unfilled}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {onSelectOrg && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectOrg(String(m.orgId));
                                    onClose();
                                  }}
                                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                  Открыть ветку →
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                            Ничего не найдено по запросу «{searchQuery}»
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Подвал */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">
            Сводка обновляется в реальном времени при внесении правок
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
