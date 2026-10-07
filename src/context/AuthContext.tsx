'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserSession } from '../types/auth';
import { GovOrg } from '../types';

interface TestAccountInfo {
  username: string;
  password: string;
  role: string;
  fullName: string;
  orgName?: string;
}

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  testAccounts: TestAccountInfo[];
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  canManageOrg: (orgId: string | null | undefined, allOrgs: GovOrg[]) => { allowed: boolean; reason?: string };
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [testAccounts, setTestAccounts] = useState<TestAccountInfo[]>([]);

  // Загрузка текущей сессии
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.ok) {
        setUser(data.user || null);
        if (data.testAccounts) {
          setTestAccounts(data.testAccounts);
        }
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.ok && data.user) {
        setUser(data.user);
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Ошибка авторизации' };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Ошибка сети' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  const canManageOrg = useCallback(
    (targetOrgId: string | null | undefined, allOrgs: GovOrg[]) => {
      if (!user) {
        return { allowed: false, reason: 'Требуется авторизация в системе' };
      }
      if (user.role === 'VIEWER') {
        return { allowed: false, reason: 'Режим только чтение' };
      }
      if (user.role === 'GLOBAL_ADMIN') {
        return { allowed: true };
      }
      if (user.role === 'ORG_ADMIN') {
        if (!user.orgId) {
          return { allowed: false, reason: 'Ведомство не привязано к учетной записи' };
        }
        if (!targetOrgId) {
          return {
            allowed: false,
            reason: 'Создание корневых ведомств доступно только администраторам республиканского уровня',
          };
        }
        if (targetOrgId === user.orgId) {
          return { allowed: true };
        }

        const orgMap = new Map<string, GovOrg>(allOrgs.map((o) => [o.id, o]));
        let currId: string | null = targetOrgId;
        const visited = new Set<string>();

        while (currId && !visited.has(currId)) {
          visited.add(currId);
          const org = orgMap.get(currId);
          if (!org) break;
          if (org.parentId === user.orgId) {
            return { allowed: true };
          }
          currId = org.parentId;
        }

        return {
          allowed: false,
          reason: `Организация вне вашей юрисдикции (${user.orgName || user.orgId})`,
        };
      }
      return { allowed: false, reason: 'Недостаточно прав' };
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        testAccounts,
        login,
        logout,
        canManageOrg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
