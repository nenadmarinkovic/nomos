import type { Caller } from "@/lib/api-auth";
import { sharedRateLimit, type RateLimitResult } from "@/lib/rate-limit";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const MAX_RUN_BODY_BYTES = 2 * 1024 * 1024;

export const MAX_HISTORY_POINTS = 2_000;
export const MAX_CHRONICLE_ENTRIES = 1_000;
export const MAX_RUN_NAME = 120;

export const MAX_RUNS_PER_OWNER = 200;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const RUN_WRITE_LIMITS = () => [
  { limit: envInt("RUNS_WRITE_PER_MIN", 20), windowMs: MINUTE },
  { limit: envInt("RUNS_WRITE_PER_HOUR", 200), windowMs: HOUR },
];

export const RUN_READ_LIMITS = () => [
  { limit: envInt("RUNS_READ_PER_MIN", 120), windowMs: MINUTE },
];

export const RUN_CLAIM_LIMITS = () => [
  { limit: envInt("RUNS_CLAIM_PER_MIN", 10), windowMs: MINUTE },
  { limit: envInt("RUNS_CLAIM_PER_HOUR", 60), windowMs: HOUR },
];

export function runsBucket(caller: Caller, ip: string, action: string): string {
  return caller.kind === "user"
    ? `runs:${action}:user:${caller.userId}`
    : `runs:${action}:ip:${ip}`;
}

export async function checkRunsLimit(
  caller: Caller,
  ip: string,
  action: string,
  rules: { limit: number; windowMs: number }[],
): Promise<RateLimitResult> {
  return sharedRateLimit(runsBucket(caller, ip, action), rules);
}
