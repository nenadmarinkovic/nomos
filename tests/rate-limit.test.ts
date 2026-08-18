import { beforeEach, describe, expect, it } from "vitest";

import type { Caller } from "@/lib/api-auth";
import { checkObserveLimit } from "@/lib/observe-rate-limit";
import {
  commitRateLimit,
  peekRateLimit,
  rateLimit,
  resetRateLimits,
} from "@/lib/rate-limit";

const MINUTE = 60_000;
const T0 = 1_700_000_000_000;

const ANON: Caller = { kind: "none" };
const USER: Caller = { kind: "user", userId: "u_1" };

beforeEach(() => {
  resetRateLimits();
});

describe("rateLimit", () => {
  const rule = [{ limit: 3, windowMs: MINUTE }];

  it("allows up to the limit, then blocks", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", rule, T0).ok).toBe(true);
    }
    const blocked = rateLimit("k", rule, T0);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBe(60);
  });

  it("does not record blocked calls, so the window never extends", () => {
    for (let i = 0; i < 3; i++) rateLimit("k", rule, T0);
    for (let i = 0; i < 20; i++) rateLimit("k", rule, T0 + 1_000);
    expect(rateLimit("k", rule, T0 + MINUTE + 1).ok).toBe(true);
  });

  it("slides rather than resetting on a boundary", () => {
    rateLimit("k", rule, T0);
    rateLimit("k", rule, T0 + 30_000);
    rateLimit("k", rule, T0 + 40_000);
    expect(rateLimit("k", rule, T0 + MINUTE + 1).ok).toBe(true);
    expect(rateLimit("k", rule, T0 + MINUTE + 2).ok).toBe(false);
  });

  it("keeps separate keys independent", () => {
    for (let i = 0; i < 3; i++) rateLimit("a", rule, T0);
    expect(rateLimit("a", rule, T0).ok).toBe(false);
    expect(rateLimit("b", rule, T0).ok).toBe(true);
  });

  it("blocks on the tightest of several rules", () => {
    const rules = [
      { limit: 2, windowMs: MINUTE },
      { limit: 5, windowMs: 60 * MINUTE },
    ];
    expect(rateLimit("k", rules, T0).ok).toBe(true);
    expect(rateLimit("k", rules, T0).ok).toBe(true);
    expect(rateLimit("k", rules, T0).ok).toBe(false);
    expect(rateLimit("k", rules, T0 + MINUTE + 1).ok).toBe(true);
  });

  it("peek reports without spending", () => {
    const before = peekRateLimit("k", rule, T0);
    expect(before.ok).toBe(true);
    expect(before.remaining).toBe(3);
    expect(peekRateLimit("k", rule, T0).remaining).toBe(3);
    commitRateLimit("k", rule, T0);
    expect(peekRateLimit("k", rule, T0).remaining).toBe(2);
  });
});

describe("checkObserveLimit", () => {
  it("gives signed-in callers a wider allowance than anonymous ones", () => {
    let anonAllowed = 0;
    for (let i = 0; i < 100; i++) {
      if (checkObserveLimit(ANON, "1.2.3.4", T0).ok) anonAllowed++;
    }
    let userAllowed = 0;
    for (let i = 0; i < 100; i++) {
      if (checkObserveLimit(USER, "1.2.3.4", T0).ok) userAllowed++;
    }
    expect(anonAllowed).toBe(12);
    expect(userAllowed).toBe(20);
  });

  it("buckets anonymous callers by IP, not by shared anon id", () => {
    const anonA: Caller = { kind: "anon", key: "anon_aaa" };
    const anonB: Caller = { kind: "anon", key: "anon_bbb" };
    for (let i = 0; i < 12; i++) checkObserveLimit(anonA, "9.9.9.9", T0);
    expect(checkObserveLimit(anonB, "9.9.9.9", T0).ok).toBe(false);
    expect(checkObserveLimit(anonB, "8.8.8.8", T0).ok).toBe(true);
  });

  it("reports which ceiling rejected the call", () => {
    for (let i = 0; i < 12; i++) checkObserveLimit(ANON, "1.1.1.1", T0);
    const verdict = checkObserveLimit(ANON, "1.1.1.1", T0);
    expect(verdict.ok).toBe(false);
    expect(verdict.scope).toBe("caller");
    expect(verdict.tier).toBe("anon");
    expect(verdict.retryAfterSec).toBeGreaterThan(0);
  });

  it("does not charge the global ceiling for a caller-rejected call", () => {
    for (let i = 0; i < 12; i++) checkObserveLimit(ANON, "1.1.1.1", T0);
    for (let i = 0; i < 500; i++) checkObserveLimit(ANON, "1.1.1.1", T0);
    expect(checkObserveLimit(ANON, "2.2.2.2", T0).ok).toBe(true);
  });

  it("stops everyone once the deployment-wide hourly ceiling is hit", () => {
    for (let ip = 0; ip < 250; ip++) {
      for (let i = 0; i < 12; i++) {
        checkObserveLimit(ANON, `10.0.${ip}.1`, T0);
      }
    }
    const verdict = checkObserveLimit(ANON, "172.16.0.1", T0);
    expect(verdict.ok).toBe(false);
    expect(verdict.scope).toBe("global");
    expect(checkObserveLimit(ANON, "172.16.0.2", T0 + MINUTE + 1).ok).toBe(
      false,
    );
  });
});
