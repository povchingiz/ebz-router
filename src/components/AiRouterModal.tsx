import React, { useState } from 'react';
import { GovOrg } from '../types';
import { Sparkles, ArrowRight, CheckCircle2, Search } from 'lucide-react';

interface AiRouterModalProps {
  allOrgs: GovOrg[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToOrg: (org: GovOrg) => void;
}

export const AiRouterModal: React.FC<AiRouterModalProps> = ({
  allOrgs,
  isOpen,
  onClose,
  onNavigateToOrg,
}) => {
  const [appealText, setAppealText] = useState('');
  const [matchResult, setMatchResult] = useState<{
    org: GovOrg;
    reason: string;
    matchedKeywords: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleRouteAppeal = () => {
    if (!appealText.trim()) return;

    const lower = appealText.toLowerCase();
    let bestOrg: GovOrg | null = null;
    let bestScore = 0;
    let matchedWords: string[] = [];
    let bestReason = '';

    for (const org of allOrgs) {
      let score = 0;
      const currentMatched: string[] = [];

      // Проверка ключевых слов в вопросах
      for (const q of org.questions || []) {
        for (const kw of q.keywords) {
          if (lower.includes(kw.toLowerCase())) {
            score += 3;
            currentMatched.push(kw);
          }
        }
        if (lower.includes(q.topic.toLowerCase())) {
          score += 4;
          currentMatched.push(q.topic);
        }
      }

      // Проверка совпадения в описании сферы
      if (org.scope) {
        const words = org.scope.toLowerCase().split(/\s+/);
        for (const w of words) {
          if (w.length > 4 && lower.includes(w)) {
            score += 1;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestOrg = org;
        matchedWords = currentMatched;
        bestReason = `Компетенция определена по закрепленной тематике: ${currentMatched.slice(0, 3).join(', ')}`;
      }
    }

    if (bestOrg && bestScore > 0) {
      setMatchResult({
        org: bestOrg,
        reason: bestReason,
        matchedKeywords: Array.from(new Set(matchedWords)),
      });
    } else {
      // Дефолтная маршрутизация к Аппарату Правительства для распределения
      const fallback = allOrgs.find((o) => o.id === 'org-kpm') || allOrgs[0];
      setMatchResult({
        org: fallback,
        reason: 'Прямых совпадений по регламентам не найдено. Рекомендуется рассмотрение сводным органом.',
        matchedKeywords: [],
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="flex flex-col w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Шапка */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Умный маршрутизатор обращений
              </h3>
              <p className="text-xs text-slate-500">
                Определение точного адресата по тексту жалобы или сути вопроса
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        {/* Тело */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
              Текст обращения заявителя
            </label>
            <textarea
              rows={4}
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              placeholder="Например: В поселке уже третий день нет света из-за аварии на трансформаторе, напряжение скачет, бытовая техника выходит из строя..."
              className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
            />
          </div>

          {/* Быстрые примеры */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] text-slate-400">Примеры:</span>
            <button
              type="button"
              onClick={() =>
                setAppealText(
                  'На заправках опять пропал дизель и бензин АИ-92, создаются огромные очереди, когда решат проблему с поставками топлива?'
                )
              }
              className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
            >
              Топливо / ГСМ
            </button>
            <button
              type="button"
              onClick={() =>
                setAppealText(
                  'В поликлинике отказали в бесплатном лекарстве по квоте ОСМС, требуют покупать самостоятельно за свой счет.'
                )
              }
              className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
            >
              ОСМС / Лекарства
            </button>
            <button
              type="button"
              onClick={() =>
                setAppealText(
                  'Автобусы 48 маршрута в Алматы ходят с перебоями по 40 минут, в салоне страшная жара, водители не включают кондиционер.'
                )
              }
              className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
            >
              Автобусы Алматы
            </button>
          </div>

          <button
            type="button"
            onClick={handleRouteAppeal}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Search className="w-3.5 h-3.5" />
            Определить целевой орган
          </button>

          {/* Результат маршрутизации */}
          {matchResult && (
            <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Рекомендуемый орган:
                </span>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  {matchResult.org.name}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {matchResult.reason}
              </p>

              {matchResult.matchedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {matchResult.matchedKeywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 rounded"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  onNavigateToOrg(matchResult.org);
                  onClose();
                }}
                className="w-full mt-2 py-2 px-3 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors"
              >
                Показать в структуре
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
