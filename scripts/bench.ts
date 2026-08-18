import {
  DEFAULT_CONFIG,
  type Scale,
  type SimulationConfig,
} from "../lib/config";
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
    "trust!",
    "anchor",
    "mistr%",
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

  console.log(
    `\n=== ${scale.toUpperCase()} · seed ${seed} · ${turns} turns ===`,
  );
  console.log(header.map((h, i) => h.padStart(widths[i])).join(" "));

  let coerceAccum = 0;
  let shameAccum = 0;
  let volAccum = 0;
  let tVolAccum = 0;
  let sampleCount = 0;
  let lastSampleTurn = 0;
  let bankRunCount = 0;
  let leadershipCount = 0;
  let blightCount = 0;
  let plagueCount = 0;
  let lastBankRunTurn = -9999;
  let lastBlightTurnSeen = -9999;
  let lastPlagueTurnSeen = -9999;
  let leadershipArmed = true;

  for (let t = 0; t <= turns; t++) {
    if (t > 0) {
      engine.tick();
      const s = engine.getSnapshot();
      coerceAccum += s.coercionCount;
      shameAccum += s.shamingCount;
      volAccum += s.tradeVolume;
      tVolAccum += s.tokenTradeVolume;
      if (s.bankRunActive && s.bankRunStartedTurn !== lastBankRunTurn) {
        bankRunCount++;
        lastBankRunTurn = s.bankRunStartedTurn;
      }
      if (
        s.blightStartedTurn !== lastBlightTurnSeen &&
        s.blightStartedTurn > 0
      ) {
        blightCount++;
        lastBlightTurnSeen = s.blightStartedTurn;
      }
      if (s.plagueDeathsThisTurn > 0 && s.turn !== lastPlagueTurnSeen) {
        plagueCount++;
        lastPlagueTurnSeen = s.turn;
      }
      const c = s.topInfluencerCentrality;
      if (c < 45) leadershipArmed = true;
      if (leadershipArmed && c >= 80) {
        leadershipCount++;
        leadershipArmed = false;
      }
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
        fmt(bankRunCount),
        fmt(s.topInfluencerCentrality, 1),
        fmt(s.topIssuerMistrust * 100, 0),
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
      `mono-share=${monoShare.toFixed(2)}, ` +
      `bank-runs=${bankRunCount}, leadership-emergences=${leadershipCount}, ` +
      `blights=${blightCount}, plagues=${plagueCount}, ` +
      `samples=${sampleCount}`,
  );
}

run({ scale: "village", turns: 1500, seed: 1, sampleEvery: 100 });
run({ scale: "town", turns: 1000, seed: 1, sampleEvery: 75 });
run({ scale: "city", turns: 600, seed: 1, sampleEvery: 50 });
