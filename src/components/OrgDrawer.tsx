import React, { useState, useEffect, useMemo } from 'react';
import { GovOrg, OrgQuestion, User, ROLE_PERMISSIONS, JurisdictionLevel } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { QuestionModal } from './QuestionModal';
import { QuestionCsvModal } from './QuestionCsvModal';
import { CreateChildOrgModal } from './CreateChildOrgModal';
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
  Edit3,
  CheckCircle2,
  Phone,
  Mail,
  Ban,
  PhoneCall,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';

interface OrgDrawerProps {
  org: GovOrg | null;
  allOrgs: GovOrg[];
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSaveContent: (updatedData: {
    name?: string;
    fullName?: string;
    orgNameKk?: string;
    shortNameKk?: string;
    scope: string;
    theme?: string;
    locationAddress?: string;
    jurisdiction?: JurisdictionLevel;
    legalBasis?: string;
    competenciesExcluded?: string;
    forwardToGuidance?: string;
    showOnFrontend?: boolean;
    contacts?: {
      phoneHotline?: string;
      phoneChancellery?: string;
      emailOfficial?: string;
      websiteUrl?: string;
      physicalAddress?: string;
    };
    questions: OrgQuestion[];
    status?: 'unfilled' | 'llm_check' | 'human_review' | 'verified' | 'in_progress';
    katoCode?: string;
    katoNameRu?: string;
    locationId?: string;
    hasHumanTouch?: boolean;
    llmNotes?: string;
  }) => Promise<void>;
  onReparent: (newParentId: string | null) => Promise<void>;
  onCreateOrg?: (newOrgData: {
    name: string;
    fullName: string;
    parentId: string | null;
    scope: string;
    locationAddress: string;
    jurisdiction: JurisdictionLevel;
  }) => Promise<void>;
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

export const KATO_REGIONS = [
  { code: '710000000', name: 'г. Астана', type: 'REPUBLIC_CITY' },
  { code: '750000000', name: 'г. Алматы', type: 'REPUBLIC_CITY' },
  { code: '790000000', name: 'г. Шымкент', type: 'REPUBLIC_CITY' },
  { code: '110000000', name: 'Акмолинская область', type: 'REGION' },
  { code: '150000000', name: 'Актюбинская область', type: 'REGION' },
  { code: '190000000', name: 'Алматинская область', type: 'REGION' },
  { code: '230000000', name: 'Атырауская область', type: 'REGION' },
  { code: '270000000', name: 'Западно-Казахстанская область', type: 'REGION' },
  { code: '310000000', name: 'Жамбылская область', type: 'REGION' },
  { code: '350000000', name: 'Карагандинская область', type: 'REGION' },
  { code: '390000000', name: 'Костанайская область', type: 'REGION' },
  { code: '430000000', name: 'Кызылординская область', type: 'REGION' },
  { code: '470000000', name: 'Мангистауская область', type: 'REGION' },
  { code: '550000000', name: 'Павлодарская область', type: 'REGION' },
  { code: '590000000', name: 'Северо-Казахстанская область', type: 'REGION' },
  { code: '610000000', name: 'Туркестанская область', type: 'REGION' },
  { code: '630000000', name: 'Восточно-Казахстанская область', type: 'REGION' },
  { code: '100000000', name: 'область Абай', type: 'REGION' },
  { code: '330000000', name: 'область Жетісу', type: 'REGION' },
  { code: '620000000', name: 'область Ұлытау', type: 'REGION' },
];

export const OrgDrawer: React.FC<OrgDrawerProps> = ({
  org,
  allOrgs,
  currentUser,
  isOpen,
  onClose,
  onSaveContent,
  onReparent,
  onCreateOrg,
}) => {
  const { user: authUser, canManageOrg } = useAuth();
  const [activeTab, setActiveTab] = useState<'router' | 'ebz' | 'info' | 'admin' | 'competencies' | 'questions'>('router');

  // Наименования
  const [orgName, setOrgName] = useState('');
  const [orgFullName, setOrgFullName] = useState('');
  const [orgNameKk, setOrgNameKk] = useState('');
  const [shortNameKk, setShortNameKk] = useState('');
  const [isEditingNames, setIsEditingNames] = useState(false);

  // Поля сведений
  const [scope, setScope] = useState('');
  const [theme, setTheme] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [katoCode, setKatoCode] = useState('');
  const [jurisdiction, setJurisdiction] = useState<JurisdictionLevel>('republican');
  const [legalBasis, setLegalBasis] = useState('');

  // Жизненный цикл верификации данных
  const [verificationStatus, setVerificationStatus] = useState<'unfilled' | 'llm_check' | 'human_review' | 'verified'>('unfilled');
  const [isLlmTesting, setIsLlmTesting] = useState(false);

  // Исключения компетенций (Схема knowledge)
  const [competenciesExcluded, setCompetenciesExcluded] = useState('');
  const [forwardToGuidance, setForwardToGuidance] = useState('');
  const [showOnFrontend, setShowOnFrontend] = useState(true);

  // Контакты и реквизиты (Схема knowledge)
  const [phoneHotline, setPhoneHotline] = useState('');
  const [phoneChancellery, setPhoneChancellery] = useState('');
  const [emailOfficial, setEmailOfficial] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');

  // Вопросы
  const [questions, setQuestions] = useState<OrgQuestion[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionsViewMode, setQuestionsViewMode] = useState<'cards' | 'table'>('cards');
  const [isAddQuestionModalOpen, setIsAddQuestionModalOpen] = useState(false);
  const [isCsvQuestionModalOpen, setIsCsvQuestionModalOpen] = useState(false);
  const [isCreateChildModalOpen, setIsCreateChildModalOpen] = useState(false);

  // Подотчетность
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [parentSearchQuery, setParentSearchQuery] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Синхронизация при открытии карточки
  useEffect(() => {
    if (org) {
      setOrgName(org.name || '');
      setOrgFullName(org.fullName || '');
      setOrgNameKk(org.orgNameKk || '');
      setShortNameKk(org.shortNameKk || '');
      setIsEditingNames(false);
      setScope(org.scope || '');
      setTheme(org.theme || '');
      setLocationAddress(org.locationAddress || '');
      setKatoCode(org.katoCode || '');
      const initStatus = (org.status as any) === 'verified'
        ? 'verified'
        : (org.status as any) === 'llm_check'
        ? 'llm_check'
        : (org.status as any) === 'human_review' || (org.status as any) === 'in_progress'
        ? 'human_review'
        : org.hasHumanTouch
        ? 'human_review'
        : 'unfilled';
      setVerificationStatus(initStatus);
      
      // Автоматическое предзаполнение масштаба юрисдикции по структуре органа
      let resolvedJurisdiction: JurisdictionLevel = 'republican';
      if (org.jurisdiction) {
        resolvedJurisdiction = org.jurisdiction;
      } else if (org.level === 'central' || org.level === 'agency') {
        resolvedJurisdiction = 'republican';
      } else if (org.level === 'regional') {
        resolvedJurisdiction = 'regional';
      } else if ((org.name || org.fullName || '').toLowerCase().includes('сельск') || (org.name || org.fullName || '').toLowerCase().includes('посел')) {
        resolvedJurisdiction = 'local';
      } else {
        resolvedJurisdiction = 'district';
      }
      setJurisdiction(resolvedJurisdiction);

      setLegalBasis(org.legalBasis || '');
      setCompetenciesExcluded(org.competenciesExcluded || '');
      setForwardToGuidance(org.forwardToGuidance || '');
      setShowOnFrontend(org.showOnFrontend !== false);
      setPhoneHotline(org.contacts?.phoneHotline || '');
      setPhoneChancellery(org.contacts?.phoneChancellery || '');
      setEmailOfficial(org.contacts?.emailOfficial || '');
      setWebsiteUrl(org.contacts?.websiteUrl || '');
      setPhysicalAddress(org.contacts?.physicalAddress || org.locationAddress || '');
      setQuestions(org.questions ? JSON.parse(JSON.stringify(org.questions)) : []);
      setQuestionSearch('');
      setSelectedParentId(org.parentId);
      setParentSearchQuery('');
      setStatusMsg(null);
    }
  }, [org]);

  // Список прямых подотчетных (детей)
  const directChildren = useMemo(() => {
    if (!org) return [];
    return allOrgs.filter((o) => o.parentId === org.id);
  }, [allOrgs, org]);

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

  // Все потомки текущей организации (дети, внуки и т.д.), чтобы исключить циклы в иерархии
  const descendantIds = useMemo(() => {
    if (!org) return new Set<string>();
    const descendants = new Set<string>();
    const queue = [org.id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const item of allOrgs) {
        if (item.parentId === currentId && !descendants.has(item.id)) {
          descendants.add(item.id);
          queue.push(item.id);
        }
      }
    }
    return descendants;
  }, [allOrgs, org]);

