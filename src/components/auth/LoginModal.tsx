'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Lock,
  User,
  ShieldCheck,
  Building2,
  Eye,
  KeyRound,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, testAccounts } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Пожалуйста, введите логин и пароль');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const res = await login(username.trim(), password.trim());
    setIsLoading(false);

    if (res.ok) {
      onClose();
    } else {
      setErrorMsg(res.error || 'Ошибка входа');
    }
  };

  const handleQuickLogin = async (accUsername: string, accPass: string) => {
    setUsername(accUsername);
    setPassword(accPass);
    setIsLoading(true);
    setErrorMsg(null);

    const res = await login(accUsername, accPass);
    setIsLoading(false);

    if (res.ok) {
      onClose();
    } else {
      setErrorMsg(res.error || 'Ошибка входа');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Шапка */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Авторизация в Е-Отиниш
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Защищенный ведомственный доступ к маршрутизации
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

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[85vh]">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Форма ввода */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                Имя пользователя (Логин)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin_miicr"
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-bold rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none transition-colors"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                Пароль
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-bold rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 outline-none transition-colors"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Проверка...' : 'Войти в систему'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Разделитель */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-3 text-[10px] font-black uppercase text-slate-400">
              Быстрый вход для тестов
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          {/* Тестовые учетные записи */}
          <div className="space-y-2">
            <p className="text-[11px] text-slate-500 font-medium">
              Выберите учетную запись для мгновенной проверки прав и юрисдикций:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* 1. Superadmin */}
              <button
                type="button"
                onClick={() => handleQuickLogin('superadmin', 'admin8391')}
                className="p-3 rounded-2xl border-2 border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Супер-админ
                  </span>
                  <span className="text-[9px] font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                    admin8391
                  </span>
                </div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1">
                  superadmin
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Вся республика (АП РК)
                </div>
              </button>

              {/* 2. Admin MIICR */}
              <button
                type="button"
                onClick={() => handleQuickLogin('admin_miicr', 'miicr7419')}
                className="p-3 rounded-2xl border-2 border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-400 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    Админ МИИЦР
                  </span>
                  <span className="text-[9px] font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300">
                    miicr7419
                  </span>
                </div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1">
                  admin_miicr
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Только МИИЦР и подотчетные
                </div>
              </button>

              {/* 3. Admin Astana */}
              <button
                type="button"
                onClick={() => handleQuickLogin('admin_astana', 'astana5283')}
                className="p-3 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    Акимат Астаны
                  </span>
                  <span className="text-[9px] font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                    astana5283
                  </span>
                </div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1">
                  admin_astana
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Только Акимат и коммунальные
                </div>
              </button>

              {/* 4. Viewer */}
              <button
                type="button"
                onClick={() => handleQuickLogin('viewer', 'guest1048')}
                className="p-3 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    Наблюдатель
                  </span>
                  <span className="text-[9px] font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                    guest1048
                  </span>
                </div>
                <div className="text-xs font-black text-slate-800 dark:text-slate-200 mt-1">
                  viewer
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Только просмотр без редактирования
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
