// Секреты окружения. Edge-совместимо (только Web Crypto, без node:crypto).
// Читаются лениво, чтобы `next build` не падал без секретов; в production отсутствие секрета — фатально.

const g = globalThis as unknown as { __ebzDevSecrets?: Record<string, string> };

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromEnv(name: string, minLength: number): string {
  const value = (process.env[name] || '').trim();
  if (value) {
    if (value.length < minLength) {
      throw new Error(`[config] ${name} слишком короткий (минимум ${minLength} символов)`);
    }
    return value;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`[config] Переменная окружения ${name} обязательна в production`);
  }
  const store = (g.__ebzDevSecrets ||= {});
  if (!store[name]) {
    store[name] = randomHex(24);
    console.warn(
      `[config] ${name} не задан — сгенерирован случайный для этого процесса (только dev). ` +
        `Задайте ${name} в .env.local, чтобы он переживал перезапуск.`
    );
  }
  return store[name];
}

export function getSessionSecret(): string {
  return fromEnv('SESSION_SECRET', 16);
}

export function getGatePassword(): string {
  return fromEnv('SITE_GATE_PASSWORD', 1);
}

export function getAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}
