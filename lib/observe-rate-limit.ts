import type { Caller } from "@/lib/api-auth";
import {
  sharedCommit,
  sharedPeek,
  type RateLimitResult,
} from "@/lib/rate-limit";

export { clientIp } from "@/lib/client-ip";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const GLOBAL_KEY = "observe:global";

export const OBSERVE_LIMITS = {
  user: () => [
    { limit: envInt("OBSERVE_LIMIT_USER_PER_MIN", 20), windowMs: MINUTE },
    { limit: envInt("OBSERVE_LIMIT_USER_PER_HOUR", 800), windowMs: HOUR },
  ],
  anon: () => [
    { limit: envInt("OBSERVE_LIMIT_ANON_PER_MIN", 12), windowMs: MINUTE },
    { limit: envInt("OBSERVE_LIMIT_ANON_PER_HOUR", 400), windowMs: HOUR },
  ],
  global: () => [
    { limit: envInt("OBSERVE_LIMIT_GLOBAL_PER_HOUR", 3000), windowMs: HOUR },
  ],
};

export function observeBucket(
  caller: Caller,
  ip: string,
): { key: string; tier: "user" | "anon" } {
  if (caller.kind === "user") {
    return { key: `observe:user:${caller.userId}`, tier: "user" };
  }
  return { key: `observe:ip:${ip}`, tier: "anon" };
}

export interface ObserveLimitVerdict extends RateLimitResult {
  scope: "caller" | "global";
  tier: "user" | "anon";
}

export async function checkObserveLimit(
  caller: Caller,
  ip: string,
  now: number = Date.now(),
): Promise<ObserveLimitVerdict> {
  const { key, tier } = observeBucket(caller, ip);
  const callerRules = OBSERVE_LIMITS[tier]();
  const globalRules = OBSERVE_LIMITS.global();

  const [perCaller, global] = await Promise.all([
    sharedPeek(key, callerRules, now),
    sharedPeek(GLOBAL_KEY, globalRules, now),
  ]);

  if (!perCaller.ok) return { ...perCaller, scope: "caller", tier };
  if (!global.ok) return { ...global, scope: "global", tier };

  await Promise.all([
    sharedCommit(key, callerRules, now),
    sharedCommit(GLOBAL_KEY, globalRules, now),
  ]);

  const tightest = global.remaining < perCaller.remaining ? global : perCaller;
  return {
    ...tightest,
    remaining: Math.max(0, tightest.remaining - 1),
    scope: tightest === global ? "global" : "caller",
    tier,
  };
}