  // Фильтрация организаций для смены родителя (исключаем саму организацию и ВСЕХ её потомков)
  const filteredParentCandidates = useMemo(() => {
    if (!org) return [];
    // Исключаем саму организацию и всех её прямых и косвенных потомков (дочки, внуки)
    const list = allOrgs.filter((o) => o.id !== org.id && !descendantIds.has(o.id));
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
  }, [allOrgs, org, descendantIds, parentSearchQuery]);

  if (!isOpen || !org) return null;

  const access = canManageOrg(org.id, allOrgs);
  const effectiveUserId = authUser?.userId || currentUser.id;
  const isLockedByOther = org.lockedBy && org.lockedBy.userId !== effectiveUserId;

  const permissions = {
    canEditContent: access.allowed && !isLockedByOther,
    canChangeStructure: access.allowed && !isLockedByOther,
  };

  const isSuperAdminOwner = Boolean(
    authUser?.username === 'superadmin' ||
    authUser?.role === 'GLOBAL_ADMIN' ||
    currentUser.id === 'user-admin' ||
    currentUser.id === 'admin_ap' ||
    currentUser.role === 'superadmin'
  );
  const parentOrg = allOrgs.find((o) => o.id === org.parentId);
  const candidateParent = allOrgs.find((o) => o.id === selectedParentId);

