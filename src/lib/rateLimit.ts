// Простой in-memory лимитер неудачных попыток (фиксированное окно).
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function clientIp(req: Request): string {
  // X-Forwarded-For доверяем только за обратным прокси (TRUST_PROXY=true)
  if (process.env.TRUST_PROXY === 'true') {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
  }
  return 'direct';
}

function live(key: string, windowMs: number): Bucket {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
    if (buckets.size > 10000) {
      buckets.forEach((v, k) => v.resetAt <= now && buckets.delete(k));
    }
  }
  return b;
}

/** Секунд до разблокировки, если лимит исчерпан; иначе 0. */
export function blockedFor(key: string, limit: number, windowMs: number): number {
  const b = live(key, windowMs);
  return b.count >= limit ? Math.ceil((b.resetAt - Date.now()) / 1000) : 0;
}

export function recordFailure(key: string, windowMs: number): void {
  live(key, windowMs).count++;
}

export function reset(key: string): void {
  buckets.delete(key);
}

