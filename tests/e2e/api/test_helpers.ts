import fs from 'fs';
import path from 'path';

export const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3050';

export interface AuthTokens {
  /** внутри периметра (gate открыт), но без входа */
  unauth: string;
  /** полностью снаружи: ни gate, ни сессии */
  noGate: string;
  gateOnly: string;
  viewer: string;
  methodologist: string;
  superadmin: string;
}

function gatePassword(): string {
  const fromEnv = process.env.TEST_GATE_PASSWORD || process.env.SITE_GATE_PASSWORD;
  if (fromEnv) return fromEnv;
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const m = raw.match(/^SITE_GATE_PASSWORD=(.*)$/m);
    if (m) return m[1].trim();
  } catch {}
  throw new Error('Set TEST_GATE_PASSWORD (site gate password of the server under test)');
}

export const GATE_PASSWORD = gatePassword();

/** Получает подписанную gate-куку (`site_gate_pass=...`) у сервера. */
export async function obtainGateCookie(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/gate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: GATE_PASSWORD }),
  });
  const m = (res.headers.get('set-cookie') || '').match(/site_gate_pass=([^;]+)/);
  if (!res.ok || !m) throw new Error(`Gate unlock failed: ${res.status}`);
  return `site_gate_pass=${m[1]}`;
}

let cachedGate: string | null = null;
async function defaultGateCookie(): Promise<string> {
  return (cachedGate ||= await obtainGateCookie());
}

let cachedTokens: AuthTokens | null = null;

async function loginAndGetCookie(username: string, password: string, gate: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: gate },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`Failed to login as ${username}: ${res.status} ${await res.text()}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error(`No set-cookie header received for ${username}`);
  }
  // Extract ebz_session cookie value
  const match = setCookie.match(/ebz_session=([^;]+)/);
  if (!match) {
    throw new Error(`Could not parse ebz_session from ${setCookie}`);
  }
  return `ebz_session=${match[1]}`;
}

export async function getAuthCookies(): Promise<AuthTokens> {
  if (cachedTokens) return cachedTokens;

  const gate = await obtainGateCookie();
  const viewer = await loginAndGetCookie('viewer', 'guest1048', gate);
  const methodologist = await loginAndGetCookie('admin_minenergo', 'energo2026', gate);
  const superadmin = await loginAndGetCookie('superadmin', 'admin8391', gate);

  cachedTokens = {
    unauth: gate,
    noGate: '',
    gateOnly: gate,
    viewer: `${gate}; ${viewer}`,
    methodologist: `${gate}; ${methodologist}`,
    superadmin: `${gate}; ${superadmin}`,
  };

  return cachedTokens;
}

export async function apiRequest(
  endpoint: string,
  options: {
    method?: string;
    cookie?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
) {
  const url = `${BASE_URL}${endpoint}`;
  const headers: Record<string, string> = { ...(options.headers || {}) };

  // cookie не указан -> только gate-кука; cookie: '' -> совсем без кук (аноним снаружи периметра)
  const cookie = options.cookie === undefined ? await defaultGateCookie() : options.cookie;
  if (cookie) {
    headers['Cookie'] = cookie;
  }

  let bodyStr: any = undefined;
  if (options.body !== undefined) {
    if (options.body instanceof FormData || Buffer.isBuffer(options.body)) {
      bodyStr = options.body;
    } else if (typeof options.body === 'string') {
      bodyStr = options.body;
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    } else {
      bodyStr = JSON.stringify(options.body);
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: bodyStr,
  });

  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else if (contentType.includes('text/')) {
    data = await res.text();
  } else {
    data = await res.arrayBuffer();
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
  };
}
