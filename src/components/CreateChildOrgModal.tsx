'use client';

import React, { useState, useEffect } from 'react';
import { GovOrg, JurisdictionLevel } from '../types';
import {
  X,
  Building2,
  GitFork,
  FileText,
  MapPin,
  Globe,
  AlertCircle,
  Plus,
  Check,
  ChevronDown,
} from 'lucide-react';

interface CreateChildOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentOrg: GovOrg | null;
  allOrgs: GovOrg[];
  onCreate: (data: {
    name: string;
    fullName: string;
    parentId: string | null;
    scope: string;
    locationAddress: string;
    jurisdiction: JurisdictionLevel;
  }) => Promise<void>;
}

export const CreateChildOrgModal: React.FC<CreateChildOrgModalProps> = ({
  isOpen,
  onClose,
  parentOrg,
  allOrgs,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [scope, setScope] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [jurisdiction, setJurisdiction] = useState<JurisdictionLevel>('republican');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Сброс формы при открытии
  useEffect(() => {
    if (isOpen) {
      setName('');
      setFullName('');
      setScope('');
      setLocationAddress('');
      setJurisdiction('republican');
      setSelectedParentId(parentOrg ? parentOrg.id : null);
      setErrorMsg(null);
    }
  }, [isOpen, parentOrg]);

  if (!isOpen) return null;

  const currentParent = allOrgs.find((o) => o.id === selectedParentId) || parentOrg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Пожалуйста, укажите краткое наименование организации');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await onCreate({
        name: name.trim(),
        fullName: fullName.trim() || name.trim(),
        parentId: selectedParentId,
        scope: scope.trim(),
        locationAddress: locationAddress.trim(),
        jurisdiction,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка создания организации');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Создание подотчетной организации
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Добавление нового ведомства или подведомственной структуры в базу знаний
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Форма с прокруткой */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Карточка вышестоящего органа (Родитель) */}
          <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-700 dark:text-blue-300">
                <GitFork className="w-4 h-4 text-blue-600" />
                <span>Вышестоящая организация (Подотчетна кому):</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Родитель</span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {currentParent ? currentParent.name : '— Корневой уровень (Без вышестоящего органа)'}
                </div>
                {currentParent && (
                  <div className="text-[11px] text-slate-500 truncate">
                    {currentParent.fullName}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 1. Краткое наименование */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
              Краткое наименование <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11px] text-slate-500">
              Короткое название для отображения в графе связей, списках и кнопках.
            </p>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!fullName) setFullName(e.target.value);
              }}
              placeholder="Например: ТОО «КазТрейд», РГП «Центр экспертизы», Комитет телекоммуникаций"
              className="w-full p-3 text-xs font-bold rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          {/* 2. Полное официальное наименование */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
              Полное официальное наименование
            </label>
            <p className="text-[11px] text-slate-500">
              Юридическое название организации в соответствии с положением или уставом.
            </p>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Например: Товарищество с ограниченной ответственностью «Центр развития торговой политики «QazTrade»"
              className="w-full p-3 text-xs rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          {/* 3. Полномочия, задачи и компетенции */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Полномочия, задачи и компетенции ведомства</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Сфера ответственности, предметная тематика обращений граждан и задачи организации.
            </p>
            <textarea
              rows={4}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Опишите, чем занимается данная организация, какие типовые обращения граждан решает, за какие услуги и вопросы отвечает..."
              className="w-full p-3 text-xs rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none leading-relaxed transition-colors"
            />
          </div>

          {/* 4. Фактическое местонахождение (Локация) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Фактическое местонахождение (Локация)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Город и фактический адрес главного здания организации.
            </p>
            <input
              type="text"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              placeholder="Например: г. Астана, ул. Достык, 18, БЦ «Москва», 5 этаж"
              className="w-full p-3 text-xs rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none transition-colors"
            />
          </div>

          {/* Подсказка */}
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            💡 <strong>Совет:</strong> После создания организация сразу появится в структуре. Вы сможете загрузить для нее пакет тематических вопросов и ответов во вкладке <strong>«Вопросы и темы»</strong> через форму или CSV-импорт.
          </div>
        </form>

        {/* Футер */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-2xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            {isSubmitting ? 'Создание...' : 'Создать организацию'}
          </button>
        </div>
      </div>
    </div>
  );
};
