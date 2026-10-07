import React, { useState, useEffect, useMemo } from 'react';
import { GovOrg, OrgQuestion, User, ROLE_PERMISSIONS, JurisdictionLevel } from '@/types';
import { QuestionModal } from './QuestionModal';
import { QuestionCsvModal } from './QuestionCsvModal';
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
  Table,
  LayoutGrid,
  MapPin,
  Globe,
  Scale,
  FileText,
  Check,
  ChevronRight,
  ShieldCheck,
  Minimize2,
  FileSpreadsheet,
} from 'lucide-react';

interface OrgDrawerProps {
  org: GovOrg | null;
  allOrgs: GovOrg[];
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSaveContent: (updatedData: {
    scope: string;
    theme?: string;
    locationAddress?: string;
    jurisdiction?: JurisdictionLevel;
    legalBasis?: string;
    questions: OrgQuestion[];
  }) => Promise<void>;
  onReparent: (newParentId: string | null) => Promise<void>;
}

const JURISDICTION_OPTIONS: {
  value: JurisdictionLevel;
  label: string;
  badge: string;
  description: string;
  color: string;
}[] = [
  {
    value: 'republican',
    label: 'Республиканский / Общегосударственный',
    badge: 'РК (Все государство)',
    description: 'Орган оказывает глобальное влияние на всю страну (министерства, агентства, комитеты)',
    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  },
  {
    value: 'regional',
    label: 'Областной / Региональный',
    badge: 'Область / Мегаполис',
    description: 'Полномочия ограничены одной областью или городом респ. значения (Астана, Алматы, Шымкент)',
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  },
  {
    value: 'district',
    label: 'Районный / Городской',
    badge: 'Район / Город',
    description: 'Компетенции в пределах конкретного административного района или города областного значения',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  },
  {
    value: 'local',
    label: 'Сельский / Локальный',
    badge: 'Округ / Поселок',
    description: 'Аппараты акимов сельских округов, поселков, локальные организации обслуживания',
    color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  },
];

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

  // Поля сведений
  const [scope, setScope] = useState('');
  const [theme, setTheme] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [jurisdiction, setJurisdiction] = useState<JurisdictionLevel>('republican');
  const [legalBasis, setLegalBasis] = useState('');

  // Вопросы
  const [questions, setQuestions] = useState<OrgQuestion[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionsViewMode, setQuestionsViewMode] = useState<'cards' | 'table'>('cards');
  const [isAddQuestionModalOpen, setIsAddQuestionModalOpen] = useState(false);
  const [isCsvQuestionModalOpen, setIsCsvQuestionModalOpen] = useState(false);

  // Подчиненность
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [parentSearchQuery, setParentSearchQuery] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Синхронизация при открытии карточки
  useEffect(() => {
    if (org) {
      setScope(org.scope || '');
      setTheme(org.theme || '');
      setLocationAddress(org.locationAddress || '');
      setJurisdiction(org.jurisdiction || (org.level === 'regional' ? 'regional' : org.level === 'district' ? 'district' : 'republican'));
      setLegalBasis(org.legalBasis || '');
      setQuestions(org.questions ? JSON.parse(JSON.stringify(org.questions)) : []);
      setQuestionSearch('');
      setSelectedParentId(org.parentId);
      setParentSearchQuery('');
      setStatusMsg(null);
    }
  }, [org]);

  // Потокеновый поиск вопросов
  const filteredQuestions = useMemo(() => {
    if (!org || !questionSearch.trim()) return questions;
    const tokens = questionSearch
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    return questions.filter((q) => {
      const searchTarget = `${q.topic} ${q.description} ${(q.keywords || []).join(' ')}`.toLowerCase();
      return tokens.every((token) => searchTarget.includes(token));
    });
  }, [org, questions, questionSearch]);

  // Фильтрация организаций для смены родителя (потокеновый автокомплит)
  const filteredParentCandidates = useMemo(() => {
    if (!org) return [];
    const list = allOrgs.filter((o) => o.id !== org.id);
    if (!parentSearchQuery.trim()) return list.slice(0, 8);
    const tokens = parentSearchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    return list
      .filter((o) => {
        const target = `${o.name} ${o.fullName}`.toLowerCase();
        return tokens.every((token) => target.includes(token));
      })
      .slice(0, 15);
  }, [allOrgs, org, parentSearchQuery]);

  if (!isOpen || !org) return null;

  const permissions = ROLE_PERMISSIONS[currentUser.role];
  const isLockedByOther = org.lockedBy && org.lockedBy.userId !== currentUser.id;
  const parentOrg = allOrgs.find((o) => o.id === org.parentId);
  const candidateParent = allOrgs.find((o) => o.id === selectedParentId);

  const handleSaveContent = async () => {
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      await onSaveContent({
        scope,
        theme,
        locationAddress,
        jurisdiction,
        legalBasis,
        questions,
      });
      setStatusMsg({ text: 'Сведения и компетенции ведомства успешно сохранены!' });
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
      setStatusMsg({ text: 'Иерархия подчиненности успешно изменена в структуре!' });
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Ошибка смены подчинения', error: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Редактирование вопроса
  const updateQuestionField = (id: string, field: keyof OrgQuestion, value: any) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const handleAddNewQuestion = (newQ: OrgQuestion) => {
    setQuestions((prev) => [newQ, ...prev]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  return (
    <>
      {/* 
        Интерактивная боковая панель без блокирующего затемнения (No dark backdrop)!
        Пользователь может свободно перемещать и масштабировать граф слева,
        одновременно изучая и редактируя карточку справа.
      */}
      <aside
        aria-label="Сведения об организации"
        className="fixed top-20 right-4 bottom-4 z-40 w-[95vw] sm:w-[540px] lg:w-[580px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-slideLeft transition-all"
      >
        {/* Шапка карточки */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                v{org.version}
              </span>

              {isLockedByOther && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-lg">
                  <Lock className="w-3 h-3" /> {org.lockedBy?.userName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                title="Скрыть панель сведений"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {org.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
            {org.fullName}
          </p>

          {parentOrg && (
            <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium bg-blue-50/50 dark:bg-blue-950/40 p-2 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <span className="text-slate-400">Вышестоящий орган:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {parentOrg.name}
              </span>
            </div>
          )}
        </div>

        {/* Навигационные вкладки */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 gap-4 text-xs font-bold bg-white dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`py-3.5 border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Компетенции и статус
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`py-3.5 border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
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
              className={`py-3.5 border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
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

        {/* Содержимое панели со скроллом */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {statusMsg && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                statusMsg.error
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {statusMsg.text}
            </div>
          )}

          {/* ВКЛАДКА 1: Компетенции и статус */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Объединенная секция: Полномочия, задачи и компетенции ведомства */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Полномочия, задачи и компетенции ведомства</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Сфера ответственности, типовые вопросы, предметная тематика обращений граждан и задачи органа.
                </p>
                {permissions.canEditContent && !isLockedByOther ? (
                  <textarea
                    rows={6}
                    value={scope || theme}
                    onChange={(e) => {
                      setScope(e.target.value);
                      setTheme(e.target.value);
                    }}
                    placeholder="Например: выработка государственной политики в сфере недропользования, вопросы тарифов ЖКХ, контроль лицензирования, рассмотрение обращений граждан..."
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none leading-relaxed"
                  />
                ) : (
                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed whitespace-pre-wrap">
                    {scope || theme || 'Полномочия и компетенции не указаны.'}
                  </div>
                )}
              </div>

              {/* Временно скрыто: Зона ответственности (Масштаб юрисдикции)
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  <span>Зона ответственности (Масштаб юрисдикции)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Территориальный уровень охвата и действия компетенций ведомства.
                </p>
                {permissions.canEditContent && !isLockedByOther ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {JURISDICTION_OPTIONS.map((opt) => {
                      const isSelected = jurisdiction === opt.value;
                      return (
                        <div
                          key={opt.value}
                          onClick={() => setJurisdiction(opt.value)}
                          className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 shadow-xs'
                              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-black text-slate-900 dark:text-white">
                              {opt.badge}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </div>
                          <span className="text-[10px] text-slate-500 leading-tight">
                            {opt.description}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="pt-1">
                    {(() => {
                      const currentOpt = JURISDICTION_OPTIONS.find((o) => o.value === jurisdiction) || JURISDICTION_OPTIONS[0];
                      return (
                        <div className={`p-3 rounded-xl border ${currentOpt.color} text-xs font-bold flex items-center justify-between`}>
                          <span>{currentOpt.label}</span>
                          <span className="text-[10px] font-normal opacity-80">{currentOpt.badge}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              */}

              {/* Секция: Фактическое местонахождение (Локация) */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>Фактическое местонахождение (Локация)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Город и фактический адрес главного аппарата ведомства.
                </p>
                {permissions.canEditContent && !isLockedByOther ? (
                  <input
                    type="text"
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    placeholder="Например: г. Астана, пр. Мангилик Ел, 8, Дом Министерств"
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none font-medium"
                  />
                ) : (
                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    {locationAddress || 'Адрес местонахождения не указан.'}
                  </div>
                )}
              </div>

              {/* Временно скрыто: Нормативно-правовая база
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <Scale className="w-4 h-4 text-purple-600" />
                  <span>Нормативно-правовая база</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Указ Президента, закон или положение, регламентирующие деятельность органа.
                </p>
                {permissions.canEditContent && !isLockedByOther ? (
                  <input
                    type="text"
                    value={legalBasis}
                    onChange={(e) => setLegalBasis(e.target.value)}
                    placeholder="Например: Положение утверждено Постановлением Правительства РК от..."
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none font-medium"
                  />
                ) : (
                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    {legalBasis || 'Правовые основания не указаны.'}
                  </div>
                )}
              </div>
              */}
            </div>
          )}

          {/* ВКЛАДКА 2: Вопросы и темы */}
          {activeTab === 'questions' && (
            <div className="space-y-4">
              {/* Панель поиска и переключения вида (Карточки / Таблица) */}
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    placeholder="Потокеновый поиск по темам и ключевым словам..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>

                {/* Переключатель Карточки / Таблица */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuestionsViewMode('cards')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      questionsViewMode === 'cards'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Вид карточками"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionsViewMode('table')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      questionsViewMode === 'table'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                        : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Вид таблицей"
                  >
                    <Table className="w-3.5 h-3.5" />
                  </button>
                </div>

                {permissions.canEditContent && !isLockedByOther && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsCsvQuestionModalOpen(true)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all"
                      title="Импорт вопросов и ответов из CSV файла или таблицы"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Импорт CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddQuestionModalOpen(true)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Добавить
                    </button>
                  </div>
                )}
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  {questions.length === 0
                    ? 'Вопросы компетенций пока не внесены. Нажмите «Добавить», чтобы закрепить темы за ведомством.'
                    : 'По данному запросу вопросов не найдено.'}
                </div>
              ) : questionsViewMode === 'table' ? (
                /* ТАБЛИЧНЫЙ ВИД */
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      <tr>
                        <th className="p-2.5 w-8">#</th>
                        <th className="p-2.5">Тема вопроса</th>
                        <th className="p-2.5">Суть / Жалобы</th>
                        <th className="p-2.5">Теги</th>
                        {permissions.canEditContent && !isLockedByOther && <th className="p-2.5 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredQuestions.map((q, idx) => (
                        <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                          <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white min-w-[140px]">
                            {permissions.canEditContent && !isLockedByOther ? (
                              <input
                                type="text"
                                value={q.topic}
                                onChange={(e) => updateQuestionField(q.id, 'topic', e.target.value)}
                                className="w-full p-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                              />
                            ) : (
                              q.topic
                            )}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300 min-w-[180px]">
                            {permissions.canEditContent && !isLockedByOther ? (
                              <textarea
                                rows={2}
                                value={q.description}
                                onChange={(e) => updateQuestionField(q.id, 'description', e.target.value)}
                                className="w-full p-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                              />
                            ) : (
                              q.description
                            )}
                          </td>
                          <td className="p-2.5">
                            <div className="flex flex-wrap gap-1">
                              {q.keywords.map((kw, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600">
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          </td>
                          {permissions.canEditContent && !isLockedByOther && (
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => removeQuestion(q.id)}
                                className="text-slate-400 hover:text-rose-500 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* КАРТОЧНЫЙ ВИД */
                filteredQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-2xl border-2 border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-blue-600 dark:text-blue-400">
                        Вопрос #{idx + 1}
                      </span>
                      {permissions.canEditContent && !isLockedByOther && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(q.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {permissions.canEditContent && !isLockedByOther ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">
                          Тема / Компетенция:
                        </label>
                        <input
                          type="text"
                          value={q.topic}
                          onChange={(e) => updateQuestionField(q.id, 'topic', e.target.value)}
                          className="w-full p-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none"
                        />
                      </div>
                    ) : (
                      <h4 className="text-xs font-black text-slate-900 dark:text-white">
                        {q.topic}
                      </h4>
                    )}

                    {permissions.canEditContent && !isLockedByOther ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">
                          Суть обращения и типовые жалобы:
                        </label>
                        <textarea
                          rows={2}
                          value={q.description}
                          onChange={(e) => updateQuestionField(q.id, 'description', e.target.value)}
                          className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none leading-relaxed"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {q.description}
                      </p>
                    )}

                    {permissions.canEditContent && !isLockedByOther ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">
                          Ключевые слова (через запятую):
                        </label>
                        <input
                          type="text"
                          value={q.keywords.join(', ')}
                          onChange={(e) =>
                            updateQuestionField(
                              q.id,
                              'keywords',
                              e.target.value.split(',').map((k) => k.trim()).filter(Boolean)
                            )
                          }
                          className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none"
                        />
                      </div>
                    ) : (
                      q.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
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

          {/* ВКЛАДКА 3: Подчиненность (Смена родителя с потокеновым автокомплитом) */}
          {activeTab === 'admin' && permissions.canChangeStructure && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed font-medium">
                Перепривязка родителя изменит положение ведомства в графе структуры. Дочерние ведомства переместятся вместе с ним.
              </div>

              {/* Текущий родитель */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500 block mb-1">Текущий вышестоящий орган:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {parentOrg ? `${parentOrg.name} (${parentOrg.fullName})` : '— Корневой уровень (Без родителя)'}
                </span>
              </div>

              {/* Потокеновый выбор нового родителя */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Поиск нового вышестоящего органа:
                </label>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={parentSearchQuery}
                    onChange={(e) => setParentSearchQuery(e.target.value)}
                    placeholder="Начните вводить название (АРРФР, Минэнерго, АП)..."
                    className="w-full pl-9 pr-3 py-2.5 text-xs font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none"
                  />
                </div>

                {/* Быстрая кнопка "Корневой уровень" */}
                <div
                  onClick={() => setSelectedParentId(null)}
                  className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between text-xs font-bold ${
                    selectedParentId === null
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span>(Без родителя / Корневой высший орган)</span>
                  {selectedParentId === null && <Check className="w-4 h-4 text-indigo-600" />}
                </div>

                {/* Список подходящих органов */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {filteredParentCandidates.map((cand) => {
                    const isSelected = selectedParentId === cand.id;
                    return (
                      <div
                        key={cand.id}
                        onClick={() => setSelectedParentId(cand.id)}
                        className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 shadow-xs'
                            : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {cand.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {cand.fullName}
                          </div>
                        </div>

                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Кнопка подтверждения смены подчиненности */}
              <button
                type="button"
                onClick={handleReparent}
                disabled={isSubmitting || selectedParentId === org.parentId}
                className="w-full py-3 px-4 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md disabled:opacity-40"
              >
                {isSubmitting
                  ? 'Применение изменений...'
                  : selectedParentId === org.parentId
                  ? 'Родитель не изменен'
                  : `Подчинить органу: ${candidateParent ? candidateParent.name : 'Корневой уровень'}`}
              </button>
            </div>
          )}
        </div>

        {/* Футер карточки с кнопкой Сохранить */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-semibold">
            Роль: <strong className="text-slate-900 dark:text-white">{currentUser.role}</strong>
          </span>

          {activeTab !== 'admin' && permissions.canEditContent && !isLockedByOther && (
            <button
              type="button"
              onClick={handleSaveContent}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </button>
          )}
        </div>
      </aside>

      {/* Модальное окно создания вопроса */}
      <QuestionModal
        isOpen={isAddQuestionModalOpen}
        onClose={() => setIsAddQuestionModalOpen(false)}
        onSave={handleAddNewQuestion}
      />

      {/* Модальное окно CSV импорта вопросов */}
      <QuestionCsvModal
        isOpen={isCsvQuestionModalOpen}
        onClose={() => setIsCsvQuestionModalOpen(false)}
        onImport={(importedQuestions) => {
          setQuestions((prev) => [...importedQuestions, ...prev]);
        }}
      />
    </>
  );
};
