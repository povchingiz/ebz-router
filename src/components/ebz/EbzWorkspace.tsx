'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { EbzArticle, GovOrg } from '../../types';
import { useAuth } from '../../context/AuthContext';
import EBZ_ARTICLES_RAW from '../../data/ebz_articles.json';
import {
  Search,
  BookOpen,
  Filter,
  Building2,
  Tag,
  ExternalLink,
  Plus,
  Save,
  Trash2,
  Edit3,
  Globe2,
  FileText,
  Scale,
  Sparkles,
  ChevronRight,
  X,
  Check,
} from 'lucide-react';

interface EbzWorkspaceProps {
  allOrgs: GovOrg[];
  onSelectOrg?: (orgId: string) => void;
}

export const EbzWorkspace: React.FC<EbzWorkspaceProps> = ({ allOrgs, onSelectOrg }) => {
  const { user } = useAuth();
  const [articles, setArticles] = useState<EbzArticle[]>(EBZ_ARTICLES_RAW as EbzArticle[]);
  const [activeScope, setActiveScope] = useState<'my' | 'all'>('my');
  const [lang, setLang] = useState<'ru' | 'kk'>('ru');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Режим редактирования/создания
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EbzArticle>>({});
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Организация текущего пользователя
  const userOrgId = user?.orgId || null;
  const isSuperAdmin = user?.role === 'GLOBAL_ADMIN';

  // По умолчанию выбираем 'all', если пользователь не привязан к конкретному ведомству
  useEffect(() => {
    if (!userOrgId) {
      setActiveScope('all');
    } else {
      setActiveScope('my');
    }
  }, [userOrgId]);

  // Сбор всех уникальных тегов
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    articles.forEach((a) => {
      (a.tags || []).forEach((t) => {
        if (t && t.trim()) tagSet.add(t.trim());
      });
    });
    return Array.from(tagSet).sort();
  }, [articles]);

  // Сбор организаций из статей
  const orgOptions = useMemo(() => {
    const map = new Map<string, string>();
    articles.forEach((a) => {
      if (a.orgId && a.orgNameRu) {
        map.set(a.orgId, a.orgNameRu);
      }
    });
    return Array.from(map.entries());
  }, [articles]);

  // Фильтрация статей
  const filteredArticles = useMemo(() => {
    let list = articles;

    // 1. Фильтр по области (Мое ведомство vs Все)
    if (activeScope === 'my' && userOrgId) {
      list = list.filter((a) => a.orgId === userOrgId);
    }

    // 2. Фильтр по организации из выпадающего списка
    if (selectedOrgFilter !== 'all') {
      list = list.filter((a) => a.orgId === selectedOrgFilter);
    }

    // 3. Фильтр по тегу
    if (selectedTag !== 'all') {
      list = list.filter((a) => a.tags && a.tags.includes(selectedTag));
    }

    // 4. Потокеновый полнотекстовый поиск по 5 полям одновременно
    if (searchQuery.trim()) {
      const tokens = searchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0);

      list = list.filter((a) => {
        const textTarget = [
          a.titleRu,
          a.titleKk,
          a.summaryRu,
          a.summaryKk,
          a.fullResponseRu,
          a.fullResponseKk,
          a.relatedNpaRu,
          a.relatedNpaKk,
          a.orgNameRu,
          a.orgNameKk,
          ...(a.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return tokens.every((token) => textTarget.includes(token));
      });
    }

    return list;
  }, [articles, activeScope, userOrgId, selectedOrgFilter, selectedTag, searchQuery]);

  // Текущая выбранная статья (автовыбор первой при загрузке)
  useEffect(() => {
    if (filteredArticles.length > 0 && !selectedArticleId) {
      setSelectedArticleId(filteredArticles[0].id);
    }
  }, [filteredArticles, selectedArticleId]);

  const currentArticle = useMemo(() => {
    return articles.find((a) => a.id === selectedArticleId) || filteredArticles[0] || null;
  }, [articles, selectedArticleId, filteredArticles]);

  const startEdit = (article: EbzArticle) => {
    setEditForm({ ...article });
    setIsEditing(true);
  };

  const startCreate = () => {
    const newArt: Partial<EbzArticle> = {
      id: `ebz-${Date.now()}`,
      orgId: userOrgId || 'mt',
      orgNameRu: user?.orgName || 'Министерство транспорта РК',
      orgNameKk: 'ҚР Көлік министрлігі',
      titleRu: '',
      titleKk: '',
      summaryRu: '',
      summaryKk: '',
      fullResponseRu: '',
      fullResponseKk: '',
      relatedNpaRu: '',
      relatedNpaKk: '',
      tags: [],
    };
    setEditForm(newArt);
    setIsEditing(true);
  };

  const saveArticle = () => {
    if (!editForm.id) return;
    const updated = editForm as EbzArticle;
    setArticles((prev) => {
      const idx = prev.findIndex((a) => a.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
    setSelectedArticleId(updated.id);
    setIsEditing(false);
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  const deleteArticle = (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту статью из базы знаний?')) return;
    setArticles((prev) => prev.filter((a) => a.id !== id));
    if (selectedArticleId === id) {
      setSelectedArticleId(null);
    }
  };

  // Интеллектуальный переход к органу на графе по ID или названию
  const handleOrgJump = (targetOrgId?: string, targetOrgName?: string) => {
    if (!onSelectOrg) return;
    if (targetOrgId && targetOrgId !== 'other') {
      const directMatch = allOrgs.find((o) => o.id === targetOrgId);
      if (directMatch) {
        onSelectOrg(directMatch.id);
        return;
      }
    }
    if (targetOrgName) {
      const nameLower = targetOrgName.toLowerCase();
      const nameMatch = allOrgs.find(
        (o) =>
          o.name.toLowerCase().includes(nameLower) ||
          (nameLower.length > 3 && nameLower.includes(o.name.toLowerCase()))
      );
      if (nameMatch) {
        onSelectOrg(nameMatch.id);
        return;
      }
    }
    if (targetOrgId) {
      onSelectOrg(targetOrgId);
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Шапка ЕБЗ: Заголовок, переключатель ведомства, язык, поиск */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Единая база знаний (ЕБЗ)</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  {filteredArticles.length} статей
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Реестр официальных статей, алгоритмов ответов гражданам и нормативно-правовых оснований
              </p>
            </div>
          </div>

          {/* Правая часть шапки: переключатель языков и кнопка добавления */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Переключатель языка RU / KK */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-black">
              <button
                type="button"
                onClick={() => setLang('ru')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  lang === 'ru'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Русский (RU)
              </button>
              <button
                type="button"
                onClick={() => setLang('kk')}
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  lang === 'kk'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Қазақша (KK)
              </button>
            </div>

            {/* Кнопка создания новой статьи */}
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Создать статью</span>
            </button>
          </div>
        </div>

        {/* Панель фильтров: Табы (Мое ведомство / Все), поисковая строка, теги */}
        <div className="flex flex-col md:flex-row items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* Табы приоритета: Мое ведомство / Все ведомства */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold shrink-0 w-full md:w-auto">
            {userOrgId && (
              <button
                type="button"
                onClick={() => setActiveScope('my')}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeScope === 'my'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Мое ведомство ({user?.orgName || 'МТ'})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveScope('all')}
              className={`flex-1 md:flex-none px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                activeScope === 'all'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Все ведомства РК</span>
            </button>
          </div>

          {/* Быстрый сквозной поиск по 5 полям одновременно */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Быстрый поиск по названию, тегам, сути, полному ответу и статьям НПА..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-medium transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Фильтр по тегам */}
          {allTags.length > 0 && (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              aria-label="Фильтр статей по тегу"
              className="px-3 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 outline-none font-bold text-slate-700 dark:text-slate-300 shrink-0"
            >
              <option value="all">Все теги ({allTags.length})</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          )}

          {/* Фильтр по организациям (если выбран режим Все) */}
          {activeScope === 'all' && (
            <select
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
              aria-label="Фильтр статей по ведомству"
              className="px-3 py-2.5 text-xs rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 outline-none font-bold text-slate-700 dark:text-slate-300 shrink-0 max-w-[220px] truncate"
            >
              <option value="all">Все органы ({orgOptions.length})</option>
              {orgOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Основная рабочая область: Слева список статей (карточки), Справа чтение/редактирование */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Левая колонка: Список статей */}
        <div className="lg:col-span-5 flex flex-col gap-2.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
          {filteredArticles.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
              Статьи не найдены по заданным критериям
            </div>
          ) : (
            filteredArticles.map((article) => {
              const isSelected = article.id === selectedArticleId;
              const title = lang === 'kk' ? article.titleKk || article.titleRu : article.titleRu;
              const summary = lang === 'kk' ? article.summaryKk || article.summaryRu : article.summaryRu;
              const orgName = lang === 'kk' ? article.orgNameKk || article.orgNameRu : article.orgNameRu;

              return (
                <div
                  key={article.id}
                  onClick={() => {
                    setSelectedArticleId(article.id);
                    setIsEditing(false);
                  }}
                  className={`p-4 rounded-3xl border-2 transition-all cursor-pointer select-none text-left flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/50 truncate max-w-[240px]">
                        <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span className="truncate">{orgName || 'Госорган'}</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {article.id}
                      </span>
                    </div>

                    <h3 className="text-xs font-black text-slate-900 dark:text-white leading-snug line-clamp-2">
                      {title || 'Без названия'}
                    </h3>

                    {summary && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                        {summary}
                      </p>
                    )}
                  </div>

                  {article.tags && article.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      {article.tags.slice(0, 3).map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Правая колонка: Просмотрщик / Редактор выбранной статьи */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 p-6 shadow-sm min-h-[500px]">
          {saveSuccessMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Статья успешно сохранена в базе знаний!</span>
            </div>
          )}

          {isEditing ? (
            /* Форма редактирования / создания статьи */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-600" />
                  <span>Редактирование статьи ({editForm.id})</span>
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={saveArticle}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all active:scale-95"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Сохранить</span>
                  </button>
                </div>
              </div>

              {/* Ответственный государственный орган (исполнитель регламента) */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2">
                <label className="text-[10px] font-bold uppercase text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Ответственный государственный орган (кто выполняет / ведет регламент):</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  <div className="md:col-span-8">
                    <select
                      value={editForm.orgId || ''}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        const selected = allOrgs.find((o) => o.id === targetId);
                        setEditForm({
                          ...editForm,
                          orgId: targetId,
                          orgNameRu: selected ? selected.name : editForm.orgNameRu,
                          orgNameKk: selected ? (selected.orgNameKk || selected.name) : editForm.orgNameKk,
                        });
                      }}
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      <option value="">-- Выберите ответственный госорган из реестра ({allOrgs.length} ведомств) --</option>
                      {allOrgs.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <input
                      type="text"
                      value={editForm.orgNameRu || ''}
                      onChange={(e) => setEditForm({ ...editForm, orgNameRu: e.target.value })}
                      placeholder="Отображаемое наименование..."
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none font-medium text-slate-800 dark:text-slate-200"
                      title="Краткое или альтернативное наименование органа"
                    />
                  </div>
                </div>
              </div>

              {/* Название на двух языках */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Заголовок (Русский):
                  </label>
                  <input
                    type="text"
                    value={editForm.titleRu || ''}
                    onChange={(e) => setEditForm({ ...editForm, titleRu: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Заголовок (Қазақша):
                  </label>
                  <input
                    type="text"
                    value={editForm.titleKk || ''}
                    onChange={(e) => setEditForm({ ...editForm, titleKk: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none font-bold"
                  />
                </div>
              </div>

              {/* Краткая суть / аннотация */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Краткая суть / Аннотация (RU):
                  </label>
                  <textarea
                    rows={4}
                    value={editForm.summaryRu || ''}
                    onChange={(e) => setEditForm({ ...editForm, summaryRu: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Краткая суть / Аннотация (KK):
                  </label>
                  <textarea
                    rows={4}
                    value={editForm.summaryKk || ''}
                    onChange={(e) => setEditForm({ ...editForm, summaryKk: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Полный регламентный ответ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Полный регламентный ответ (RU):
                  </label>
                  <textarea
                    rows={6}
                    value={editForm.fullResponseRu || ''}
                    onChange={(e) => setEditForm({ ...editForm, fullResponseRu: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500">
                    Полный регламентный ответ (KK):
                  </label>
                  <textarea
                    rows={6}
                    value={editForm.fullResponseKk || ''}
                    onChange={(e) => setEditForm({ ...editForm, fullResponseKk: e.target.value })}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Нормативно-правовые акты */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Связанные НПА и законы:
                </label>
                <input
                  type="text"
                  value={editForm.relatedNpaRu || ''}
                  onChange={(e) => setEditForm({ ...editForm, relatedNpaRu: e.target.value })}
                  placeholder="Закон РК, приказ министра, регламент госуслуги..."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>

              {/* Теги */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">
                  Теги (через запятую):
                </label>
                <input
                  type="text"
                  value={(editForm.tags || []).join(', ')}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="1414, госуслуги, лицензирование..."
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none"
                />
              </div>
            </div>
          ) : currentArticle ? (
            /* Просмотр статьи в красивом полноэкранном виде */
            <div className="space-y-5">
              {/* Шапка статьи: заголовок и действия */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1 flex-1 min-w-0">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                    {lang === 'kk' ? currentArticle.titleKk || currentArticle.titleRu : currentArticle.titleRu}
                  </h2>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(currentArticle)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-xs"
                    title="Редактировать статью"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Изменить</span>
                  </button>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => deleteArticle(currentArticle.id)}
                      className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                      title="Удалить статью"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Блок ответственного государственного органа (кто выполняет регламент) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase font-black tracking-wider text-indigo-600 dark:text-indigo-400">
                      Ответственный государственный орган (исполнитель):
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {lang === 'kk'
                        ? currentArticle.orgNameKk || currentArticle.orgNameRu
                        : currentArticle.orgNameRu || 'Орган не назначен'}
                    </div>
                  </div>
                </div>

                {onSelectOrg && (
                  <button
                    type="button"
                    onClick={() => handleOrgJump(currentArticle.orgId, currentArticle.orgNameRu)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black transition-all shrink-0 shadow-xs active:scale-95"
                    title="Показать ведомство на интерактивном графе"
                  >
                    <span>Орган на графе</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Теги статьи */}
              {currentArticle.tags && currentArticle.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  {currentArticle.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* 1. Краткая суть / аннотация */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Краткая суть / Аннотация вопроса:</span>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                  {(lang === 'kk'
                    ? currentArticle.summaryKk || currentArticle.summaryRu
                    : currentArticle.summaryRu) || 'Аннотация не заполнена.'}
                </div>
              </div>

              {/* 2. Полный регламентный ответ гражданину */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Регламентный ответ / Действия госоргана:</span>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {(lang === 'kk'
                    ? currentArticle.fullResponseKk || currentArticle.fullResponseRu
                    : currentArticle.fullResponseRu) || 'Полный ответ не заполнен.'}
                </div>
              </div>

              {/* 3. Нормативно-правовая база */}
              {currentArticle.relatedNpaRu && (
                <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-blue-900 dark:text-blue-300">
                    <Scale className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Нормативно-правовое основание (НПА):</span>
                  </div>
                  <p className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                    {lang === 'kk'
                      ? currentArticle.relatedNpaKk || currentArticle.relatedNpaRu
                      : currentArticle.relatedNpaRu}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">
              Выберите статью из списка слева для подробного просмотра
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
