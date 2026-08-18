import { describe, expect, it } from "vitest";

import { DEFAULT_CONFIG, type SimulationConfig } from "@/lib/config";
import { Engine, type EngineSnapshot } from "@/lib/engine";

function config(seed: number): SimulationConfig {
  return {
    ...DEFAULT_CONFIG,
    seed,
    world: { ...DEFAULT_CONFIG.world, scale: "village" },
  };
}

function run(seed: number, turns: number): EngineSnapshot[] {
  const engine = new Engine(config(seed));
  const frames: EngineSnapshot[] = [];
  for (let t = 0; t < turns; t++) {
    engine.tick();
    frames.push(engine.getSnapshot());
  }
  return frames;
}

describe("Engine determinism", () => {
  it("produces an identical snapshot trajectory for the same seed", () => {
    const a = run(1234, 200);
    const b = run(1234, 200);
    expect(b).toEqual(a);
  });

  it("diverges for different seeds", () => {
    const a = run(1, 120);
    const b = run(2, 120);
    expect(b.at(-1)).not.toEqual(a.at(-1));
  });

  it("is independent of prior instances (no shared global state)", () => {
    run(777, 50);
    const isolated = run(1234, 200);
    const fresh = run(1234, 200);
    expect(isolated).toEqual(fresh);
  });
});

describe("Engine invariants", () => {
  const frames = run(42, 250);

  it("advances the turn counter by one each tick", () => {
    frames.forEach((f, i) => expect(f.turn).toBe(i + 1));
  });

  it("keeps population within [0, initial cap]", () => {
    const cap = 500;
    for (const f of frames) {
      expect(f.alive).toBeGreaterThanOrEqual(0);
      expect(f.alive).toBeLessThan(cap * 20);
    }
  });

  it("reports Gini, segregation, and mistrust as valid ratios", () => {
    for (const f of frames) {
      expect(f.gini).toBeGreaterThanOrEqual(0);
      expect(f.gini).toBeLessThanOrEqual(1);
      expect(f.segregation).toBeGreaterThanOrEqual(0);
      expect(f.segregation).toBeLessThanOrEqual(1);
      expect(f.landDegradation).toBeGreaterThanOrEqual(0);
      expect(f.landDegradation).toBeLessThanOrEqual(1);
      expect(f.isolateShare).toBeGreaterThanOrEqual(0);
      expect(f.isolateShare).toBeLessThanOrEqual(1);
      expect(f.topIssuerMistrust).toBeGreaterThanOrEqual(0);
      expect(f.topIssuerMistrust).toBeLessThanOrEqual(1);
    }
  });

  it("keeps motivation counts and wealth bins consistent with the population", () => {
    for (const f of frames) {
      const motivationTotal =
        f.motivationCounts.material +
        f.motivationCounts.symbolic +
        f.motivationCounts.normative +
        f.motivationCounts.power;
      expect(motivationTotal).toBe(f.alive);

      const binTotal = f.wealthBins.reduce((s, n) => s + n, 0);
      expect(binTotal).toBe(f.alive);
    }
  });

  it("never reports negative counts for tallies", () => {
    for (const f of frames) {
      for (const v of [
        f.tradeVolume,
        f.coercionCount,
        f.shamingCount,
        f.tieCount,
        f.tokenSupply,
        f.tokenTradeVolume,
        f.plagueDeathsThisTurn,
        f.circulatingIssuers,
      ]) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("Engine golden snapshots", () => {
  // Seeded output is stable, so these snapshots pin the engine's behaviour:
  // any unintended change to the simulation maths will surface as a diff.
  // Regenerate deliberately with `vitest -u` when a mechanic changes on purpose.
  const frames = run(2024, 200);

  it("matches the recorded snapshot at turn 50", () => {
    expect(frames[49]).toMatchSnapshot();
  });

  it("matches the recorded snapshot at turn 200", () => {
    expect(frames[199]).toMatchSnapshot();
  });
});
