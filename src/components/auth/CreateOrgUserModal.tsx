'use client';

import React, { useMemo, useState } from 'react';
import { GovOrg } from '@/types';
import { X, Copy, UserPlus } from 'lucide-react';

interface Props { isOpen: boolean; org: GovOrg; onClose: () => void }

export const CreateOrgUserModal: React.FC<Props> = ({ isOpen, org, onClose }) => {
  const login = useMemo(() => `org_${org.org_id || org.id}`.replace(/[^a-zA-Z0-9_-]/g, '_'), [org]);
  const [password] = useState(() => Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[n % 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.length]).join(''));
  const [role, setRole] = useState<'ORG_ADMIN' | 'VIEWER'>('ORG_ADMIN');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const accessText = `Логин: ${login}\nПароль: ${password}\nОрганизация: ${org.name}`;
  if (!isOpen) return null;

  const save = async () => {
    setSaving(true); setStatus('');
    const account = { username: login, password, role, orgId: String(org.org_id || org.id), orgName: org.name, canManageOrg: [String(org.org_id || org.id)] };
    try {
      const response = await fetch('/api/auth/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(account) });
      if (!response.ok) throw new Error('API недоступен');
      setStatus('Пользователь создан.');
    } catch {
      const key = 'gambit-offline-org-users';
      const users = JSON.parse(localStorage.getItem(key) || '[]');
      if (users.some((user: { username: string }) => user.username === login)) { setStatus('Логин уже сохранен в локальном списке.'); }
      else { localStorage.setItem(key, JSON.stringify([...users, account])); setStatus('Сохранено локально на этом устройстве.'); }
    } finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Создать пользователя организации" onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
      <header className="flex items-start justify-between"><div><h2 className="text-lg font-black">Создать пользователя</h2><p className="text-xs text-slate-500">Доступ для выбранного ведомства</p></div><button onClick={onClose} aria-label="Закрыть"><X size={18}/></button></header>
      <div className="grid gap-3 rounded-2xl bg-slate-50 p-3 text-xs dark:bg-slate-800"><div><b>Организация</b><p>{org.name}</p></div><div><b>Org ID</b><p>{org.org_id || org.id}</p></div><div><b>Логин</b><p className="font-mono">{login}</p></div><div><b>Пароль</b><p className="font-mono">{password}</p></div></div>
      <label className="block text-xs font-bold">Роль<select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 dark:bg-slate-950"><option value="ORG_ADMIN">Администратор ведомства</option><option value="VIEWER">Просмотр</option></select></label>
      <div className="flex flex-wrap justify-between gap-2"><button onClick={() => void navigator.clipboard.writeText(accessText)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"><Copy size={14}/>Скопировать доступы</button><button disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><UserPlus size={14}/>{saving ? 'Сохранение…' : 'Сохранить'}</button></div>
      {status && <p role="status" className="text-xs text-emerald-700">{status}</p>}
    </section>
  </div>;
};
