import crypto from 'crypto';
import { UserAccount, UserSession, UserRole } from '../types/auth';
import { GovOrg } from '../types';
import { getSessionSecret } from './secrets';
import { pool } from './db';

const COOKIE_NAME = 'ebz_session';

// Формат хеша: scrypt:<salt hex>:<hash hex> (без '$', чтобы не ломать подстановки в .env).
// Генерация: node scripts/hash_password.mjs
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [scheme, saltHex, hashHex] = encoded.split(':');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

const DUMMY_HASH = hashPassword(crypto.randomUUID());
const VALID_ROLES: UserRole[] = ['GLOBAL_ADMIN', 'ORG_ADMIN', 'VIEWER'];

interface PresetUserEntry {
  login: string;
  role: UserRole;
  passwordHash: string;
  id?: string;
  fullName?: string;
  orgId?: string | null;
  orgName?: string;
}

function parsePresetUsers(): PresetUserEntry[] {
  const raw = (process.env.EBZ_PRESET_USERS || '').trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[config] EBZ_PRESET_USERS обязателен в production (JSON-массив {login, role, passwordHash})');
    }
    console.warn('[config] EBZ_PRESET_USERS не задан — вход по предустановленным учётным записям недоступен (задайте в .env.local)');
    return [];
  }
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    throw new Error('[config] EBZ_PRESET_USERS: невалидный JSON');
  }
  if (!Array.isArray(list)) throw new Error('[config] EBZ_PRESET_USERS должен быть JSON-массивом');
  return list.map((e: any, i) => {
    if (!e || typeof e.login !== 'string' || !e.login.trim()) {
      throw new Error(`[config] EBZ_PRESET_USERS[${i}]: нет login`);
    }
    if (!VALID_ROLES.includes(e.role)) {
      throw new Error(`[config] EBZ_PRESET_USERS[${i}]: role должен быть один из ${VALID_ROLES.join(', ')}`);
    }
    if (typeof e.passwordHash !== 'string' || !e.passwordHash.startsWith('scrypt:')) {
      throw new Error(`[config] EBZ_PRESET_USERS[${i}]: passwordHash должен быть получен через scripts/hash_password.mjs`);
    }
    return e as PresetUserEntry;
  });
}

// Хранилище пользователей в памяти; предустановленные учётки загружаются лениво из окружения
let userStore: Map<string, UserAccount> | null = null;

function getUserStore(): Map<string, UserAccount> {
  if (userStore) return userStore;
  const store = new Map<string, UserAccount>();
  for (const e of parsePresetUsers()) {
    const login = e.login.trim().toLowerCase();
    store.set(login, {
      id: e.id || `user-${login}`,
      username: login,
      passwordHash: e.passwordHash,
      salt: '',
      fullName: e.fullName || login,
      role: e.role,
      orgId: e.orgId ?? null,
      orgName: e.orgName,
      createdAt: new Date().toISOString(),
    });
  }
  userStore = store;
  return store;
}

interface DbUserRow {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  full_name: string;
  org_id: string | null;
  org_name: string | null;
  is_active: boolean;
  created_at: Date | string;
}

