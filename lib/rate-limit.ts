export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

const buckets = new Map<string, number[]>();

function bucketKey(key: string, rule: RateLimitRule): string {
  return `${key}#${rule.windowMs}`;
}

function liveHits(key: string, rule: RateLimitRule, now: number): number[] {
  const cutoff = now - rule.windowMs;
  return (buckets.get(bucketKey(key, rule)) ?? []).filter((t) => t > cutoff);
}

export function peekRateLimit(
  key: string,
  rules: RateLimitRule[],
  now: number = Date.now(),
): RateLimitResult {
  let tightest: RateLimitResult = {
    ok: true,
    remaining: Number.POSITIVE_INFINITY,
    resetAt: now,
    retryAfterSec: 0,
  };

  for (const rule of rules) {
    const hits = liveHits(key, rule, now);
    if (hits.length >= rule.limit) {
      const resetAt = hits[0] + rule.windowMs;
      return {
        ok: false,
        remaining: 0,
        resetAt,
        retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }
    const remaining = rule.limit - hits.length;
    if (remaining < tightest.remaining) {
      tightest = {
        ok: true,
        remaining,
        resetAt: (hits[0] ?? now) + rule.windowMs,
        retryAfterSec: 0,
      };
    }
  }

  return tightest.remaining === Number.POSITIVE_INFINITY
    ? { ...tightest, remaining: 0 }
    : tightest;
}

export function commitRateLimit(
  key: string,
  rules: RateLimitRule[],
  now: number = Date.now(),
): void {
  sweep(now);
  for (const rule of rules) {
    const hits = liveHits(key, rule, now);
    hits.push(now);
    buckets.set(bucketKey(key, rule), hits);
  }
}

export function rateLimit(
  key: string,
  rules: RateLimitRule[],
  now: number = Date.now(),
): RateLimitResult {
  const verdict = peekRateLimit(key, rules, now);
  if (verdict.ok) commitRateLimit(key, rules, now);
  return verdict;
}

const SWEEP_INTERVAL_MS = 5 * 60_000;
const SWEEP_HORIZON_MS = 60 * 60_000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  const horizon = now - SWEEP_HORIZON_MS;
  for (const [key, hits] of buckets) {
    if (hits.length === 0 || hits[hits.length - 1] <= horizon) {
      buckets.delete(key);
    }
  }
}

export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}

type Store = typeof import("@/lib/rate-limit-store");

let storePromise: Promise<Store | null> | null = null;

function getStore(): Promise<Store | null> {
  if (!process.env.DATABASE_URL) return Promise.resolve(null);
  storePromise ??= import("@/lib/rate-limit-store").catch(() => null);
  return storePromise;
}

export async function sharedPeek(
  key: string,
  rules: RateLimitRule[],
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const store = await getStore();
  if (!store) return peekRateLimit(key, rules, now);
  try {
    return await store.peek(key, rules, now);
  } catch {
    return peekRateLimit(key, rules, now);
  }
}

export async function sharedCommit(
  key: string,
  rules: RateLimitRule[],
  now: number = Date.now(),
): Promise<void> {
  const store = await getStore();
  if (!store) return commitRateLimit(key, rules, now);
  try {
    await store.commit(key, rules, now);
  } catch {
    commitRateLimit(key, rules, now);
  }
}

export async function sharedRateLimit(
  key: string,
  rules: RateLimitRule[],
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const verdict = await sharedPeek(key, rules, now);
  if (verdict.ok) await sharedCommit(key, rules, now);
  return verdict;
}
