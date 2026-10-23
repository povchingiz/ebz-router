import React, { useState, useEffect, useMemo } from 'react';
import { GovOrg, OrgQuestion, User, ROLE_PERMISSIONS, JurisdictionLevel, OrgDepartment } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { QuestionModal } from './QuestionModal';
import { QuestionCsvModal } from './QuestionCsvModal';
import { CreateChildOrgModal } from './CreateChildOrgModal';
import { CreateOrgUserModal } from './auth/CreateOrgUserModal';
import { LocationPicker } from './LocationPicker';
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
  Mail,
  Ban,
  Eye,
  ExternalLink,
  Layers,
  BookOpen,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  History,
} from 'lucide-react';

interface OrgDrawerProps {
  org: GovOrg | null;
  allOrgs: GovOrg[];
  currentUser: User;
  isOpen: boolean;
  initialDepartmentId?: string | number | null;
  onClose: () => void;
  onSaveContent: (updatedData: {
    name?: string;
    fullName?: string;
    scope: string;
    theme?: string;
    locationAddress?: string;
    jurisdiction?: JurisdictionLevel;
    legalBasis?: string;
    competenciesExcluded?: string;
    forwardToGuidance?: string;
    contacts?: {
      phoneChancellery?: string;
      emailOfficial?: string;
      websiteUrl?: string;
      physicalAddress?: string;
    };
    questions: OrgQuestion[];
    departments?: OrgDepartment[];
    katoCode?: string;
    katoNameRu?: string;
    locationId?: string;
    hasHumanTouch?: boolean;
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

export const OrgDrawer: React.FC<OrgDrawerProps> = ({
  org,
  allOrgs,
  currentUser,
  isOpen,
  initialDepartmentId,
  onClose,
  onSaveContent,
  onReparent,
  onCreateOrg,
}) => {
  const { user: authUser, canManageOrg } = useAuth();
  const [activeTab, setActiveTab] = useState<'ebz' | 'info' | 'admin' | 'questions'>('info');

  // Наименования
  const [orgName, setOrgName] = useState('');
  const [orgFullName, setOrgFullName] = useState('');
  const [isEditingNames, setIsEditingNames] = useState(false);

  // Поля сведений
  const [scope, setScope] = useState('');
  const [theme, setTheme] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [katoCode, setKatoCode] = useState('');
  const [locationId, setLocationId] = useState('');
  const [katoNameRu, setKatoNameRu] = useState('');
  const [jurisdiction, setJurisdiction] = useState<JurisdictionLevel>('republican');
  const [legalBasis, setLegalBasis] = useState('');

  // Исключения компетенций (Схема knowledge)
  const [competenciesExcluded, setCompetenciesExcluded] = useState('');
  const [forwardToGuidance, setForwardToGuidance] = useState('');

  // Контакты и реквизиты (Схема knowledge)
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
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [compareOrgId, setCompareOrgId] = useState('');
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Подразделения ведомства (Управления / Департаменты)
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [deptSearch, setDeptSearch] = useState('');
  const [expandedDeptIds, setExpandedDeptIds] = useState<Set<string | number>>(new Set());
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<number | string | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptTheme, setNewDeptTheme] = useState('');
  const [newDeptResponsible, setNewDeptResponsible] = useState('');
  const [newDeptPath, setNewDeptPath] = useState('');

  // Фокус на конкретном подразделении
  const [selectedDeptId, setSelectedDeptId] = useState<string | number | null>(initialDepartmentId ?? null);
  const [isAddDeptQuestionModalOpen, setIsAddDeptQuestionModalOpen] = useState(false);
  const [deptQuestionTopic, setDeptQuestionTopic] = useState('');
  const [deptQuestionDesc, setDeptQuestionDesc] = useState('');
  const [deptQuestionKeywords, setDeptQuestionKeywords] = useState('');

  useEffect(() => {
    if (initialDepartmentId) {
      setSelectedDeptId(initialDepartmentId);
      setActiveTab('info');
    } else {
      setSelectedDeptId(null);
    }
  }, [initialDepartmentId, org?.id]);

  const currentDept = useMemo(() => {
    if (!selectedDeptId) return null;
    return departments.find((d) => String(d.id) === String(selectedDeptId)) || null;
  }, [departments, selectedDeptId]);

  // Генерация ключевых вопросов ИИ-маршрутизатора из пунктов компетенций подразделения
  const generateDeptQuestions = (deptId: string | number) => {
    setDepartments((prev) =>
      prev.map((d) => {
        if (String(d.id) !== String(deptId)) return d;
        const text = `${d.theme ? d.theme + '. ' : ''}${d.responsible || ''}`;
        const rawClauses = text
          .split(/(?:\r?\n|\d+[\)\.]\s*)/g)
          .map((s) => s.trim().replace(/^;+|;+$/g, '').replace(/\s+/g, ' '))
          .filter((s) => s.length >= 10);

        const newQuestions: OrgQuestion[] = rawClauses.slice(0, 10).map((clause, idx) => {
          const words = clause
            .toLowerCase()
            .replace(/[^a-zа-яәғқңөұүһі\s]/gi, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 4 && !['осуществление', 'проведение', 'деятельности', 'соответствии', 'порядке', 'рамках'].includes(w));
          const uniqueKeywords = Array.from(new Set(words)).slice(0, 6);

          return {
            id: `dept-q-${d.id}-${idx + 1}-${Date.now().toString().slice(-4)}`,
            topic: clause.length > 95 ? clause.slice(0, 95) + '...' : clause,
            description: `Специфика компетенции подразделения: ${clause}`,
            keywords: uniqueKeywords.length > 0 ? uniqueKeywords : [d.name.toLowerCase().split(' ')[0]],
          };
        });

        return {
          ...d,
          questions: newQuestions,
        };
      })
    );
    setStatusMsg({ text: 'Вопросы маршрутизатора успешно сформированы из компетенций подразделения!' });
  };

  const addDeptQuestion = (deptId: string | number) => {
    if (!deptQuestionTopic.trim()) return;
    const kw = deptQuestionKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const newQ: OrgQuestion = {
      id: `dept-q-${deptId}-${Date.now()}`,
      topic: deptQuestionTopic.trim(),
      description: deptQuestionDesc.trim(),
      keywords: kw.length > 0 ? kw : [deptQuestionTopic.trim().split(' ')[0].toLowerCase()],
    };

    setDepartments((prev) =>
      prev.map((d) => {
        if (String(d.id) !== String(deptId)) return d;
        return {
          ...d,
          questions: [...(d.questions || []), newQ],
        };
      })
    );

    setIsAddDeptQuestionModalOpen(false);
    setDeptQuestionTopic('');
    setDeptQuestionDesc('');
    setDeptQuestionKeywords('');
    setStatusMsg({ text: 'Вопрос подразделения добавлен для маршрутизатора!' });
  };

  const deleteDeptQuestion = (deptId: string | number, questionId: string) => {
    setDepartments((prev) =>
      prev.map((d) => {
        if (String(d.id) !== String(deptId)) return d;
        return {
          ...d,
          questions: (d.questions || []).filter((q) => q.id !== questionId),
        };
      })
    );
  };

  // Подотчетность
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [parentSearchQuery, setParentSearchQuery] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [conversionBusy, setConversionBusy] = useState<string | null>(null);
  const [localVersion, setLocalVersion] = useState(org?.version ?? 1);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  // Синхронизация при открытии карточки
  useEffect(() => {
    if (org) {
      setLocalVersion(org.version || 1);
      setOrgName(org.name || '');
      setOrgFullName(org.fullName || '');
      setIsEditingNames(false);
      setScope(org.scope || '');
      setTheme(org.theme || '');
      setLocationAddress(org.locationAddress || '');
      setKatoCode(org.katoCode || '');
      setLocationId(org.locationId || '');
      setKatoNameRu(org.katoNameRu || '');
      setDepartments(org.departments ? JSON.parse(JSON.stringify(org.departments)) : []);
      setDeptSearch('');
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

  // Поиск подразделений по названию, тематике, компетенциям и пути
  const filteredDepartments = useMemo(() => {
    if (!deptSearch.trim()) return departments;
    const q = deptSearch.toLowerCase();
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.theme && d.theme.toLowerCase().includes(q)) ||
        (d.responsible && d.responsible.toLowerCase().includes(q)) ||
        (d.path && d.path.toLowerCase().includes(q))
    );
  }, [departments, deptSearch]);

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
    authUser
      ? authUser.username === 'superadmin' || authUser.role === 'GLOBAL_ADMIN'
      : false
  );
  const parentOrg = allOrgs.find((o) => o.id === org.parentId);
  const comparedOrg = allOrgs.find((o) => o.id === compareOrgId);
  const candidateParent = allOrgs.find((o) => o.id === selectedParentId);

  const handleSaveContent = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      await onSaveContent({
        name: orgName,
        fullName: orgFullName,
        scope,
        theme,
        locationAddress,
        katoCode,
        katoNameRu,
        locationId,
        jurisdiction,
        hasHumanTouch: true,
        legalBasis,
        competenciesExcluded,
        forwardToGuidance,
        contacts: {
          phoneChancellery,
          emailOfficial,
          websiteUrl,
          physicalAddress: locationAddress,
        },
        questions,
        departments,
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
    if (isSubmitting) return;
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

  const convertStructure = async (action: 'convert_dept_to_org' | 'convert_org_to_dept', payload: Record<string, unknown>, busyKey: string) => {
    if (isSubmitting || conversionBusy) return;
    setConversionBusy(busyKey);
    setStatusMsg(null);
    try {
      const response = await fetch('/api/mutate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, user: currentUser, version: localVersion }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Не удалось преобразовать структуру');
      const updatedParent = result.parentOrg;
      if (updatedParent?.version) setLocalVersion(updatedParent.version);
      if (updatedParent?.departments) setDepartments(updatedParent.departments);
      setStatusMsg({ text: 'Структура успешно преобразована!' });
    } catch (error: any) {
      setStatusMsg({ text: error.message || 'Ошибка преобразования', error: true });
    } finally { setConversionBusy(null); }
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
      {auditOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-950/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAuditOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="История изменений" onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[82vh] overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
            <header className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between"><div><h2 className="text-lg font-black">История изменений</h2><p className="text-xs text-slate-500">Журнал правок · {org.name}</p></div><button type="button" onClick={() => setAuditOpen(false)}><X className="w-4 h-4" /></button></header>
            <div className="p-5 overflow-y-auto space-y-4">{auditLoading ? <p>Загрузка журнала…</p> : auditEntries.length ? auditEntries.map((entry, index) => <article key={entry.id || index} className="relative border-l-2 border-blue-200 pl-4 pb-2"><time className="text-[11px] text-slate-400">{new Date(entry.timestamp || entry.created_at || entry.createdAt).toLocaleString('ru-RU')}</time><div className="mt-1 flex items-center gap-2"><strong className="text-sm">{entry.userName || entry.user_name || 'Система'}</strong><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100">{entry.userRole || entry.user_role || 'Пользователь'}</span></div><p className="text-xs mt-1">{entry.action}</p>{entry.changes && <div className="mt-2 space-y-1">{Object.entries(entry.changes).map(([field, diff]: [string, any]) => <div key={field} className="text-xs"><b className="mr-2">{field}:</b><span className="line-through text-rose-600 bg-rose-50 px-1 rounded">{String(diff?.oldValue ?? diff?.old ?? '—')}</span><span className="mx-1">→</span><span className="text-emerald-700 bg-emerald-50 px-1 rounded">{String(diff?.newValue ?? diff?.new ?? '—')}</span></div>)}</div>}</article>) : <p className="text-sm text-slate-500">Записей пока нет.</p>}</div>
          </section>
        </div>
      )}
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
              {isSuperAdminOwner && <button type="button" onClick={() => setIsCreateUserModalOpen(true)} className="rounded-xl border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50">Создать пользователя</button>}
              <button type="button" onClick={() => setIsCompareOpen((open) => !open)} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100">Сравнить</button>

              {isLockedByOther && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-lg">
                  <Lock className="w-3 h-3" /> {org.lockedBy?.userName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  setAuditOpen(true);
                  setAuditLoading(true);
                  try {
                    const response = await fetch(`/api/audit?orgId=${encodeURIComponent(org.id)}`);
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Не удалось загрузить журнал');
                    setAuditEntries(result.data || []);
                  } catch (error: any) {
                    setAuditEntries([]);
                    setStatusMsg({ text: error.message || 'Ошибка загрузки журнала', error: true });
                  } finally { setAuditLoading(false); }
                }}
                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                title="История изменений"
              ><History className="w-4 h-4" /></button>
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

          {currentDept ? (
            <div className="group relative mt-1 space-y-1.5 p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
                  <Layers className="w-3 h-3" />
                  Подразделение ведомства
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDeptId(null)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-white px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 shadow-2xs transition-all active:scale-95"
                  title="Вернуться к просмотру паспорта всего ведомства целиком"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>К ведомству целиком</span>
                </button>
              </div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                {currentDept.name}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                <span>Основной орган:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{orgName || org.name}</span>
              </div>
            </div>
          ) : isEditingNames ? (
            <div className="space-y-2 mt-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Редактирование названий органа:</label>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Поменяется краткое наименование</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Краткое наименование"
                className="w-full p-2 text-sm font-black rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none"
              />
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Поменяется полное наименование</label>
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

          {/* Быстрый переключатель между подразделениями ведомства */}
          {departments.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2 p-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-600" />
                Фокус:
              </span>
              <select
                value={selectedDeptId ? String(selectedDeptId) : ''}
                onChange={(e) => {
                  setSelectedDeptId(e.target.value ? e.target.value : null);
                  setActiveTab('info');
                }}
                className="flex-1 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 py-1 px-2 rounded-lg border border-slate-200 dark:border-slate-700 outline-none truncate cursor-pointer shadow-2xs"
              >
                <option value="">🏛️ Все ведомство целиком ({orgName || org.name})</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    📁 {d.name} {d.questions?.length ? `(${d.questions.length} вопр.)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}


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

        {/* Навигационные вкладки */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 sm:px-5 gap-3 sm:gap-4 text-xs font-bold bg-white dark:bg-slate-900 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`whitespace-nowrap py-3.5 border-b-2 -mb-px flex items-center gap-1.5 transition-colors shrink-0 ${
              activeTab === 'info' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Сведения
          </button>

          <button type="button" onClick={async () => { setAuditOpen(true); setAuditLoading(true); try { const response = await fetch(`/api/audit?orgId=${encodeURIComponent(org.id)}`); const result = await response.json(); setAuditEntries(result.data || []); } catch { setAuditEntries([]); } finally { setAuditLoading(false); } }} className="whitespace-nowrap py-3.5 border-b-2 -mb-px flex items-center gap-1.5 text-slate-500 hover:text-blue-600"><History className="w-4 h-4"/>Журнал изменений</button>
        </div>

        {/* Содержимое панели со скроллом */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isCompareOpen && <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 dark:bg-blue-950/20"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">Сравнение ведомств</h3><select value={compareOrgId} onChange={(event) => setCompareOrgId(event.target.value)} className="max-w-[60%] rounded-xl border bg-white p-2 text-xs dark:bg-slate-900"><option value="">Выберите ведомство</option>{allOrgs.filter((candidate) => candidate.id !== org.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></div>{comparedOrg && <div className="grid gap-3 md:grid-cols-2">{[org, comparedOrg].map((candidate) => <div key={candidate.id} className="rounded-xl border bg-white p-3 text-xs dark:bg-slate-900"><h4 className="font-black">{candidate.name}</h4><b className="mt-2 block">Сфера компетенций</b><p className="whitespace-pre-wrap text-slate-600">{candidate.scope || candidate.theme || 'Не указана'}</p><b className="mt-2 block">Исключенные вопросы</b><p className="whitespace-pre-wrap text-slate-600">{candidate.competenciesExcluded || 'Не указаны'}</p><b className="mt-2 block">Контакты</b><p>{candidate.contacts?.phoneChancellery || '—'} · {candidate.contacts?.emailOfficial || '—'} · {candidate.contacts?.websiteUrl || '—'}</p></div>)}</div>}</section>}
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
          {activeTab === 'info' && (
            currentDept ? (
              /* РЕЖИМ ФОКУСА НА ПОДРАЗДЕЛЕНИИ */
              <div className="space-y-4">
                {/* 1. Блок наследуемой информации основного органа */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>Наследуемые параметры ведомства</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">от {orgName || org.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-medium">Вышестоящий орган:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                        {parentOrg ? parentOrg.name : 'Правительство РК'}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-medium">Закрепленная локация:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                        {locationAddress || katoNameRu || 'г. Астана'}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-medium">Юрисдикция:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                        {JURISDICTION_OPTIONS.find((j) => j.value === jurisdiction)?.badge || 'РК'}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-medium">Канцелярия / Контакты:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                        {phoneChancellery || 'Центральный аппарат'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Подразделение действует в юрисдикции {orgName || org.name} и наследует его географию, но решает профильные задачи своей отраслевой компетенции.
                  </p>
                </div>

                {/* 2. Компетенции и полномочия подразделения */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-850 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950 dark:text-indigo-200">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Компетенции подразделения (для ИИ-маршрутизатора)</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Перечень официальных задач и функций подразделения. ИИ использует их для точного сопоставления с текстом обращения.
                  </p>
                  {permissions.canEditContent && !isLockedByOther ? (
                    <textarea
                      rows={6}
                      value={currentDept.responsible || ''}
                      onChange={(e) => {
                        const updated = departments.map((d) =>
                          d.id === currentDept.id ? { ...d, responsible: e.target.value } : d
                        );
                        setDepartments(updated);
                      }}
                      placeholder="Перечислите пункты полномочий и функций подразделения..."
                      className="w-full p-3 text-xs rounded-xl bg-white dark:bg-slate-900 border border-indigo-200/70 dark:border-slate-700 outline-none leading-relaxed font-normal text-slate-800 dark:text-slate-200 focus:border-indigo-500"
                    />
                  ) : (
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {currentDept.responsible || 'Полномочия не указаны'}
                    </div>
                  )}
                </div>

                {/* 3. Вопросы и тематики подразделения для ИИ-маршрутизатора */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/70 space-y-3 shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                        <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Вопросы подразделения для маршрутизатора ({currentDept.questions?.length || 0})</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Маршрутизатор сопоставляет входящие обращения с этими вопросами и перенаправляет их в данный отдел.
                      </p>
                    </div>

                    {permissions.canEditContent && !isLockedByOther && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(!currentDept.questions || currentDept.questions.length === 0) && currentDept.responsible && (
                          <button
                            type="button"
                            onClick={() => generateDeptQuestions(currentDept.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all active:scale-95"
                            title="Сформировать готовые вопросы маршрутизатора по пунктам компетенций"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Сгенерировать</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setDeptQuestionTopic('');
                            setDeptQuestionDesc('');
                            setDeptQuestionKeywords('');
                            setIsAddDeptQuestionModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Добавить</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Список вопросов или плашка генерации */}
                  {(!currentDept.questions || currentDept.questions.length === 0) ? (
                    <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        Для этого подразделения пока не добавлены индивидуальные вопросы.
                      </p>
                      {currentDept.responsible && (
                        <p className="text-[11px] text-slate-400">
                          Нажмите <strong className="text-indigo-600 dark:text-indigo-400">«Сгенерировать»</strong>, чтобы алгоритм автоматически создал вопросы с тегами из пунктов компетенций отдела.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                      {currentDept.questions.map((q, idx) => (
                        <div
                          key={q.id || idx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                              {q.topic}
                            </h5>
                            {permissions.canEditContent && !isLockedByOther && (
                              <button
                                type="button"
                                onClick={() => deleteDeptQuestion(currentDept.id, q.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors shrink-0"
                                title="Удалить вопрос"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          {q.description && (
                            <p className="text-[11px] text-slate-500 leading-snug">
                              {q.description}
                            </p>
                          )}
                          {q.keywords && q.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {q.keywords.map((kw, kidx) => (
                                <span
                                  key={kidx}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40"
                                >
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Кнопка сброса фокуса на общее ведомство */}
                <button
                  type="button"
                  onClick={() => setSelectedDeptId(null)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Вернуться к паспорту всего ведомства целиком ({orgName || org.name})</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
              {/* 1. Сфера ведения и основные компетенции */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Сфера ведения и основные компетенции</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Основные направления деятельности и полномочия государственного органа.
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

              {/* 2. НАД масштабом юрисдикции: Адрес ведомства */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>Адрес ведомства</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Для региональной маршрутизации</span>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-bold uppercase text-slate-500">Региональная юрисдикция</label>
                  <LocationPicker
                    currentKatoCode={katoCode}
                    currentLocationId={locationId}
                    currentLocationAddress={locationAddress}
                    disabled={!permissions.canEditContent || Boolean(isLockedByOther)}
                    onChange={(loc) => {
                      setKatoCode(loc.katoCode);
                      setKatoNameRu(loc.katoNameRu);
                      setLocationId(loc.locationId);
                      setLocationAddress(loc.locationAddress);
                    }}
                  />

                  {/* Фактический адрес (улица, дом - опционально) */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      Фактический адрес
                    </label>
                    {permissions.canEditContent && !isLockedByOther ? (
                      <input
                        type="text"
                        value={physicalAddress}
                        onChange={(e) => setPhysicalAddress(e.target.value)}
                        placeholder="Напр. г. Астана, пр. Мәңгілік Ел, 8"
                        className="w-full mt-1 p-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                      />
                    ) : (
                      <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 mt-1">
                        {physicalAddress || 'Адрес не указан'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Территориальный уровень полномочий (компактный выпадающий список) */}
              <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
                    <Globe className="w-4 h-4 text-teal-600" />
                    <span>Территориальный уровень полномочий</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Республиканский / областной / районный уровень</span>
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

              {/* 4. Внутренние подразделения ведомства (Управления / Департаменты) */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/50 border border-indigo-200/80 dark:border-indigo-900/60 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-950 dark:text-indigo-200">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Внутренние подразделения ведомства ({departments.length})</span>
                  </div>
                  {permissions.canEditContent && !isLockedByOther && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDeptId(null);
                        setNewDeptName('');
                        setNewDeptTheme('');
                        setNewDeptResponsible('');
                        setNewDeptPath(org.fullName || org.name);
                        setIsAddDeptModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Добавить подразделение</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 leading-snug">
                  Структурные управления и департаменты ведомства для точной адресации и внутренней маршрутизации обращений.
                </p>

                {/* Поиск по подразделениям */}
                {departments.length > 0 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={deptSearch}
                      onChange={(e) => setDeptSearch(e.target.value)}
                      placeholder="Поиск по названию подразделения или компетенциям..."
                      className="w-full pl-9 pr-36 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 outline-none font-medium"
                    />
                    <span className="absolute right-2 top-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                      Показано {filteredDepartments.length} из {departments.length}
                    </span>
                  </div>
                )}

                {/* Список подразделений */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredDepartments.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-white/60 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                      {departments.length === 0
                        ? 'Подразделения пока не внесены. Нажмите «Добавить подразделение», чтобы зарегистрировать структуру.'
                        : 'Подразделения не найдены по запросу.'}
                    </div>
                  ) : (
                    filteredDepartments.map((dept) => (
                      <div
                        key={dept.id}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 shadow-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <h5 className="text-xs font-black text-slate-900 dark:text-white leading-snug truncate">
                              {dept.name}
                            </h5>
                            {dept.theme && (
                              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-md border border-indigo-150 dark:border-indigo-900/50 truncate max-w-[180px]" title={dept.theme}>{dept.theme}</span>
                            )}
                          </div>

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 shrink-0">
                            {dept.questions?.length || 0} вопр.
                          </span>
                          {permissions.canEditContent && !isLockedByOther && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDeptId(dept.id);
                                  setNewDeptName(dept.name);
                                  setNewDeptTheme(dept.theme || '');
                                  setNewDeptResponsible(dept.responsible || '');
                                  setNewDeptPath(dept.path || '');
                                  setIsAddDeptModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                title="Редактировать подразделение"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDepartments((prev) => prev.filter((d) => d.id !== dept.id));
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                title="Удалить подразделение"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {permissions.canChangeStructure && (
                            <button type="button" disabled={!!conversionBusy || isSubmitting} onClick={() => convertStructure('convert_dept_to_org', { parentOrgId: org.id, deptId: dept.id }, `dept-${dept.id}`)} className="px-2 py-1 text-[10px] font-bold rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50" title="Преобразовать в подотчетную организацию">
                              {conversionBusy === `dept-${dept.id}` ? 'Преобразование…' : 'В организацию'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedDeptId(dept.id)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors shrink-0"
                            title="Открыть вопросы и компетенции этого подразделения"
                            aria-label="Открыть подразделение"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setExpandedDeptIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(dept.id)) next.delete(dept.id); else next.add(dept.id);
                            return next;
                          })} className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors shrink-0" aria-label={expandedDeptIds.has(dept.id) ? 'Свернуть подразделение' : 'Развернуть подразделение'} aria-expanded={expandedDeptIds.has(dept.id)}>
                            {expandedDeptIds.has(dept.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>

                        {expandedDeptIds.has(dept.id) && dept.responsible && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-850 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                            {dept.responsible}
                          </p>
                        )}

                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )
        )}

          {/* ВКЛАДКА 2: Для ЕБЗ (База знаний вопросов и тем) */}
          {activeTab === 'info' && (
            <div className="space-y-4">
              {/* Баннер перехода в полноэкранный реестр статей ЕБЗ */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <div className="font-black text-indigo-950 dark:text-indigo-200">
                      Реестр статей ЕБЗ (1414 и регламенты)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Полная база знаний статей доступна в полноэкранном режиме «Статьи ЕБЗ» в левом меню.
                    </div>
                  </div>
                </div>
              </div>

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

          {/* ВКЛАДКА 4: Подчинение и структура (Вышестоящий орган + Подведомственные дочерние структуры) */}
          {activeTab === 'info' && permissions.canChangeStructure && (
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
                        {permissions.canChangeStructure && (
                          <button type="button" disabled={!!conversionBusy || isSubmitting} onClick={() => convertStructure('convert_org_to_dept', { orgId: c.id, targetParentId: org.id }, `org-${c.id}`)} className="px-2 py-1 text-[10px] font-bold rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 shrink-0" title="Преобразовать во внутренний отдел">
                            {conversionBusy === `org-${c.id}` ? 'Преобразование…' : 'Во внутренний отдел'}
                          </button>
                        )}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">Дочерний орган</span>
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
      <CreateOrgUserModal isOpen={isCreateUserModalOpen} org={org} onClose={() => setIsCreateUserModalOpen(false)} />
      {/* Модальное окно создания / редактирования внутреннего подразделения */}
      {isAddDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {editingDeptId ? 'Редактировать подразделение' : 'Добавить подразделение ведомства'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDeptModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Автоматическая привязка к активной организации */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Ведомство привязки:
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded">
                    Привязано автоматически
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{org.name || org.fullName}</span>
                </div>
              </div>

              {/* Наименование подразделения */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Наименование подразделения:
                </label>
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="Например: Департамент автомобильных дорог"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none font-bold"
                />
              </div>

              {/* Сфера ведения и основные компетенции */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Сфера ведения и основные компетенции:
                </label>
                <input
                  type="text"
                  value={newDeptTheme}
                  onChange={(e) => setNewDeptTheme(e.target.value)}
                  placeholder="Например: Пассажирский транспорт, автодороги, маршрутные сети"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none font-medium"
                />
                <p className="text-[10px] text-slate-400">
                  Отраслевая сфера для первичной маршрутизации обращений граждан.
                </p>
              </div>

              {/* Компетенции и полномочия (название совпадает с карточкой подразделения) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Компетенции и полномочия:
                </label>
                <textarea
                  rows={4}
                  value={newDeptResponsible}
                  onChange={(e) => setNewDeptResponsible(e.target.value)}
                  placeholder="Опишите предметные задачи, полномочия и функции подразделения для сопоставления с текстом обращений..."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none leading-relaxed"
                />
              </div>

              {/* Внутренняя подчиненность / Иерархический путь */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Подчиненность внутри ведомства (опционально):
                </label>
                <input
                  type="text"
                  value={newDeptPath}
                  onChange={(e) => setNewDeptPath(e.target.value)}
                  placeholder={`Например: ${org.name} > Комитет автомобильных дорог`}
                  className="w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none text-slate-600 dark:text-slate-300"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddDeptModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={!newDeptName.trim()}
                onClick={() => {
                  if (!newDeptName.trim()) return;
                  if (editingDeptId) {
                    setDepartments((prev) =>
                      prev.map((d) =>
                        d.id === editingDeptId
                          ? {
                              ...d,
                              name: newDeptName.trim(),
                              theme: newDeptTheme.trim(),
                              responsible: newDeptResponsible.trim(),
                              path: newDeptPath.trim(),
                            }
                          : d
                      )
                    );
                  } else {
                    const newDept: OrgDepartment = {
                      id: String(Date.now()),
                      name: newDeptName.trim(),
                      theme: newDeptTheme.trim(),
                      responsible: newDeptResponsible.trim(),
                      path: newDeptPath.trim(),
                      orgId: org.id,
                    };
                    setDepartments((prev) => [...prev, newDept]);
                  }
                  setIsAddDeptModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all disabled:opacity-50"
              >
                {editingDeptId ? 'Сохранить изменения' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания вопроса для конкретного подразделения */}
      {isAddDeptQuestionModalOpen && currentDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-600" />
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    Новый вопрос подразделения
                  </h4>
                  <p className="text-[10px] text-slate-400 font-medium truncate max-w-[260px]">
                    {currentDept.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDeptQuestionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Тематика / Вопрос:
                </label>
                <input
                  type="text"
                  value={deptQuestionTopic}
                  onChange={(e) => setDeptQuestionTopic(e.target.value)}
                  placeholder="Например: Аудит процедур государственных закупок"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Описание / Суть компетенции:
                </label>
                <textarea
                  rows={3}
                  value={deptQuestionDesc}
                  onChange={(e) => setDeptQuestionDesc(e.target.value)}
                  placeholder="Опишите, в каких случаях обращение направляется в данное подразделение..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none text-slate-800 dark:text-slate-200 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Ключевые слова (через запятую):
                </label>
                <input
                  type="text"
                  value={deptQuestionKeywords}
                  onChange={(e) => setDeptQuestionKeywords(e.target.value)}
                  placeholder="аудит, госзакупки, закупки, договор"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddDeptQuestionModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => addDeptQuestion(currentDept.id)}
                disabled={!deptQuestionTopic.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs disabled:opacity-50 transition-all"
              >
                Добавить вопрос
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