function rowToAccount(r: DbUserRow): UserAccount {
  return {
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    salt: '',
    fullName: r.full_name,
    role: r.role,
    orgId: r.org_id,
    orgName: r.org_name ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

const PRIMARY_USERS_TABLE = 'ebz_book.users';
const LEGACY_USERS_TABLE = 'platform.ebz_users';

// Запрос к таблице учёток: сначала ebz_book.users, при 42P01 (relation does not exist) — platform.ebz_users.
async function queryUsersTable<T extends object = any>(sql: (table: string) => string, params: unknown[]) {
  try {
    return await pool.query<T>(sql(PRIMARY_USERS_TABLE), params);
  } catch (err) {
    if ((err as { code?: string }).code !== '42P01') throw err;
    return await pool.query<T>(sql(LEGACY_USERS_TABLE), params);
  }
}

type DbLookup = { source: 'db'; user: UserAccount | null; isActive: boolean } | { source: 'fallback' };

// Основной источник — ebz_book.users. Fallback на EBZ_PRESET_USERS при недоступной БД или пустой таблице.
async function lookupDbUser(login: string): Promise<DbLookup> {
  try {
    const res = await queryUsersTable<DbUserRow>(
      (t) => `SELECT id, username, password_hash, role, full_name, org_id, org_name, is_active, created_at
         FROM ${t} WHERE lower(username) = $1`,
      [login]
    );
    if (res.rows[0]) {
      return { source: 'db', user: rowToAccount(res.rows[0]), isActive: res.rows[0].is_active };
    }
    const cnt = await queryUsersTable((t) => `SELECT 1 FROM ${t} LIMIT 1`, []);
    if (cnt.rowCount === 0) return { source: 'fallback' };
    return { source: 'db', user: null, isActive: false };
  } catch (err) {
    console.warn('[auth] ebz_book.users/platform.ebz_users недоступны, fallback на EBZ_PRESET_USERS:', (err as Error).message);
    return { source: 'fallback' };
  }
}

async function touchLastLogin(id: string): Promise<void> {
  try {
    await queryUsersTable((t) => `UPDATE ${t} SET last_login_at = NOW() WHERE id = $1`, [id]);
  } catch (err) {
    console.warn('[auth] не удалось обновить last_login_at:', (err as Error).message);
  }
}

export const authService = {
  async createUser(data: {
    username: string;
    password: string;
    fullName: string;
    role: UserRole;
    orgId?: string;
    orgName?: string;
  }): Promise<UserAccount> {
    const account: UserAccount = {
      id: `user-${crypto.randomUUID()}`,
      username: data.username,
      passwordHash: hashPassword(data.password),
      salt: '',
      fullName: data.fullName,
      role: data.role,
      orgId: data.orgId ?? null,
      orgName: data.orgName,
      createdAt: new Date().toISOString(),
    };

    const login = data.username.trim().toLowerCase();
    account.username = login;
    try {
      await queryUsersTable(
        (t) => `INSERT INTO ${t} (id, username, password_hash, role, full_name, org_id, org_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role,
           full_name = EXCLUDED.full_name, org_id = EXCLUDED.org_id, org_name = EXCLUDED.org_name`,
        [account.id, login, account.passwordHash, account.role, account.fullName, account.orgId, account.orgName ?? null]
      );
    } catch (err) {
      console.warn('[auth] createUser: БД недоступна, учётка только в памяти:', (err as Error).message);
    }
    getUserStore().set(login, account);
    return account;
  },

  async authenticate(username: string, password: string): Promise<UserSession | null> {
    const login = username.trim().toLowerCase();
    const found = await lookupDbUser(login);
    const user = found.source === 'db' ? found.user ?? undefined : getUserStore().get(login);
    if (!user) {
      verifyPassword(password, DUMMY_HASH); // выравниваем время ответа
      return null;
    }
    if (!verifyPassword(password, user.passwordHash)) return null;
    if (found.source === 'db') {
      if (!found.isActive) return null;
      await touchLastLogin(user.id);
    }

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
      .createHmac('sha256', getSessionSecret())
      .update(payload)
      .digest('hex');
    return `${payload}.${signature}`;
  },

  verifySessionToken(token: string): UserSession | null {
    if (!token || !token.includes('.')) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payload)
      .digest('hex');

    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

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

    const orgMap = new Map<string, GovOrg>(allOrgs.map((o) => [o.id, o]));
    const idMatches = (org: GovOrg, id: string) => {
      const normalized = id.toLowerCase();
      return org.id.toLowerCase() === normalized || String(org.org_id || '') === normalized ||
        ((normalized === 'apr' || normalized === 'gov' || normalized === '30400') &&
          (org.id.toLowerCase() === 'apr' || org.id.toLowerCase() === 'gov' || String(org.org_id || '') === '30400'));
    };
    const userOrg = allOrgs.find((org) => idMatches(org, user.orgId!));
    const targetOrg = allOrgs.find((org) => idMatches(org, targetOrgId));
    if (targetOrg && userOrg && targetOrg.id === userOrg.id) return { allowed: true };
    if (!userOrg || !targetOrg) {
      return { allowed: false, reason: `Организация находится вне юрисдикции вашего ведомства (${user.orgName || user.orgId})` };
    }
    if (targetOrg.parentId === userOrg.parentId) {
      return { allowed: false, reason: 'Организация находится на одном уровне с вашим ведомством. Редактирование смежных ведомств запрещено.' };
    }

    if (targetOrg.path && userOrg.path) {
      const parentPath = userOrg.path.endsWith('/') ? userOrg.path : `${userOrg.path}/`;
      if (targetOrg.path.startsWith(parentPath)) return { allowed: true };
    }

    let currId: string | null = targetOrg.parentId;
    const visited = new Set<string>();
    while (currId && !visited.has(currId)) {
      if (currId === userOrg.id) return { allowed: true };
      visited.add(currId);
      currId = orgMap.get(currId)?.parentId || null;
    }

    return {
      allowed: false,
      reason: `Организация находится вне юрисдикции вашего ведомства (${user.orgName || user.orgId})`,
    };
  }

  return { allowed: false, reason: 'Недостаточно прав доступа' };
}
