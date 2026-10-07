'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoginModal } from './LoginModal';
import {
  User,
  ShieldCheck,
  Building2,
  Eye,
  LogOut,
  ChevronDown,
  Lock,
  ArrowRightLeft,
} from 'lucide-react';

export const UserBadge: React.FC = () => {
  const { user, logout, login } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMenuOpen]);

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsLoginOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all shadow-md active:scale-95"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Войти</span>
        </button>
        <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      </>
    );
  }

  const getRoleBadge = () => {
    switch (user.role) {
      case 'GLOBAL_ADMIN':
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />,
          label: 'Супер-админ',
          bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      case 'ORG_ADMIN':
        return {
          icon: <Building2 className="w-3.5 h-3.5 text-blue-500" />,
          label: user.orgName || 'Админ органа',
          bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        };
      case 'VIEWER':
      default:
        return {
          icon: <Eye className="w-3.5 h-3.5 text-slate-500" />,
          label: 'Только чтение',
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  const badgeInfo = getRoleBadge();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl border-2 text-xs font-bold transition-all shadow-xs ${badgeInfo.bg}`}
      >
        <div className="w-5 h-5 rounded-full bg-white dark:bg-slate-900 shadow-xs flex items-center justify-center">
          {badgeInfo.icon}
        </div>
        <div className="flex flex-col text-left leading-tight">
          <span className="font-extrabold truncate max-w-[130px]">{user.fullName}</span>
          <span className="text-[10px] opacity-75">{badgeInfo.label}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>

      {/* Выпадающее меню профиля и быстрого переключения */}
      {isMenuOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-800 p-2.5 z-50 animate-fadeIn">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 mb-2">
            <div className="text-xs font-black text-slate-900 dark:text-white truncate">
              {user.fullName}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
              <span>Логин: @{user.username}</span>
            </div>
            {user.orgName && (
              <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-1">
                Юрисдикция: {user.orgName}
              </div>
            )}
          </div>

          <div className="text-[10px] font-black uppercase text-slate-400 px-2 mb-1.5 flex items-center gap-1">
            <ArrowRightLeft className="w-3 h-3" />
            <span>Переключить профиль:</span>
          </div>

          <div className="space-y-1">
            <button
              type="button"
              onClick={async () => {
                await login('superadmin', 'admin8391');
                setIsMenuOpen(false);
              }}
              className={`w-full p-2 rounded-xl text-left text-xs transition-colors flex items-center justify-between ${
                user.username === 'superadmin'
                  ? 'bg-amber-100/70 dark:bg-amber-950 font-bold text-amber-900 dark:text-amber-200'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>Супер-админ (АП РК)</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400">admin8391</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await login('admin_miicr', 'miicr7419');
                setIsMenuOpen(false);
              }}
              className={`w-full p-2 rounded-xl text-left text-xs transition-colors flex items-center justify-between ${
                user.username === 'admin_miicr'
                  ? 'bg-blue-100/70 dark:bg-blue-950 font-bold text-blue-900 dark:text-blue-200'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Админ МИИЦР</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400">miicr7419</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await login('admin_astana', 'astana5283');
                setIsMenuOpen(false);
              }}
              className={`w-full p-2 rounded-xl text-left text-xs transition-colors flex items-center justify-between ${
                user.username === 'admin_astana'
                  ? 'bg-emerald-100/70 dark:bg-emerald-950 font-bold text-emerald-900 dark:text-emerald-200'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Акимат г. Астаны</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400">astana5283</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await login('viewer', 'guest1048');
                setIsMenuOpen(false);
              }}
              className={`w-full p-2 rounded-xl text-left text-xs transition-colors flex items-center justify-between ${
                user.username === 'viewer'
                  ? 'bg-slate-200 dark:bg-slate-800 font-bold text-slate-900 dark:text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Наблюдатель (Чтение)</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400">guest1048</span>
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 mt-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                await logout();
                setIsMenuOpen(false);
              }}
              className="w-full p-2 rounded-xl text-left text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти из учетной записи</span>
            </button>
          </div>
        </div>
      )}

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
};
