'use client';

import React, { useMemo, useState } from 'react';
import { X, Search, GitCompareArrows, MapPin, Building2 } from 'lucide-react';
import { GovOrg } from '@/types';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgA: GovOrg;
  allOrgs: GovOrg[];
  onPinBesideOnGraph: (orgA: GovOrg, orgB: GovOrg) => void;
}

const levelLabels: Record<string, string> = {
  central: 'Центральный орган', agency: 'Ведомство', regional: 'Региональный орган', district: 'Районный орган',
};

export const CompareModal: React.FC<CompareModalProps> = ({ isOpen, onClose, orgA, allOrgs, onPinBesideOnGraph }) => {
  const [query, setQuery] = useState('');
  const [orgBId, setOrgBId] = useState('');
  const orgB = allOrgs.find((org) => org.id === orgBId);
  const matches = useMemo(() => {
    const tokens = query.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean);
    return allOrgs.filter((org) => org.id !== orgA.id && tokens.every((token) => `${org.name} ${org.fullName}`.toLocaleLowerCase('ru').includes(token))).slice(0, 8);
  }, [allOrgs, orgA.id, query]);
  if (!isOpen) return null;

  const childCount = (org: GovOrg) => allOrgs.filter((candidate) => candidate.parentId === org.id).length;
  const value = (text?: string | null) => text?.trim() || 'Не указано';
  const contacts = (org: GovOrg) => [org.contacts?.phoneChancellery && `Канцелярия: ${org.contacts.phoneChancellery}`, org.contacts?.phoneHotline && `Горячая линия: ${org.contacts.phoneHotline}`, org.contacts?.emailOfficial, org.contacts?.websiteUrl].filter(Boolean).join(' · ') || 'Не указано';
  const rows = [
    ['Краткое и полное наименование', (org: GovOrg) => <><strong>{org.name}</strong><div className="mt-1 text-xs font-normal text-slate-500">{org.fullName}</div></>],
    ['Сфера компетенций', (org: GovOrg) => value(org.scope || org.theme)],
    ['Исключенные вопросы / перенаправления', (org: GovOrg) => <>{value(org.competenciesExcluded)}<div className="mt-2 border-t border-slate-100 pt-2"><b>Перенаправление:</b> {value(org.forwardToGuidance)}</div></>],
    ['Юрисдикция и локация', (org: GovOrg) => <>{org.jurisdiction || 'Не указана'}<div className="mt-1 flex items-start gap-1 text-slate-500"><MapPin size={14} className="mt-0.5 shrink-0" />{value(org.locationAddress || org.katoNameRu)}</div></>],
    ['Контакты канцелярии / горячей линии', contacts],
    ['Подразделения', (org: GovOrg) => <span className="inline-flex items-center gap-1"><Building2 size={14}/>{childCount(org)} дочерних организаций · {org.departments?.length || 0} внутренних подразделений</span>],
  ] as const;

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Сравнение организаций" onClick={(event) => event.stopPropagation()} className="flex max-h-[92vh] w-[92vw] max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <header className="relative flex flex-col gap-4 border-b border-slate-200 p-4 pr-14 sm:p-5 sm:pr-14 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2"><GitCompareArrows className="text-blue-600" size={20}/><h2 className="text-lg font-black">Сравнение организаций</h2></div>
          <p className="mt-1 text-xs text-slate-500">Сопоставьте компетенции, юрисдикцию и контакты</p>
        </div>
        <div className="relative max-w-xl">
          <label className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300" htmlFor="compare-org-search">Вторая организация</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
            <input id="compare-org-search" aria-label="Поиск второй организации для сравнения" value={query} onChange={(event) => { setQuery(event.target.value); setOrgBId(''); }} placeholder="Введите название организации" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950" autoComplete="off"/>
          </div>
          {query && !orgB && <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">{matches.map((org) => <button type="button" key={org.id} onClick={() => { setOrgBId(org.id); setQuery(org.name); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-800"><span className="block text-sm font-bold">{org.name}</span><span className="block truncate text-xs text-slate-500">{org.fullName}</span></button>)}{matches.length === 0 && <div className="p-3 text-xs text-slate-500">Организации не найдены</div>}</div>}
          {orgB && <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Выбрано: {orgB.name}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="absolute right-3 top-3 rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18}/></button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-5">
        <div className="grid grid-cols-[minmax(130px,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <div className="pt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Параметр</div>
          {[orgA, orgB].map((org, index) => <div key={index} className="min-h-24 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/70"><div className="mb-2 inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{index === 0 ? 'Текущая организация' : 'Для сравнения'}</div><div className="text-base font-black">{org?.name || 'Выберите организацию'}</div>{org && <><div className="mt-1 text-xs text-slate-500">{levelLabels[org.level] || org.level}</div><div className="mt-1 text-xs text-slate-500">{org.fullName}</div></>}</div>)}
          {rows.map(([label, render]) => <React.Fragment key={label}><div className="border-b border-slate-100 py-4 text-xs font-bold text-slate-600 dark:border-slate-800 dark:text-slate-300">{label}</div><div className="border-b border-slate-100 py-4 text-sm leading-relaxed dark:border-slate-800">{render(orgA)}</div><div className="border-b border-slate-100 py-4 text-sm leading-relaxed dark:border-slate-800">{orgB ? render(orgB) : <span className="text-slate-400">Выберите вторую организацию в поле выше</span>}</div></React.Fragment>)}
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><p className="text-xs text-slate-500">Обе организации будут показаны на графе через их родительские ветви.</p><button type="button" disabled={!orgB} onClick={() => orgB && onPinBesideOnGraph(orgA, orgB)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Открыть обе организации на графе рядом</button></footer>
    </section>
  </div>;
};
