import crypto from 'crypto';
import { UserAccount, UserSession, UserRole } from '../types/auth';
import { GovOrg } from '../types';

const SESSION_SECRET = process.env.SESSION_SECRET || 'ebz-router-super-secret-key-2026-auth';
const COOKIE_NAME = 'ebz_session';

// Хеширование пароля через pbkdf2
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Предварительно созданные учетные записи
const PRESET_USERS_CONFIG = [
  {
    id: 'user-superadmin',
    username: 'superadmin',
    password: 'admin8391',
    fullName: 'Супер-администратор (АП РК)',
    role: 'GLOBAL_ADMIN' as UserRole,
    orgId: null,
    orgName: 'Вся республика',
  },
  {
    id: 'user-admin-miicr',
    username: 'admin_miicr',
    password: 'miicr7419',
    fullName: 'Администратор МИИЦР',
    role: 'ORG_ADMIN' as UserRole,
    orgId: 'miicr',
    orgName: 'МИИЦР',
  },
  {
    id: 'user-admin-astana',
    username: 'admin_astana',
    password: 'astana5283',
    fullName: 'Администратор Акимата г. Астаны',
    role: 'ORG_ADMIN' as UserRole,
    orgId: 'akimat-astana',
    orgName: 'Акимат Астана',
  },
  {
    id: 'user-viewer',
    username: 'viewer',
    password: 'guest1048',
    fullName: 'Наблюдатель (Аналитик)',
    role: 'VIEWER' as UserRole,
    orgId: null,
    orgName: 'Режим чтения',
  },
];

// Инициализируем хранилище пользователей в памяти
const userStore = new Map<string, UserAccount>();

PRESET_USERS_CONFIG.forEach((cfg) => {
  const salt = generateSalt();
  const passwordHash = hashPassword(cfg.password, salt);
  userStore.set(cfg.username, {
    id: cfg.id,
    username: cfg.username,
    passwordHash,
    salt,
    fullName: cfg.fullName,
    role: cfg.role,
    orgId: cfg.orgId,
    orgName: cfg.orgName,
    createdAt: new Date().toISOString(),
  });
});

export const authService = {
  getPresetCredentialsInfo() {
    return PRESET_USERS_CONFIG.map((u) => ({
      username: u.username,
      password: u.password,
      role: u.role,
      fullName: u.fullName,
      orgName: u.orgName,
    }));
  },

  authenticate(username: string, password: string): UserSession | null {
    const user = userStore.get(username.trim().toLowerCase());
    if (!user) return null;

    const hash = hashPassword(password, user.salt);
    if (hash !== user.passwordHash) return null;

    // Срок действия сессии: 7 дней
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    return {
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      orgId: user.orgId,
      orgName: user.orgName,
      expiresAt,
    };
  },

  createSignedSessionToken(session: UserSession): string {
    const payload = Buffer.from(JSON.stringify(session)).toString('base64');
    const signature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('hex');
    return `${payload}.${signature}`;
  },

  verifySessionToken(token: string): UserSession | null {
    if (!token || !token.includes('.')) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) return null;

    try {
      const session: UserSession = JSON.parse(
        Buffer.from(payload, 'base64').toString('utf8')
      );
      if (session.expiresAt && Date.now() > session.expiresAt) {
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  COOKIE_NAME,
};

/**
 * Проверка юрисдикции: может ли пользователь управлять данной организацией
 */
export function canUserManageOrg(
  user: UserSession | null,
  targetOrgId: string | null | undefined,
  allOrgs: GovOrg[]
): { allowed: boolean; reason?: string } {
  if (!user) {
    return {
      allowed: false,
      reason: 'Требуется авторизация в системе',
    };
  }

  if (user.role === 'VIEWER') {
    return {
      allowed: false,
      reason: 'Учетная запись имеет права только на просмотр',
    };
  }

  if (user.role === 'GLOBAL_ADMIN') {
    return { allowed: true };
  }

  // Для ORG_ADMIN проверяем ведомственную юрисдикцию
  if (user.role === 'ORG_ADMIN') {
    if (!user.orgId) {
      return { allowed: false, reason: 'Ведомство пользователя не определено' };
    }

    if (!targetOrgId) {
      // Создание корневой структуры разрешено только GLOBAL_ADMIN
      return {
        allowed: false,
        reason: 'Создание корневых ведомств доступно только администраторам республиканского уровня',
      };
    }

    // Если это сама организация пользователя
    if (targetOrgId === user.orgId) {
      return { allowed: true };
    }

    // Проверяем, является ли targetOrgId потомком user.orgId
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
      reason: `Организация находится вне юрисдикции вашего ведомства (${user.orgName || user.orgId})`,
    };
  }

  return { allowed: false, reason: 'Недостаточно прав доступа' };
}
