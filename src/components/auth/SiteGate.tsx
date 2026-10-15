'use client';

import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, ShieldCheck, ArrowRight, Eye, EyeOff, Sparkles, AlertCircle } from 'lucide-react';

interface SiteGateProps {
  children: React.ReactNode;
}

export const SiteGate: React.FC<SiteGateProps> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // 1. Проверяем localStorage для быстрого старта без мигания
    const cached = localStorage.getItem('site_gate_pass');
    if (cached === 'unlocked_2026') {
      setIsUnlocked(true);
      return;
    }

    // 2. Проверяем серверную cookie
    fetch('/api/gate')
      .then((res) => res.json())
      .then((data) => {
        if (data.unlocked) {
          setIsUnlocked(true);
          localStorage.setItem('site_gate_pass', 'unlocked_2026');
        } else {
          setIsUnlocked(false);
        }
      })
      .catch(() => setIsUnlocked(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsUnlocked(true);
        localStorage.setItem('site_gate_pass', 'unlocked_2026');
      } else {
        setErrorMsg(data.error || 'Неверный пароль доступа');
      }
    } catch (err: any) {
      setErrorMsg('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  // Пока идет проверка — не мигаем контентом
  if (isUnlocked === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Если доступ открыт — рендерим всё приложение со всеми ролями и графами
  if (isUnlocked) {
    return <>{children}</>;
  }

  // Экран закрытого контура с запросом пароля
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden font-sans">
      {/* Фоновые градиенты */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Верхняя шапка шлюза */}
      <header className="p-6 flex items-center justify-between border-b border-slate-900 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md">
            ЕБЗ
          </div>
          <div>
            <h1 className="text-xs font-black tracking-wide text-white">eOtinish Platform</h1>
            <p className="text-[10px] text-slate-500 font-medium">Закрытый контур демонстрации</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Защищенный периметр</span>
        </div>
      </header>

      {/* Центральная карточка ввода пароля */}
      <main className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-7 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black text-white">Доступ к платформе</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Платформа находится в закрытом режиме. Для просмотра структуры 566 госорганов, базы ЕБЗ и ИИ-маршрутизатора введите пароль.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                <span>Пароль доступа к сайту:</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль..."
                  autoFocus
                  required
                  className="w-full px-4 py-3 text-sm rounded-2xl bg-slate-950 border border-slate-800 focus:border-indigo-500 outline-none text-white font-medium pr-11 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-2 text-slate-500 hover:text-slate-300 absolute right-2 top-2 rounded-xl transition-colors"
                  title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={!password.trim() || isLoading}
              className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30 active:scale-98"
            >
              <span>{isLoading ? 'Проверка...' : 'Открыть доступ'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 border-t border-slate-800/80 text-center text-[10px] text-slate-500">
            После входа вам будут доступны все функции, ролевая модель и ИИ-инструменты.
          </div>
        </div>
      </main>

      {/* Подвал */}
      <footer className="p-4 text-center text-[11px] text-slate-600 z-10">
        Республика Казахстан • eOtinish Platform & EBZ Router 2026
      </footer>
    </div>
  );
};
