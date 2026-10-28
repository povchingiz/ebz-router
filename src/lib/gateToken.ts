// Подписанный токен site-gate (HMAC-SHA256, Web Crypto — работает и в middleware, и в route handlers).
import { getSessionSecret } from './secrets';

export const GATE_COOKIE_NAME = 'site_gate_pass';
export const GATE_TTL_SECONDS = 30 * 24 * 60 * 60;

const enc = new TextEncoder();

async function sign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${getSessionSecret()}:site-gate`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createGateToken(): Promise<string> {
  const exp = Date.now() + GATE_TTL_SECONDS * 1000;
  return `${exp}.${await sign(`gate:${exp}`)}`;
}

export async function verifyGateToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || Date.now() > exp) return false;
  return safeEqual(sig, await sign(`gate:${exp}`));
}