  const handleSaveContent = async () => {
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      await onSaveContent({
        name: orgName,
        fullName: orgFullName,
        orgNameKk,
        shortNameKk,
        scope,
        theme,
        locationAddress,
        katoCode,
        jurisdiction,
        status: verificationStatus === 'unfilled' ? 'llm_check' : verificationStatus,
        hasHumanTouch: true,
        legalBasis,
        competenciesExcluded,
        forwardToGuidance,
        showOnFrontend,
        contacts: {
          phoneHotline,
          phoneChancellery,
          emailOfficial,
          websiteUrl,
          physicalAddress: locationAddress,
        },
        questions,
      });
      setIsEditingNames(false);
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
      setStatusMsg({ text: 'Иерархия подотчетности успешно изменена в структуре!' });
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Ошибка смены подотчетности', error: true });
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

              {permissions.canChangeStructure && onCreateOrg && (
                <button
                  type="button"
                  onClick={() => setIsCreateChildModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white transition-all shadow-xs"
                  title="Создать подотчетную организацию под этим ведомством"
                >
                  <Plus className="w-3.5 h-3.5" /> Создать дочку
                </button>
              )}

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

          {permissions.canChangeStructure && isEditingNames ? (
            <div className="space-y-1.5 my-1.5 p-2.5 rounded-2xl bg-blue-50/50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Редактирование названий органа:</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Краткое наименование"
                className="w-full p-2 text-sm font-black rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none"
              />
              <input
                type="text"
                value={orgFullName}
                onChange={(e) => setOrgFullName(e.target.value)}
                placeholder="Полное официальное наименование"
                className="w-full p-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none"
              />
            </div>
          ) : (
            <div className="group relative mt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {orgName || org.name}
                </h2>
                {/* Светофор статуса заполненности */}
                {org.status === 'unfilled' || (!org.hasHumanTouch && org.level !== 'central') ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    Требует заполнения (0%)
                  </span>
                ) : org.status === 'in_progress' ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Заполненность {org.completenessScore || 65}%
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Заполненность 100%
                  </span>
                )}
                {org.aliases && org.aliases.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {org.aliases.slice(0, 3).map((alias, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                )}
                {permissions.canChangeStructure && (
                  <button
                    type="button"
                    onClick={() => setIsEditingNames(true)}
                    className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Переименовать организацию"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                {orgFullName || org.fullName}
              </p>
            </div>
          )}

          {parentOrg && (
            <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium bg-blue-50/50 dark:bg-blue-950/40 p-2 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <span className="text-slate-400">Вышестоящий орган:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {parentOrg.name}
              </span>
            </div>
          )}

          {/* Переключатель видимости на платформе (show_on_frontend) */}
          <div className="flex items-center justify-between mt-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center gap-2">
              {showOnFrontend ? (
                <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              )}
              <div>
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  {showOnFrontend ? 'Отображается на платформе онлайн' : 'Скрыто с платформы онлайн'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {showOnFrontend ? 'Организация активна в графе и поиске' : 'Временно отключено от показа пользователям'}
                </div>
              </div>
            </div>
            {permissions.canChangeStructure && (
              <button
                type="button"
                onClick={() => setShowOnFrontend(!showOnFrontend)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showOnFrontend ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                title="Переключить видимость на платформе"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    showOnFrontend ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Баннер ведомственной юрисдикции при ограничении прав */}
        {!access.allowed && (
          <div className="mx-5 mt-3 p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 shrink-0">
            <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-black">Режим просмотра:</span>{' '}
              <span className="font-medium opacity-90">{access.reason}</span>
            </div>
          </div>
        )}

        {/* Статус проверки (4 этапа жизненного цикла данных) */}
        <div className="mx-5 mt-2.5 p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs shrink-0 transition-all bg-slate-50/70 dark:bg-slate-850 border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            {verificationStatus === 'verified' ? (
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0" />
            ) : verificationStatus === 'human_review' ? (
              <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0" />
            ) : verificationStatus === 'llm_check' ? (
              <span className="w-3.5 h-3.5 rounded-full bg-pink-500 animate-pulse shrink-0" />
            ) : (
              <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0" />
            )}
            <div>
              <div className="font-black text-xs flex items-center gap-1.5 text-slate-900 dark:text-white">
                <span>Статус ведомства:</span>
                {verificationStatus === 'verified' ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">🟢 Верифицировано (ИИ + Человек)</span>
                ) : verificationStatus === 'human_review' ? (
                  <span className="text-amber-600 dark:text-amber-400 font-black">🟡 Ожидает верификации человеком</span>
                ) : verificationStatus === 'llm_check' ? (
                  <span className="text-pink-600 dark:text-pink-400 font-black">🌸 Проверка ИИ (валидация LLM)</span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 font-black">🔴 Не проверено (исходный импорт)</span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {verificationStatus === 'verified'
                  ? 'Сведения верифицированы LLM и утверждены оператором'
                  : verificationStatus === 'human_review'
                  ? 'Проверка LLM пройдена, ожидается окончательное подтверждение человеком'
                  : verificationStatus === 'llm_check'
                  ? 'Человек дополнил сведения, запущен анализ адекватности нейросетью'
                  : 'Сведения предзаполнены нами автоматически, человек не редактировал'}
              </div>
            </div>
          </div>

          {permissions.canEditContent && !isLockedByOther && (
            <div className="flex items-center gap-1.5 shrink-0">
              {verificationStatus === 'unfilled' && (
                <button
                  type="button"
                  onClick={() => setVerificationStatus('llm_check')}
                  className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-pink-50 hover:bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800 transition-all"
                  title="Отправить дополненные сведения на проверку нейросетью"
                >
                  ⚡ Проверить в ИИ
                </button>
              )}
              {verificationStatus === 'llm_check' && (
                <button
                  type="button"
                  onClick={() => setVerificationStatus('human_review')}
                  className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-all"
                  title="Подтвердить успешность проверки ИИ и направить человеку"
                >
                  ✓ ИИ одобрено
                </button>
              )}
              {(verificationStatus === 'human_review' || verificationStatus === 'llm_check') && (
                <button
                  type="button"
                  onClick={() => setVerificationStatus('verified')}
                  className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all"
                  title="Утвердить и верифицировать карточку"
                >
                  ✓ Утвердить
                </button>
              )}
            </div>
          )}
        </div>

        {/* Навигационные вкладки */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 gap-4 text-xs font-bold bg-white dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('router')}
            className={`py-3.5 border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
              activeTab === 'router' || activeTab === 'competencies'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Для маршрутизатора
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ebz')}
            className={`py-3.5 border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
              activeTab === 'ebz' || activeTab === 'questions'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Для ЕБЗ ({questions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`py-3.5 border-b-2 -mb-px flex items-center gap-1.5 transition-colors ${
              activeTab === 'info'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Информация
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
              Подчинение и структура
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

          {/* ВКЛАДКА 1: Для маршрутизатора */}
          {(activeTab === 'router' || activeTab === 'competencies') && (
            <div className="space-y-4">
              {/* 1. Тематика и сфера деятельности (для ИИ-маршрутизатора) */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Тематика и сфера деятельности (для маршрутизатора)</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Отраслевая сфера и предметные задачи ведомства, используемые ИИ-маршрутизатором для автоматического распределения обращений граждан.
                </p>
                {permissions.canEditContent && !isLockedByOther ? (
                  <textarea
                    rows={5}
                    value={scope || theme}
                    onChange={(e) => {
                      setScope(e.target.value);
                      setTheme(e.target.value);
                    }}
                    placeholder="Укажите отраслевую сферу и предметные задачи ведомства для маршрутизатора обращений..."
                    className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none leading-relaxed"
                  />
                ) : (
                  <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed whitespace-pre-wrap">
                    {scope || theme || 'Сфера деятельности не указана.'}
                  </div>
                )}
              </div>

              {/* 2. НАД масштабом юрисдикции: Город / Регион расположения */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>Город / Регион расположения</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Для региональной маршрутизации</span>
                </div>

                <div className="space-y-3">
                  {/* Выбор города / региона */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Выберите город или область:
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <select
                        value={katoCode}
                        onChange={(e) => {
                          const val = e.target.value;
                          setKatoCode(val);
                          const selected = KATO_REGIONS.find((r) => r.code === val);
                          if (selected) {
                            setLocationAddress(selected.name);
                            setPhysicalAddress(selected.name);
                          }
                        }}
                        className="w-full mt-1 p-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500 outline-none cursor-pointer"
                      >
                        <option value="">-- Выберите город или область --</option>
                        {KATO_REGIONS.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-1 p-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white">
                        {KATO_REGIONS.find((r) => r.code === katoCode)?.name || locationAddress || 'Не указан'}
                      </div>
                    )}
                  </div>

                  {/* Фактический адрес (улица, дом - опционально) */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Фактический адрес (улица, здание):
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <input
                        type="text"
                        value={locationAddress}
                        onChange={(e) => {
                          setLocationAddress(e.target.value);
                          setPhysicalAddress(e.target.value);
                        }}
                        placeholder="Например: пр. Мәңгілік Ел, 8"
                        className="w-full mt-1 p-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                      />
                    ) : (
                      <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mt-1">
                        {locationAddress || physicalAddress || 'Адрес не указан'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Масштаб юрисдикции (компактный выпадающий список) */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                    <Globe className="w-4 h-4 text-teal-600" />
                    <span>Масштаб юрисдикции</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Предзаполнено</span>
                </div>
                {permissions.canEditContent && !isLockedByOther ? (
                  <select
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value as JurisdictionLevel)}
                    className="w-full p-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500 outline-none cursor-pointer"
                  >
                    <option value="republican">Республиканский (министерства, агентства, комитеты)</option>
                    <option value="regional">Областной / Региональный (г. Астана, г. Алматы, г. Шымкент, области)</option>
                    <option value="district">Районный / Городской (города обл. значения, административные районы)</option>
                    <option value="local">Сельский / Локальный (аппараты акимов с/о, поселки)</option>
                  </select>
                ) : (
                  <div className="p-2.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                    {jurisdiction === 'republican' && 'Республиканский (Общегосударственный)'}
                    {jurisdiction === 'regional' && 'Областной / Региональный'}
                    {jurisdiction === 'district' && 'Районный / Городской'}
                    {jurisdiction === 'local' && 'Сельский / Локальный'}
                  </div>
                )}
              </div>

              {/* Превью-блок: только для главного администратора */}
              {isSuperAdminOwner && (
                <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-300/80 dark:border-slate-700/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700 flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        Превью (видно только главному администратору)
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      Скрыто от ведомств
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                    Данные разделы находятся на этапе утверждения регламентов и доступны для предварительного заполнения только вам.
                  </p>

                  {/* 1. Нормативно-правовая основа (Положение об органе) */}
                  <div className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-850/40 border border-slate-200/60 dark:border-slate-800/60 space-y-2 opacity-90">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300">
                        <Scale className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span>Нормативно-правовая основа (Положение об органе)</span>
                      </div>
                      {legalBasis && (legalBasis.startsWith('http://') || legalBasis.startsWith('https://')) && (
                        <a
                          href={legalBasis}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline flex items-center gap-1"
                        >
                          <span>Открыть в Әділет</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Постановление Правительства РК / Указ Президента / Решение маслихата об утверждении Положения о ведомстве.
                    </p>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <input
                        type="text"
                        value={legalBasis}
                        onChange={(e) => setLegalBasis(e.target.value)}
                        placeholder="Например: Положение утверждено Постановлением Правительства РК от ... № ... (ссылка на adilet.zan.kz)"
                        className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 focus:border-slate-400 outline-none font-medium text-slate-700 dark:text-slate-300"
                      />
                    ) : (
                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        {legalBasis || 'Нормативно-правовой акт не указан.'}
                      </div>
                    )}
                  </div>

                  {/* 2. Анти-темы (организация точно НЕ рассматривает) */}
                  <div className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-850/40 border border-slate-200/60 dark:border-slate-800/60 space-y-3 opacity-90">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300">
                      <Ban className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>Анти-темы (организация точно НЕ рассматривает)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Круг вопросов, по которым орган не имеет полномочий принимать решения (для исключения ошибочных и нецелевых обращений).
                    </p>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <textarea
                        rows={3}
                        value={competenciesExcluded}
                        onChange={(e) => setCompetenciesExcluded(e.target.value)}
                        placeholder="Например: трудовые споры в коммерческих структурах, уголовное судопроизводство, обжалование судебных решений..."
                        className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 focus:border-slate-400 outline-none leading-relaxed text-slate-700 dark:text-slate-300"
                      />
                    ) : (
                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                        {competenciesExcluded || 'Исключения не указаны.'}
                      </div>
                    )}

                    {/* Куда перенаправлять типовые ошибки */}
                    <div className="pt-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        Рекомендация по перенаправлению / Маршрут пересылки:
                      </label>
                      {permissions.canEditContent && !isLockedByOther ? (
                        <input
                          type="text"
                          value={forwardToGuidance}
                          onChange={(e) => setForwardToGuidance(e.target.value)}
                          placeholder="Например: перенаправлять в Министерство юстиции РК или судебные органы"
                          className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 focus:border-slate-400 outline-none font-medium text-slate-700 dark:text-slate-300"
                        />
                      ) : (
                        <div className="p-2 text-xs text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-slate-100 dark:border-slate-800">
                          {forwardToGuidance || 'Маршрут перенаправления не указан.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА 2: Для ЕБЗ (База знаний вопросов и тем) */}
          {(activeTab === 'ebz' || activeTab === 'questions') && (
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
                      title="Импорт базы вопросов и типовых обращений из файла Excel (.xlsx)"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" /> Импорт вопросов (Excel)
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

          {/* ВКЛАДКА 3: Информация об организации */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Официальные наименования (Редактируемые) */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Официальные наименования</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Редактируемые поля</span>
                </div>

                <div className="space-y-3">
                  {/* Краткое наименование RU */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Краткое наименование (на русском языке):
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <input
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Например: Минэнерго"
                        className="w-full mt-1 p-2.5 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="text-xs font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mt-1">
                        {orgName || org.name}
                      </div>
                    )}
                  </div>

                  {/* Полное наименование RU */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Официальное полное наименование (на русском языке):
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <textarea
                        rows={2}
                        value={orgFullName}
                        onChange={(e) => setOrgFullName(e.target.value)}
                        placeholder="Полное официальное наименование органа"
                        className="w-full mt-1 p-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none leading-relaxed"
                      />
                    ) : (
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mt-1">
                        {orgFullName || org.fullName}
                      </div>
                    )}
                  </div>

                  {/* Ресми толық атауы KZ */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Мемлекеттік тілдегі толық ресми атауы (Қазақ тілінде):
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <textarea
                        rows={2}
                        value={orgNameKk}
                        onChange={(e) => setOrgNameKk(e.target.value)}
                        placeholder="Қазақ тіліндегі ресми толық атауы"
                        className="w-full mt-1 p-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:border-blue-500 outline-none leading-relaxed"
                      />
                    ) : (
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mt-1">
                        {orgNameKk || org.orgNameKk || org.fullName || 'Көрсетілмеген'}
                      </div>
                    )}
                  </div>

                  {/* Қысқаша атауы KZ и Тип ведомства */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">
                        Қысқаша атауы (Қазақ тілінде):
                      </label>
                      {permissions.canEditContent && !isLockedByOther ? (
                        <input
                          type="text"
                          value={shortNameKk}
                          onChange={(e) => setShortNameKk(e.target.value)}
                          placeholder="Қысқаша атауы"
                          className="w-full mt-1 p-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                        />
                      ) : (
                        <div className="text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 mt-1">
                          {shortNameKk || org.shortNameKk || 'Көрсетілмеген'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">
                        Тип госоргана:
                      </label>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 mt-1 truncate">
                        {org.orgType || 'Государственный орган'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Контакты канцелярии и горячей линии */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                    <PhoneCall className="w-4 h-4 text-blue-600" />
                    <span>Контакты канцелярии и горячей линии</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Для граждан</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Горячая линия */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>Единый контакт-центр / Горячая линия:</span>
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <input
                        type="text"
                        value={phoneHotline}
                        onChange={(e) => setPhoneHotline(e.target.value)}
                        placeholder="Например: 1414 или +7 (7172) 74-00-00"
                        className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="mt-1 p-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                        {phoneHotline || 'Не указан'}
                      </div>
                    )}
                  </div>

                  {/* Телефон канцелярии */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <PhoneCall className="w-3 h-3 text-indigo-600" />
                      <span>Телефон канцелярии / приемной:</span>
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <input
                        type="text"
                        value={phoneChancellery}
                        onChange={(e) => setPhoneChancellery(e.target.value)}
                        placeholder="Например: +7 (7172) 74-11-22"
                        className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="mt-1 p-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                        {phoneChancellery || 'Не указан'}
                      </div>
                    )}
                  </div>

                  {/* Официальный Email */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Mail className="w-3 h-3 text-amber-600" />
                      <span>Официальный email канцелярии:</span>
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <input
                        type="email"
                        value={emailOfficial}
                        onChange={(e) => setEmailOfficial(e.target.value)}
                        placeholder="kense@gov.kz"
                        className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="mt-1 p-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                        {emailOfficial || 'Не указан'}
                      </div>
                    )}
                  </div>

                  {/* Веб-сайт */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Globe className="w-3 h-3 text-teal-600" />
                      <span>Официальный сайт ведомства:</span>
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <input
                        type="text"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://www.gov.kz/memleket/entities/..."
                        className="w-full mt-1 p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <div className="mt-1 p-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 truncate">
                        {websiteUrl ? (
                          <a href={websiteUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            {websiteUrl}
                          </a>
                        ) : (
                          'Не указан'
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ВКЛАДКА 4: Подчинение и структура (Вышестоящий орган + Подведомственные дочерние структуры) */}
          {activeTab === 'admin' && permissions.canChangeStructure && (
            <div className="space-y-5">
              {/* КАРТОЧКА 1: ВЫШЕСТОЯЩИЙ ОРГАН */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border-2 border-indigo-100 dark:border-indigo-900/60 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-black text-indigo-950 dark:text-indigo-200">
                  <span className="text-base">⬆️</span>
                  <span className="uppercase tracking-wide">Вышестоящий орган (Кому подчиняется ведомство)</span>
                </div>

                {/* Текущий вышестоящий орган */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Текущее подчинение:</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white truncate block">
                      {parentOrg ? parentOrg.name : 'Корневой уровень (Без вышестоящего органа)'}
                    </span>
                    {parentOrg && (
                      <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                        {parentOrg.fullName}
                      </span>
                    )}
                  </div>
                  {parentOrg && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 shrink-0">
                      Вышестоящий
                    </span>
                  )}
                </div>

                {/* Поиск и выбор нового вышестоящего органа */}
                <div className="space-y-2 pt-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Сменить вышестоящий орган:
                  </label>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={parentSearchQuery}
                      onChange={(e) => setParentSearchQuery(e.target.value)}
                      placeholder="Поиск родителя (Правительство, Министерство, Агентство)..."
                      className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  {/* Быстрая опция: Корневой уровень (Без вышестоящего) */}
                  <div
                    onClick={() => setSelectedParentId(null)}
                    className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between text-xs font-bold ${
                      selectedParentId === null
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div>
                      <span>Корневой уровень (Без вышестоящего)</span>
                      <span className="block text-[10px] text-slate-400 font-normal">
                        Организация подчиняется напрямую высшему руководству страны
                      </span>
                    </div>
                    {selectedParentId === null && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                  </div>

                  {/* Список подходящих органов (без дочерних структур!) */}
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
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

                  {/* Кнопка подтверждения смены вышестоящего */}
                  <button
                    type="button"
                    onClick={handleReparent}
                    disabled={isSubmitting || selectedParentId === org.parentId}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md disabled:opacity-40"
                  >
                    {isSubmitting
                      ? 'Применение изменений...'
                      : selectedParentId === org.parentId
                      ? 'Вышестоящий орган не изменен'
                      : `Утвердить вышестоящим: ${candidateParent ? candidateParent.name : 'Корневой уровень'}`}
                  </button>
                </div>
              </div>

              {/* КАРТОЧКА 2: ПОДВЕДОМСТВЕННЫЕ ОРГАНИЗАЦИИ (ДОЧЕРНИЕ СТРУКТУРЫ) */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border-2 border-slate-200/90 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                    <span className="text-base">⬇️</span>
                    <span className="uppercase tracking-wide">Подведомственные организации ({directChildren.length})</span>
                  </div>
                  {onCreateOrg && (
                    <button
                      type="button"
                      onClick={() => setIsCreateChildModalOpen(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Создать дочку
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Организации и комитеты, которые напрямую подчиняются данному ведомству.
                </p>

                {directChildren.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {directChildren.map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white truncate block">
                            {c.name}
                          </span>
                          <span className="text-[10px] text-slate-500 truncate block">
                            {c.fullName}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                          Дочерний орган
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    У данной организации пока нет подотчетных дочерних структур. Нажмите «Создать дочку», чтобы добавить.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Футер карточки с кнопкой Сохранить */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {access.allowed ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Доступ разрешен ({authUser?.orgName || authUser?.role || 'Администратор'})</span>
              </span>
            ) : (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Только просмотр</span>
              </span>
            )}
          </div>

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

      {/* Модальное окно создания дочерней организации */}
      {onCreateOrg && (
        <CreateChildOrgModal
          isOpen={isCreateChildModalOpen}
          onClose={() => setIsCreateChildModalOpen(false)}
          parentOrg={org}
          allOrgs={allOrgs}
          onCreate={onCreateOrg}
        />
      )}
    </>
  );
};
