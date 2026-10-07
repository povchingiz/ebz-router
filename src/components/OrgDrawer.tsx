import React, { useState, useEffect } from 'react';
import { GovOrg, OrgQuestion, User, ROLE_PERMISSIONS } from '@/types';
import { QuestionModal } from './QuestionModal';
import {
  X,
  Lock,
  Save,
  GitFork,
  Plus,
  Trash2,
  AlertCircle,
  Building2,
  HelpCircle,
  Search,
} from 'lucide-react';

interface OrgDrawerProps {
  org: GovOrg | null;
  allOrgs: GovOrg[];
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSaveContent: (updatedScope: string, updatedQuestions: OrgQuestion[]) => Promise<void>;
  onReparent: (newParentId: string | null) => Promise<void>;
}

export const OrgDrawer: React.FC<OrgDrawerProps> = ({
  org,
  allOrgs,
  currentUser,
  isOpen,
  onClose,
  onSaveContent,
  onReparent,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'questions' | 'admin'>('info');
  const [scope, setScope] = useState('');
  const [questions, setQuestions] = useState<OrgQuestion[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [isAddQuestionModalOpen, setIsAddQuestionModalOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Синхронизация при открытии
  useEffect(() => {
    if (org) {
      setScope(org.scope || '');
      setQuestions(org.questions ? JSON.parse(JSON.stringify(org.questions)) : []);
      setQuestionSearch('');
      setSelectedParentId(org.parentId);
      setStatusMsg(null);
    }
  }, [org]);

  if (!isOpen || !org) return null;

  const permissions = ROLE_PERMISSIONS[currentUser.role];
  const isLockedByOther = org.lockedBy && org.lockedBy.userId !== currentUser.id;
  const parentOrg = allOrgs.find((o) => o.id === org.parentId);

  const handleSaveContent = async () => {
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      await onSaveContent(scope, questions);
      setStatusMsg({ text: 'Изменения успешно сохранены в базе знаний!' });
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
      setStatusMsg({ text: 'Подчиненность ведомства успешно обновлена!' });
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Ошибка смены родителя', error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Редактирование конкретного вопроса
  const updateQuestionField = (id: string, field: keyof OrgQuestion, value: any) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  // Добавление вопроса из модалки
  const handleAddNewQuestion = (newQ: OrgQuestion) => {
    setQuestions((prev) => [newQ, ...prev]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  // Потокеновый поиск вопросов
  const filteredQuestions = questions.filter((q) => {
    if (!questionSearch.trim()) return true;
    const tokens = questionSearch
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    const searchTarget = `${q.topic} ${q.description} ${q.keywords.join(' ')}`.toLowerCase();
    // Каждый токен должен встречаться
    return tokens.every((token) => searchTarget.includes(token));
  });

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
        {/* Затемненный фон */}
        <div
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        />

        {/* Правая панель (Drawer) */}
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <div className="w-screen max-w-xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 animate-slideLeft">
            {/* Шапка сайдбара */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                    Версия карточки: v{org.version}
                  </span>

                  {isLockedByOther && (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 dark:bg-amber-950 px-2.5 py-1 rounded-lg">
                      <Lock className="w-3.5 h-3.5" /> Редактирует: {org.lockedBy?.userName}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  title="Закрыть карточку"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                {org.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {org.fullName}
              </p>

              {parentOrg && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <span className="text-slate-400">Вышестоящий орган:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {parentOrg.name}
                  </span>
                </div>
              )}
            </div>

            {/* Вкладки */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-6 text-sm font-bold bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`py-4 border-b-2 -mb-px flex items-center gap-2 transition-colors ${
                  activeTab === 'info'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                Сфера ведения
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('questions')}
                className={`py-4 border-b-2 -mb-px flex items-center gap-2 transition-colors ${
                  activeTab === 'questions'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                Вопросы и темы ({questions.length})
              </button>

              {permissions.canChangeStructure && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`py-4 border-b-2 -mb-px flex items-center gap-2 transition-colors ${
                    activeTab === 'admin'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <GitFork className="w-4 h-4" />
                  Подчиненность
                </button>
              )}
            </div>

            {/* Содержимое вкладки */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {statusMsg && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
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
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                      Чем занимается ведомство (Полномочия и задачи)
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <textarea
                        rows={6}
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        placeholder="Опишите задачи и сферу ответственности ведомства..."
                        className="w-full p-4 text-sm rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-blue-500 outline-none leading-relaxed"
                      />
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {scope || 'Описание отсутствует.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'questions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    {/* Потокеновый поиск среди вопросов */}
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={questionSearch}
                        onChange={(e) => setQuestionSearch(e.target.value)}
                        placeholder="Поиск по вопросам и ключевым словам..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      />
                    </div>

                    {permissions.canEditContent && !isLockedByOther && (
                      <button
                        type="button"
                        onClick={() => setIsAddQuestionModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all shrink-0"
                      >
                        <Plus className="w-4 h-4" /> Добавить
                      </button>
                    )}
                  </div>

                  {filteredQuestions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                      {questions.length === 0
                        ? 'Вопросы компетенций пока не внесены. Нажмите «Добавить», чтобы закрепить тему за этим ведомством.'
                        : 'По данному поисковому запросу вопросов не найдено.'}
                    </div>
                  ) : (
                    filteredQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="p-4 rounded-2xl border-2 border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                            Вопрос #{idx + 1}
                          </span>
                          {permissions.canEditContent && !isLockedByOther && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(q.id)}
                              className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title="Удалить вопрос"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Поле темы */}
                        {permissions.canEditContent && !isLockedByOther ? (
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">
                              Тема / Наименование вопроса:
                            </label>
                            <input
                              type="text"
                              value={q.topic}
                              onChange={(e) => updateQuestionField(q.id, 'topic', e.target.value)}
                              className="w-full p-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none"
                              placeholder="Название темы..."
                            />
                          </div>
                        ) : (
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {q.topic}
                          </h4>
                        )}

                        {/* Поле описания */}
                        {permissions.canEditContent && !isLockedByOther ? (
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">
                              Суть вопроса и типовые жалобы:
                            </label>
                            <textarea
                              rows={3}
                              value={q.description}
                              onChange={(e) => updateQuestionField(q.id, 'description', e.target.value)}
                              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none leading-relaxed"
                              placeholder="Опишите, о чем пишут граждане по этому вопросу..."
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {q.description}
                          </p>
                        )}

                        {/* Ключевые слова */}
                        {permissions.canEditContent && !isLockedByOther ? (
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">
                              Ключевые слова (через запятую):
                            </label>
                            <input
                              type="text"
                              value={q.keywords.join(', ')}
                              onChange={(e) =>
                                updateQuestionField(
                                  q.id,
                                  'keywords',
                                  e.target.value
                                    .split(',')
                                    .map((k) => k.trim())
                                    .filter(Boolean)
                                )
                              }
                              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none"
                              placeholder="свет, тариф, отключение..."
                            />
                          </div>
                        ) : (
                          q.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {q.keywords.map((kw, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          )
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'admin' && permissions.canChangeStructure && (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
                    Изменение подчиненности перестраивает положение ведомства в иерархическом дереве.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-2">
                      Выбрать новый вышестоящий орган:
                    </label>
                    <select
                      value={selectedParentId || ''}
                      onChange={(e) => setSelectedParentId(e.target.value || null)}
                      className="w-full p-3.5 text-xs font-bold rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-blue-500 outline-none cursor-pointer"
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
                    className="w-full py-3.5 px-4 rounded-2xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md disabled:opacity-50"
                  >
                    {isSubmitting ? 'Обновление...' : 'Применить переподчинение'}
                  </button>
                </div>
              )}
            </div>

            {/* Футер сайдбара */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-semibold">
                Роль: <strong className="text-slate-900 dark:text-white">{currentUser.role}</strong>
              </span>

              {activeTab !== 'admin' && permissions.canEditContent && !isLockedByOther && (
                <button
                  type="button"
                  onClick={handleSaveContent}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно создания вопроса */}
      <QuestionModal
        isOpen={isAddQuestionModalOpen}
        onClose={() => setIsAddQuestionModalOpen(false)}
        onSave={handleAddNewQuestion}
      />
    </>
  );
};
