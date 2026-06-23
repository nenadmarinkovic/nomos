/**
 * Headless engine bench.
 *
 *   npx tsx scripts/bench.ts
 *
 * Runs a deterministic Nomos simulation at village and town scales and prints
 * sampled state to stdout. Used to calibrate the engine constants empirically
 * — read the time series and spot dynamics that are flat, runaway, or
 * locked into a degenerate regime.
 */

import { DEFAULT_CONFIG, type Scale, type SimulationConfig } from "../lib/config";
import { Engine } from "../lib/engine";

interface RunOptions {
  scale: Scale;
  turns: number;
  seed: number;
  sampleEvery: number;
}

function configFor(scale: Scale, seed: number): SimulationConfig {
  return {
    ...DEFAULT_CONFIG,
    seed,
    world: {
      ...DEFAULT_CONFIG.world,
      scale,
    },
  };
}

function fmt(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function run({ scale, turns, seed, sampleEvery }: RunOptions): void {
  const engine = new Engine(configFor(scale, seed));
  const header = [
    "turn",
    "alive",
    "gini",
    "coerce",
    "shame",
    "ties",
    "isol%",
    "tokens",
    "issuers",
    "land",
    "price",
    "vol",
    "tVol",
    "mat",
    "sym",
    "norm",
    "pow",
  ];
  const widths = header.map((h) => Math.max(h.length, 6));

  console.log(`\n=== ${scale.toUpperCase()} · seed ${seed} · ${turns} turns ===`);
  console.log(
    header.map((h, i) => h.padStart(widths[i])).join(" "),
  );

  // Rolling counters so we can report per-window averages instead of just the
  // instantaneous spike at the sampled tick — a per-tick coercionCount tells
  // us nothing about whether coercion is rare or relentless.
  let coerceAccum = 0;
  let shameAccum = 0;
  let volAccum = 0;
  let tVolAccum = 0;
  let sampleCount = 0;
  let lastSampleTurn = 0;

  for (let t = 0; t <= turns; t++) {
    if (t > 0) {
      engine.tick();
      const s = engine.getSnapshot();
      coerceAccum += s.coercionCount;
      shameAccum += s.shamingCount;
      volAccum += s.tradeVolume;
      tVolAccum += s.tokenTradeVolume;
    }
    if (t % sampleEvery === 0) {
      const s = engine.getSnapshot();
      const window = Math.max(1, t - lastSampleTurn);
      const cells = [
        fmt(s.turn),
        fmt(s.alive),
        fmt(s.gini, 3),
        fmt(coerceAccum / window, 1),
        fmt(shameAccum / window, 1),
        fmt(s.tieCount),
        fmt(s.isolateShare * 100, 0),
        fmt(s.tokenSupply, 0),
        fmt(s.circulatingIssuers),
        fmt(s.landDegradation, 3),
        fmt(s.tradePrice, 2),
        fmt(volAccum / window, 1),
        fmt(tVolAccum / window, 2),
        fmt(s.motivationCounts.material),
        fmt(s.motivationCounts.symbolic),
        fmt(s.motivationCounts.normative),
        fmt(s.motivationCounts.power),
      ];
      console.log(cells.map((c, i) => c.padStart(widths[i])).join(" "));
      coerceAccum = 0;
      shameAccum = 0;
      volAccum = 0;
      tVolAccum = 0;
      sampleCount++;
      lastSampleTurn = t;
    }
  }

  const final = engine.getSnapshot();
  const monoCount = Math.max(...Object.values(final.motivationCounts));
  const monoShare = final.alive > 0 ? monoCount / final.alive : 0;
  console.log(
    `\nfinal: alive=${final.alive}, gini=${final.gini.toFixed(3)}, ` +
      `tokens=${Math.round(final.tokenSupply)}, circ-issuers=${final.circulatingIssuers}, ` +
      `degradation=${final.landDegradation.toFixed(3)}, ` +
      `mono-share=${monoShare.toFixed(2)}, samples=${sampleCount}`,
  );
}

run({ scale: "village", turns: 1500, seed: 1, sampleEvery: 100 });
run({ scale: "town", turns: 1000, seed: 1, sampleEvery: 75 });
run({ scale: "city", turns: 600, seed: 1, sampleEvery: 50 });
