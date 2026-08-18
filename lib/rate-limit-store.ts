import { prisma } from "@/lib/db";
import type { RateLimitResult, RateLimitRule } from "@/lib/rate-limit";

function bucketKey(key: string, rule: RateLimitRule): string {
  return `${key}#${rule.windowMs}`;
}

export async function peek(
  key: string,
  rules: RateLimitRule[],
  now: number,
): Promise<RateLimitResult> {
  const stats = await Promise.all(
    rules.map((rule) =>
      prisma.rateLimitHit.aggregate({
        where: {
          bucket: bucketKey(key, rule),
          at: { gt: new Date(now - rule.windowMs) },
        },
        _count: { _all: true },
        _min: { at: true },
      }),
    ),
  );

  let tightest: RateLimitResult = {
    ok: true,
    remaining: Number.POSITIVE_INFINITY,
    resetAt: now,
    retryAfterSec: 0,
  };

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const used = stats[i]._count._all;
    const oldest = stats[i]._min.at?.getTime() ?? now;

    if (used >= rule.limit) {
      const resetAt = oldest + rule.windowMs;
      return {
        ok: false,
        remaining: 0,
        resetAt,
        retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    }

    const remaining = rule.limit - used;
    if (remaining < tightest.remaining) {
      tightest = {
        ok: true,
        remaining,
        resetAt: oldest + rule.windowMs,
        retryAfterSec: 0,
      };
    }
  }

  return tightest.remaining === Number.POSITIVE_INFINITY
    ? { ...tightest, remaining: 0 }
    : tightest;
}

export async function commit(
  key: string,
  rules: RateLimitRule[],
  now: number,
): Promise<void> {
  const at = new Date(now);
  await prisma.rateLimitHit.createMany({
    data: rules.map((rule) => ({ bucket: bucketKey(key, rule), at })),
  });
  void sweep(now);
}

const SWEEP_INTERVAL_MS = 5 * 60_000;
const SWEEP_HORIZON_MS = 2 * 60 * 60_000;
let lastSweep = 0;

async function sweep(now: number): Promise<void> {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  try {
    await prisma.rateLimitHit.deleteMany({
      where: { at: { lt: new Date(now - SWEEP_HORIZON_MS) } },
    });
  } catch {}
}
