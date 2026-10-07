import React, { useState } from 'react';
import { GovOrg, OrgQuestion, User, ROLE_PERMISSIONS } from '../types';
import { X, Lock, ShieldCheck, Save, GitFork, Plus, Trash2, AlertCircle } from 'lucide-react';

interface OrgModalProps {
  org: GovOrg;
  allOrgs: GovOrg[];
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSaveContent: (updatedScope: string, updatedQuestions: OrgQuestion[]) => Promise<void>;
  onReparent: (newParentId: string | null) => Promise<void>;
}

export const OrgModal: React.FC<OrgModalProps> = ({
  org,
  allOrgs,
  currentUser,
  isOpen,
  onClose,
  onSaveContent,
  onReparent,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'questions' | 'admin'>('info');
  const [scope, setScope] = useState(org.scope || '');
  const [questions, setQuestions] = useState<OrgQuestion[]>(org.questions || []);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(org.parentId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  if (!isOpen) return null;

  const permissions = ROLE_PERMISSIONS[currentUser.role];
  const isLockedByOther = org.lockedBy && org.lockedBy.userId !== currentUser.id;

  const handleSaveContent = async () => {
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      await onSaveContent(scope, questions);
      setStatusMsg({ text: 'Данные компетенций успешно сохранены' });
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Ошибка сохранения', error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReparent = async () => {
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      await onReparent(selectedParentId);
      setStatusMsg({ text: 'Подотчетность ведомства успешно обновлена' });
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Ошибка смены родителя', error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addQuestion = () => {
    const newQ: OrgQuestion = {
      id: `q-${Date.now()}`,
      topic: 'Новая тематика',
      description: 'Описание сферы компетенции и типовых вопросов заявителей',
      keywords: [],
    };
    setQuestions([...questions, newQ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[88vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Шапка модалки */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                v{org.version}
              </span>
              {isLockedByOther && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded font-medium">
                  <Lock className="w-3 h-3" /> Правки ведет: {org.lockedBy?.userName}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {org.name}
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-md">{org.fullName}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Вкладки */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 gap-6 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`py-3 font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Сфера и полномочия
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`py-3 font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'questions'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Вопросы компетенции ({questions.length})
          </button>

          {permissions.canChangeStructure && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`py-3 font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <GitFork className="w-4 h-4" />
              Подотчетность (Админ)
            </button>
          )}
        </div>

        {/* Тело модалки */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {statusMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                statusMsg.error
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {statusMsg.text}
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                Чем занимается ведомство (Сфера ответственности)
              </label>
              {permissions.canEditContent && !isLockedByOther ? (
                <textarea
                  rows={4}
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Опишите ключевые зоны ответственности..."
                />
              ) : (
                <div className="p-3 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 leading-relaxed">
                  {scope || 'Описание отсутствует.'}
                </div>
              )}
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  Закрепленные вопросы для умной маршрутизации
                </span>
                {permissions.canEditContent && !isLockedByOther && (
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить вопрос
                  </button>
                )}
              </div>

              {questions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                  Вопросы компетенций пока не внесены.
                </div>
              ) : (
                questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {idx + 1}. {q.topic}
                      </span>
                      {permissions.canEditContent && !isLockedByOther && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(q.id)}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {q.description}
                    </p>
                    {q.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {q.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-[10px] rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          >
                            #{kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'admin' && permissions.canChangeStructure && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                Внимание: смена родительской организации изменяет структуру иерархии в дереве и правилах маршрутизации.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                  Вышестоящий орган (Родитель)
                </label>
                <select
                  value={selectedParentId || ''}
                  onChange={(e) => setSelectedParentId(e.target.value || null)}
                  className="w-full p-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">(Без родителя / Корневой уровень)</option>
                  {allOrgs
                    .filter((o) => o.id !== org.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} — {o.fullName}
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleReparent}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Обновление...' : 'Применить смену подотчетности'}
              </button>
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-xs">
          <span className="text-slate-400">
            Роль: <strong className="text-slate-700 dark:text-slate-300">{currentUser.role}</strong>
          </span>

          {activeTab !== 'admin' && permissions.canEditContent && !isLockedByOther && (
            <button
              type="button"
              onClick={handleSaveContent}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
