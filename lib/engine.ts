import { DEFAULT_MUTATION_RATE } from "@/lib/config";
import type {
  AgentMotivation,
  AgentSophistication,
  InitialSettlement,
  InteractionTopology,
  Landscape,
  Scale,
  SimulationConfig,
  WeightedSelection,
} from "@/lib/config";

const GRID_SIZE: Record<Scale, number> = {
  village: 50,
  town: 80,
  city: 110,
};

const AGENT_COUNT: Record<Scale, number> = {
  village: 500,
  town: 1000,
  city: 5000,
};

/** Trait values ∈ [0,1]. Every rule reads only from these. */
export interface AgentTraits {
  greed: number;
  prosociality: number;
  dominance: number;
  statusSeeking: number;
}

export interface Agent {
  id: number;
  alive: boolean;
  x: number;
  y: number;
  /** Position at tick start — used to interpolate the render. */
  prevX: number;
  prevY: number;
  sugar: number;
  spice: number;
  age: number;
  vision: number;
  sugarMetab: number;
  spiceMetab: number;
  maxAge: number;
  initialSugar: number;
  initialSpice: number;
  /** Derived from traits each tick — a label, not a driver. */
  motivation: AgentMotivation;
  traits: AgentTraits;
  sophistication: AgentSophistication;
  /** Adaptive movement: learned willingness to range far (0..1). */
  boldness: number;
  /** Adaptive movement: last tick's holdings, to detect gain or loss. */
  lastHoldings: number;
  /** Others may trade with this agent again after this turn. */
  shamedUntilTurn: number;
  /** Recent good trade partners — copied by cultural imitation. */
  favouredPartners: number[];
  /** Cells this agent has recently harvested well. Bounded queue, biases
   *  `scoreCell` toward known-productive ground. */
  goodCells: number[];
  /** EMA of "was the last harvest strong" — the reference against which
   *  new harvests are judged as noteworthy. */
  meanHarvest: number;
}

/** Seed for each named motivation. New agents draw a jittered vector
 *  around one of these; the motivation label is derived from the vector. */
const MOTIVATION_TRAIT_CENTROID: Record<AgentMotivation, AgentTraits> = {
  material: { greed: 0.7, prosociality: 0.5, dominance: 0.3, statusSeeking: 0.3 },
  symbolic: { greed: 0.4, prosociality: 0.5, dominance: 0.2, statusSeeking: 0.8 },
  normative: { greed: 0.3, prosociality: 0.9, dominance: 0.1, statusSeeking: 0.4 },
  power: { greed: 0.6, prosociality: 0.1, dominance: 0.9, statusSeeking: 0.5 },
};

const TRAIT_JITTER = 0.12;

function sampleTraits(
  motivation: AgentMotivation,
  rng: () => number,
): AgentTraits {
  const c = MOTIVATION_TRAIT_CENTROID[motivation];
  const jit = (mean: number) =>
    Math.max(0, Math.min(1, mean + (rng() - 0.5) * 2 * TRAIT_JITTER));
  return {
    greed: jit(c.greed),
    prosociality: jit(c.prosociality),
    dominance: jit(c.dominance),
    statusSeeking: jit(c.statusSeeking),
  };
}

/** Small random walk around the parent — children inherit, not clone. */
function driftTraits(base: AgentTraits, rng: () => number): AgentTraits {
  const TRAIT_DRIFT = 0.05;
  const step = (v: number) =>
    Math.max(0, Math.min(1, v + (rng() - 0.5) * 2 * TRAIT_DRIFT));
  return {
    greed: step(base.greed),
    prosociality: step(base.prosociality),
    dominance: step(base.dominance),
    statusSeeking: step(base.statusSeeking),
  };
}

function traitDistance(a: AgentTraits, b: AgentTraits): number {
  const dg = a.greed - b.greed;
  const dp = a.prosociality - b.prosociality;
  const dd = a.dominance - b.dominance;
  const ds = a.statusSeeking - b.statusSeeking;
  return Math.sqrt(dg * dg + dp * dp + dd * dd + ds * ds);
}

/** Linear pull: `rate` = 0 keeps `traits`, `rate` = 1 becomes `target`. */
function pullTraitsToward(
  traits: AgentTraits,
  target: AgentTraits,
  rate: number,
): AgentTraits {
  const r = Math.max(0, Math.min(1, rate));
  const step = (a: number, b: number) =>
    Math.max(0, Math.min(1, a + (b - a) * r));
  return {
    greed: step(traits.greed, target.greed),
    prosociality: step(traits.prosociality, target.prosociality),
    dominance: step(traits.dominance, target.dominance),
    statusSeeking: step(traits.statusSeeking, target.statusSeeking),
  };
}

// Trait-only rule helpers. This is where sociological intuitions live.

/** Greedy → harvest more. Dominant → harvest less (they seize instead). */
function sugarYieldFromTraits(t: AgentTraits): number {
  return clamp01_5(0.6 + 0.8 * t.greed - 0.8 * t.dominance);
}

/** Status-seekers favour luxury (spice); greed lifts both yields. */
function spiceYieldFromTraits(t: AgentTraits): number {
  return clamp01_5(
    0.5 + 0.5 * t.greed + 0.6 * t.statusSeeking - 0.8 * t.dominance,
  );
}

function clamp01_5(v: number): number {
  return v < 0.3 ? 0.3 : v > 1.5 ? 1.5 : v;
}

/** Nearest centroid label. The label describes behaviour, doesn't drive it. */
function motivationFromTraits(t: AgentTraits): AgentMotivation {
  let best: AgentMotivation = "material";
  let bestDist = Infinity;
  const keys = Object.keys(MOTIVATION_TRAIT_CENTROID) as AgentMotivation[];
  for (const m of keys) {
    const c = MOTIVATION_TRAIT_CENTROID[m];
    const dg = t.greed - c.greed;
    const dp = t.prosociality - c.prosociality;
    const dd = t.dominance - c.dominance;
    const ds = t.statusSeeking - c.statusSeeking;
    const d = dg * dg + dp * dp + dd * dd + ds * ds;
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

/** Per-tick attack chance. Squared so borderline-dominant rarely attack. */
function attackPropensity(t: AgentTraits): number {
  const ATTEMPT_RATE = 0.18;
  return ATTEMPT_RATE * t.dominance * t.dominance * (1 - t.prosociality);
}

/** Prosociality above this threshold triggers the shaming latch. */
const WITNESS_PROSOCIALITY_THRESHOLD = 0.65;

/** Refuse-shamed odds. Ignore below 0.4, always refuse above 0.8. */
function refuseShamedProbability(t: AgentTraits): number {
  const p = t.prosociality;
  return p < 0.4 ? 0 : Math.min(1, (p - 0.4) / 0.4);
}

/** Trade bonus. Geometric so one defector kills it. */
function cooperativeBonus(a: AgentTraits, b: AgentTraits): number {
  return 0.1 * Math.min(a.prosociality, b.prosociality);
}

/** Odds an agent looks for a richer neighbour to imitate this tick. */
function imitationPropensity(t: AgentTraits): number {
  const BASE = 0.03;
  return BASE * t.statusSeeking;
}

/** Baseline for issuer trustworthiness so fresh IOUs don't collapse
 *  before reaching a third holder. */
const TOKEN_PRIOR_LIABILITY = 4;

/** Seller-side accept probability. The 0.08 floor lets tokens reach
 *  third-party sellers with no personal tie to the issuer. */
function tokenAcceptanceProb(
  sellerTraits: AgentTraits,
  trustInIssuer: number,
  issuerTrustworthiness: number,
): number {
  const proso = 0.3 + 0.7 * sellerTraits.prosociality;
  return Math.min(
    1,
    0.08 + 0.25 * trustInIssuer + 0.7 * issuerTrustworthiness * proso,
  );
}

function scoreCellByTraits(
  t: AgentTraits,
  resources: number,
  neighbourCount: number,
  neighbourAvgWealth: number,
  ownWealth: number,
  fertility: number,
): number {
  const resourceWeight = 0.6 + 0.5 * t.greed;
  const proximityWeight = 0.6 * t.prosociality;
  const predatoryWeight =
    ownWealth > neighbourAvgWealth ? 0.8 * t.dominance : 0;
  const statusWeight = 0.1 * t.statusSeeking;
  // Barren cells discount raw resources, so agents drift off worn ground.
  const foresight = 0.4 + 0.6 * fertility;
  return (
    resources * resourceWeight * foresight +
    neighbourCount * (proximityWeight + predatoryWeight) +
    neighbourAvgWealth * statusWeight
  );
}

export function holdings(a: Agent): number {
  return a.sugar + a.spice;
}

/** How much sugar this agent will give up for one spice, given their
 *  current holdings and metabolism. Two agents with different MRS both
 *  gain by trading toward each other's ratio. */
export function mrs(a: Agent): number {
  return (a.sugar / a.sugarMetab) / (a.spice / a.spiceMetab);
}

/** Cobb-Douglas welfare. Both movement and trade try to raise it. */
function welfare(sugar: number, spice: number, ms: number, msp: number): number {
  const mt = ms + msp;
  return Math.pow(sugar, ms / mt) * Math.pow(spice, msp / mt);
}

export const WEALTH_BIN_EDGES = [5, 10, 20, 40, 80] as const;
export const WEALTH_BIN_LABELS = ["<5", "5–10", "10–20", "20–40", "40–80", "80+"] as const;

// Tie weight: +INCREMENT per trade, ×DECAY per tick, drops at THRESHOLD, capped at CAP.
const TIE_INCREMENT = 1;
const TIE_DECAY = 0.97;
const TIE_THRESHOLD = 0.25;
const TIE_CAP = 8;

// Substrate CA constants (used only when substrateDiffusion is on).
// STOCK_DIFFUSION < 0.25 for four-neighbour stability.
// FERTILITY_SPREAD sets how fast worn ground reseeds from fertile neighbours.
const STOCK_DIFFUSION = 0.12;
const FERTILITY_SPREAD = 0.05;

export interface EngineSnapshot {
  turn: number;
  alive: number;
  gini: number;
  totalWealth: number;
  wealthBins: number[];
  /** Geometric mean of this turn's trade prices (sugar/spice), or 0. */
  tradePrice: number;
  tradeVolume: number;
  motivationCounts: {
    material: number;
    symbolic: number;
    normative: number;
    power: number;
  };
  /** Spatial sorting of motivation. 0 = fully mixed, 1 = fully sorted. */
  segregation: number;
  /** Successful seizures this turn. */
  coercionCount: number;
  /** Seizures that drew a prosocial-witness sanction this turn. */
  shamingCount: number;
  tieCount: number;
  /** Share of living agents with no surviving trade tie. */
  isolateShare: number;
  blightActive: boolean;
  /** Turn the current/last blight began; -9999 if none. */
  blightStartedTurn: number;
  /** Plague deaths this turn (0 otherwise). */
  plagueDeathsThisTurn: number;
  /** Carrying capacity lost vs pristine landscape, 0..1. */
  landDegradation: number;
  /** Total tokens held across all agents. */
  tokenSupply: number;
  tokenTradeVolume: number;
  /** Biggest issuer by outstanding liability; -1 if none. */
  topIssuerId: number;
  topIssuerLiability: number;
  /** Issuers held by ≥3 distinct agents — the "money" threshold. */
  circulatingIssuers: number;
  /** Top agent by inbound trust weight; -1 if none. */
  topInfluencerId: number;
  topInfluencerCentrality: number;
  /** Share of population distrusting the top issuer, 0..1. */
  topIssuerMistrust: number;
  /** True on the turn a run on the top issuer's tokens fires. */
  bankRunActive: boolean;
  bankRunStartedTurn: number;
}

export class Engine {
  readonly width: number;
  readonly height: number;
  /** Loses capacity on harvest, recovers when fallow. */
  maxCells: Float32Array;
  readonly cells: Float32Array;
  maxSpice: Float32Array;
  readonly spice: Float32Array;
  readonly occupants: Int32Array;
  /** Pristine ceilings. `maxCells`/`maxSpice` recover toward these. */
  private originalMaxCells: Float32Array;
  private originalMaxSpice: Float32Array;
  private pristineLandTotal: number;
  /** Scratch buffer for the synchronous substrate CA step. */
  private diffScratch: Float32Array;
  agents: Agent[];
  turn = 0;

  private lastTradePrice = 0;
  private lastTradeVolume = 0;
  private lastCoercionCount = 0;
  private lastShamingCount = 0;

  /** Blight halves regrowth for a stretch; plague kills a random share.
   *  See `rollShocks` — both are gated by the world's own state. */
  private blightUntilTurn = 0;
  private lastBlightTurn = -9999;
  private lastPlagueTurn = -9999;
  private lastPlagueDeaths = 0;

  /** Sparse pair map. Outer key = lower agent id, inner key = higher. */
  private tiesMap = new Map<number, Map<number, number>>();

  /** distrust[witness][offender] — grows on witnessed coercion, spreads
   *  along ties, decays per turn. This is where an emergent norm lives. */
  private distrust = new Map<number, Map<number, number>>();

  /** issuerDistrust[witness][issuer] — grows on witnessed default, damps
   *  future acceptance of that issuer's tokens. */
  private issuerDistrust = new Map<number, Map<number, number>>();

  private offenderNotoriety = new Map<number, number>();

  private lastInfluencerId = -1;
  private lastInfluencerCentrality = 0;

  private bankRunTurn = -9999;
  private bankRunIssuerId = -1;

  // Token ledger. Holdings[holder][issuer] = qty. Liability[issuer] = sum.
  private tokenHoldings = new Map<number, Map<number, number>>();
  private tokenLiability = new Map<number, number>();
  private tokenIssuedLifetime = new Map<number, number>();
  private tokenDefaultedLifetime = new Map<number, number>();
  private lastTokenTradeVolume = 0;

  private rng: () => number;
  private regrowthRate: number;
  private reproduction: boolean;
  private culturalTransmission: boolean;
  private inheritance: boolean;
  private conflict: boolean;
  private substrateDiffusion: boolean;
  private topology: InteractionTopology;
  /** Soft cap: birth rate scales down as population approaches this. */
  private populationCap: number;
  /** Rare-mutation picker: resamples a child's trait centroid from the mix. */
  private mutationMotivation: () => AgentMotivation;
  private mutationRate: number;

  constructor(config: SimulationConfig) {
    this.rng = mulberry32(config.seed || 1);
    this.regrowthRate = config.world.physics.regrowthRate;
    this.reproduction = config.world.reproduction;
    // Legacy runs predate these toggles — default them on.
    this.culturalTransmission = config.world.culturalTransmission ?? true;
    this.inheritance = config.world.inheritance ?? true;
    this.conflict = config.world.conflict ?? true;
    // Default off: alters substrate physics, so old saves must replay unchanged.
    this.substrateDiffusion = config.world.substrateDiffusion ?? false;
    this.topology = config.agents.topology;

    const size = GRID_SIZE[config.world.scale];
    this.width = size;
    this.height = size;

    const total = size * size;
    this.maxCells = new Float32Array(total);
    this.cells = new Float32Array(total);
    this.maxSpice = new Float32Array(total);
    this.spice = new Float32Array(total);
    this.occupants = new Int32Array(total).fill(-1);

    buildLandscape(
      this.maxCells,
      this.maxSpice,
      this.width,
      this.height,
      config.world.landscape,
      this.rng,
    );
    this.cells.set(this.maxCells);
    this.spice.set(this.maxSpice);
    this.originalMaxCells = this.maxCells.slice();
    this.originalMaxSpice = this.maxSpice.slice();
    this.diffScratch = new Float32Array(total);
    this.pristineLandTotal = 0;
    for (let i = 0; i < total; i++) {
      this.pristineLandTotal += this.originalMaxCells[i] + this.originalMaxSpice[i];
    }

    const requested = AGENT_COUNT[config.world.scale];
    this.populationCap = Math.max(requested + 1, Math.floor(total * 0.5));

    this.mutationMotivation = buildWeightedPicker(
      config.agents.motivation,
      "material",
      this.rng,
    );
    this.mutationRate = Math.max(
      0,
      Math.min(1, config.agents.mutationRate ?? DEFAULT_MUTATION_RATE),
    );

    this.agents = spawnAgents(this, config, Math.min(requested, total - 1));
    for (const a of this.agents) {
      this.occupants[a.y * this.width + a.x] = a.id;
    }
  }

  tick(): void {
    this.lastCoercionCount = 0;
    this.lastShamingCount = 0;
    this.lastTokenTradeVolume = 0;
    this.rollShocks();
    this.regrow(this.cells, this.maxCells, true);
    this.regrow(this.spice, this.maxSpice, false);
    if (this.substrateDiffusion) this.diffuseSubstrate();

    const order: number[] = [];
    for (const a of this.agents) {
      if (a.alive) order.push(a.id);
    }
    shuffle(order, this.rng);

    // Move + harvest.
    for (const id of order) {
      const a = this.agents[id];
      if (!a.alive) continue;
      this.moveAndHarvest(a);
    }

    // Combat before trade so seizures price into the market.
    this.combatPhase();
    this.tradePhase();
    this.decayTies();
    this.decayReputations();
    // Culture after trade so wealth reads are post-trade.
    this.culturalPhase();
    this.triadicClosure();

    // Freeze the living set before consume/reproduce so newborns can't act yet.
    const living: number[] = [];
    for (const a of this.agents) {
      if (a.alive) living.push(a.id);
    }
    for (const id of living) {
      const a = this.agents[id];
      if (!a.alive) continue;
      this.consume(a);
    }

    this.reproductionPhase(living);
    this.refreshMotivationLabels();
    this.refreshInfluencer();

    this.turn++;
  }

  private refreshMotivationLabels(): void {
    for (const a of this.agents) {
      if (!a.alive) continue;
      a.motivation = motivationFromTraits(a.traits);
    }
  }

  /** Each agent rolls attack; targets a visibly poorer non-partner, non-peer. */
  private combatPhase(): void {
    if (!this.conflict) return;

    const MIN_GAP = 4;
    const TAKE_FRACTION = 0.3;
    // Skip near-equal-dominance peers so it doesn't collapse into a
    // dominance-on-dominance free-for-all.
    // dominance-on-dominance free-for-all.
    const PEER_RATIO = 0.7;

    for (const a of this.agents) {
      if (!a.alive) continue;
      if (this.rng() >= attackPropensity(a.traits)) continue;

      const myWealth = a.sugar + a.spice;
      if (myWealth <= 1) continue;

      let bestTarget: Agent | null = null;
      let bestGap = MIN_GAP;
      const peerThreshold = a.traits.dominance * PEER_RATIO;
      const v = Math.min(a.vision, 3);
      for (let dy = -v; dy <= v; dy++) {
        const ny = a.y + dy;
        if (ny < 0 || ny >= this.height) continue;
        for (let dx = -v; dx <= v; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = a.x + dx;
          if (nx < 0 || nx >= this.width) continue;
          const occ = this.occupants[ny * this.width + nx];
          if (occ === -1) continue;
          const t = this.agents[occ];
          if (!t.alive) continue;
          if (t.traits.dominance >= peerThreshold) continue;
          // Trade partners are off-limits — embedded relationships shield.
          if (this.getTie(a.id, t.id) > TIE_THRESHOLD) continue;
          const gap = myWealth - (t.sugar + t.spice);
          if (gap > bestGap) {
            bestGap = gap;
            bestTarget = t;
          }
        }
      }

      if (!bestTarget) continue;

      const sugarTaken = bestTarget.sugar * TAKE_FRACTION;
      const spiceTaken = bestTarget.spice * TAKE_FRACTION;
      bestTarget.sugar -= sugarTaken;
      bestTarget.spice -= spiceTaken;
      a.sugar += sugarTaken;
      a.spice += spiceTaken;
      this.lastCoercionCount++;
      this.crashTie(a.id, bestTarget.id);

      this.bumpDistrust(bestTarget.id, a.id, 0.7);
      this.offenderNotoriety.set(
        a.id,
        Math.min(1, (this.offenderNotoriety.get(a.id) ?? 0) + 0.15),
      );

      const SHAME_TURNS = 15;
      const SHAME_VISION = 3;
      let witnessed = false;
      for (let dy = -SHAME_VISION; dy <= SHAME_VISION; dy++) {
        const ny = bestTarget.y + dy;
        if (ny < 0 || ny >= this.height) continue;
        for (let dx = -SHAME_VISION; dx <= SHAME_VISION; dx++) {
          const nx = bestTarget.x + dx;
          if (nx < 0 || nx >= this.width) continue;
          const occ = this.occupants[ny * this.width + nx];
          if (occ === -1 || occ === a.id) continue;
          const w = this.agents[occ];
          if (!w?.alive) continue;
          this.bumpDistrust(w.id, a.id, 0.25 + 0.35 * w.traits.prosociality);
          if (
            !witnessed &&
            w.traits.prosociality >= WITNESS_PROSOCIALITY_THRESHOLD
          ) {
            witnessed = true;
          }
        }
      }
      if (witnessed) {
        a.shamedUntilTurn = this.turn + SHAME_TURNS;
        this.lastShamingCount++;
      }
    }
  }

  /** Drift each agent's traits toward a wealthier visible neighbour.
   *  Speed scales with `statusSeeking`; distance travelled costs wealth
   *  (habitus inertia — identity change isn't free). */
  private culturalPhase(): void {
    if (!this.culturalTransmission) return;

    for (const a of this.agents) {
      if (!a.alive) continue;
      if (this.rng() >= imitationPropensity(a.traits)) continue;

      const myWealth = a.sugar + a.spice;
      let bestNeighbour: Agent | null = null;
      let bestWealth = myWealth;

      const v = Math.min(a.vision, 3);
      for (let dy = -v; dy <= v; dy++) {
        const ny = a.y + dy;
        if (ny < 0 || ny >= this.height) continue;
        for (let dx = -v; dx <= v; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = a.x + dx;
          if (nx < 0 || nx >= this.width) continue;
          const occ = this.occupants[ny * this.width + nx];
          if (occ === -1) continue;
          const n = this.agents[occ];
          if (!n.alive) continue;
          const w = n.sugar + n.spice;
          if (w > bestWealth) {
            bestWealth = w;
            bestNeighbour = n;
          }
        }
      }

      if (!bestNeighbour) continue;

      const driftRate = 0.15 * a.traits.statusSeeking;
      const newTraits = pullTraitsToward(
        a.traits,
        bestNeighbour.traits,
        driftRate,
      );
      const drift = traitDistance(a.traits, newTraits);
      if (drift > 0) {
        const HABITUS_COST_PER_UNIT = 6;
        const cost = drift * HABITUS_COST_PER_UNIT;
        const wealth = a.sugar + a.spice;
        if (wealth > 0) {
          const costFactor = Math.min(0.95, cost / wealth);
          a.sugar *= 1 - costFactor;
          a.spice *= 1 - costFactor;
        }
      }
      a.traits = newTraits;

      // Copy the neighbour's strongest distrust — "stay clear of X" spreads.
      const nbDistrust = this.distrust.get(bestNeighbour.id);
      if (nbDistrust && nbDistrust.size > 0) {
        let bestOffender = -1;
        let bestWeight = 0;
        for (const [off, w] of nbDistrust) {
          if (off === a.id) continue;
          if (w > bestWeight) {
            bestWeight = w;
            bestOffender = off;
          }
        }
        if (bestOffender >= 0) {
          this.bumpDistrust(a.id, bestOffender, bestWeight * 0.5);
        }
      }

      // Practice imitation: adopt one of the neighbour's favoured partners.
      const nbFavs = bestNeighbour.favouredPartners;
      if (nbFavs.length > 0) {
        const pick = nbFavs[Math.floor(this.rng() * nbFavs.length)];
        if (pick !== a.id && !a.favouredPartners.includes(pick)) {
          a.favouredPartners.push(pick);
          if (a.favouredPartners.length > 6) a.favouredPartners.shift();
        }
      }
    }
  }

  /** Birth chance per agent: wealth × mid-life bell × soft population brake. */
  private reproductionPhase(livingIds: number[]): void {
    if (!this.reproduction) return;

    const populationFactor = Math.max(
      0,
      1 - livingIds.length / this.populationCap,
    );
    if (populationFactor <= 0) return;

    const BASE_RATE = 0.04;

    for (const id of livingIds) {
      const a = this.agents[id];
      if (!a.alive) continue;

      // Bell curve: peak fertility mid-life, zero at the extremes.
      const ageNorm = a.maxAge > 0 ? a.age / a.maxAge : 0.5;
      const ageFactor = Math.max(0, 1 - Math.abs(ageNorm - 0.5) * 2.5);
      if (ageFactor <= 0) continue;

      // Capped so one hoarder can't dominate births.
      const wealth = a.sugar + a.spice;
      const wealthFactor = Math.min(2, wealth / 20);
      if (wealthFactor <= 0) continue;

      const p = BASE_RATE * ageFactor * wealthFactor * populationFactor;
      if (this.rng() >= p) continue;

      this.bear(a);
    }
  }

  /** Place a child near the parent. Inherits with drift; rare mutations resample. */
  private bear(parent: Agent): void {
    let idx = this.findEmptyCellNear(parent.x, parent.y, parent.vision);
    if (idx < 0) idx = this.findEmptyCell();
    if (idx < 0) return;
    const cx = idx % this.width;
    const cy = Math.floor(idx / this.width);

    const inheritSeed = this.rng() >= this.mutationRate;
    const childTraits: AgentTraits = inheritSeed
      ? driftTraits(parent.traits, this.rng)
      : sampleTraits(this.mutationMotivation(), this.rng);
    const childMotivation = motivationFromTraits(childTraits);

    const child: Agent = {
      id: this.agents.length,
      alive: true,
      x: cx,
      y: cy,
      prevX: cx,
      prevY: cy,
      sugar: parent.initialSugar,
      spice: parent.initialSpice,
      initialSugar: parent.initialSugar,
      initialSpice: parent.initialSpice,
      age: 0,
      vision: parent.vision,
      sugarMetab: parent.sugarMetab,
      spiceMetab: parent.spiceMetab,
      maxAge: parent.maxAge,
      motivation: childMotivation,
      traits: childTraits,
      sophistication: parent.sophistication,
      boldness: 0.5,
      lastHoldings: parent.initialSugar + parent.initialSpice,
      shamedUntilTurn: 0,
      favouredPartners: parent.favouredPartners.slice(-3),
      goodCells: [],
      meanHarvest: 0,
    };
    this.agents.push(child);
    this.occupants[idx] = child.id;
  }

  /** Random empty cell within `radius` of (cx, cy), or -1 if none found. */
  private findEmptyCellNear(
    cx: number,
    cy: number,
    radius: number,
  ): number {
    const r = Math.max(1, Math.min(radius, 6));
    for (let attempt = 0; attempt < 16; attempt++) {
      const dx = Math.floor(this.rng() * (2 * r + 1)) - r;
      const dy = Math.floor(this.rng() * (2 * r + 1)) - r;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;
      const idx = y * this.width + x;
      if (this.occupants[idx] === -1) return idx;
    }
    return -1;
  }

  private regrow(stock: Float32Array, max: Float32Array, isSugar: boolean): void {
    // Regrowth swings ~30–170% over a 60-turn season.
    const SEASON_PERIOD = 60;
    const SEASON_AMPLITUDE = 0.7;
    const seasonal =
      1 + SEASON_AMPLITUDE * Math.sin((this.turn * 2 * Math.PI) / SEASON_PERIOD);
    const blightActive = isSugar && this.turn < this.blightUntilTurn;
    const blightFactor = blightActive ? 0.4 : 1;
    const rate = this.regrowthRate * seasonal * blightFactor;
    // Empty cells slowly recover carrying capacity toward pristine.
    const RECOVERY_RATE = 0.0008;
    const original = isSugar ? this.originalMaxCells : this.originalMaxSpice;
    for (let i = 0; i < stock.length; i++) {
      const orig = original[i];
      if (orig > 0 && this.occupants[i] === -1 && max[i] < orig) {
        max[i] = Math.min(orig, max[i] + orig * RECOVERY_RATE);
      }
      const m = max[i];
      if (m > 0) {
        const next = stock[i] + rate * m;
        stock[i] = next > m ? m : next;
      }
    }
  }

  /** Substrate CA step: rich cells bleed into exhausted neighbours, and
   *  each cell's fertility relaxes toward its neighbours' — desertification
   *  and reseeding both spread. Written via scratch buffer so it's a true
   *  CA, not a sequential sweep. Consumes no RNG. */
  private diffuseSubstrate(): void {
    this.diffuseStock(this.cells);
    this.diffuseStock(this.spice);
    this.spreadFertility(this.maxCells, this.originalMaxCells);
    this.spreadFertility(this.maxSpice, this.originalMaxSpice);
  }

  /** Conservative diffusion with reflecting boundaries — total stock preserved. */
  private diffuseStock(stock: Float32Array): void {
    const w = this.width;
    const h = this.height;
    const out = this.diffScratch;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const s = stock[i];
        let flux = 0;
        if (x > 0) flux += stock[i - 1] - s;
        if (x < w - 1) flux += stock[i + 1] - s;
        if (y > 0) flux += stock[i - w] - s;
        if (y < h - 1) flux += stock[i + w] - s;
        out[i] = s + STOCK_DIFFUSION * flux;
      }
    }
    stock.set(out);
  }

  /** Pull each cell's fertility fraction (current / pristine) toward its
   *  neighbours'. Fraction space keeps peaks as peaks — only depletion
   *  travels. Naturally barren cells stay out. */
  private spreadFertility(max: Float32Array, original: Float32Array): void {
    const w = this.width;
    const h = this.height;
    const out = this.diffScratch;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const orig = original[i];
        if (orig <= 0) {
          out[i] = max[i];
          continue;
        }
        let sum = 0;
        let n = 0;
        if (x > 0 && original[i - 1] > 0) {
          sum += max[i - 1] / original[i - 1];
          n++;
        }
        if (x < w - 1 && original[i + 1] > 0) {
          sum += max[i + 1] / original[i + 1];
          n++;
        }
        if (y > 0 && original[i - w] > 0) {
          sum += max[i - w] / original[i - w];
          n++;
        }
        if (y < h - 1 && original[i + w] > 0) {
          sum += max[i + w] / original[i + w];
          n++;
        }
        if (n === 0) {
          out[i] = max[i];
          continue;
        }
        const frac = max[i] / orig;
        const target = sum / n;
        const next = frac + FERTILITY_SPREAD * (target - frac);
        out[i] = Math.max(0, Math.min(orig, next * orig));
      }
    }
    max.set(out);
  }

  /** Blight fires when a local patch of land has been worn past the
   *  threshold; plague fires when a dense contact cluster crosses it,
   *  and transmits along the favoured-partner graph. Both come from
   *  what the society has done to itself, not a global dice roll. */
  private rollShocks(): void {
    const BLIGHT_COOLDOWN = 150;
    const PLAGUE_COOLDOWN = 220;
    if (this.turn < 100) return;
    if (this.turn < this.blightUntilTurn) return;
    if (this.turn - this.lastBlightTurn < BLIGHT_COOLDOWN) {
      // Still within the blight-refractory period. Plague can still fire.
    } else if (this.detectLocalBlight()) {
      this.blightUntilTurn = this.turn + 25;
      this.lastBlightTurn = this.turn;
      return;
    }
    if (this.turn - this.lastPlagueTurn < PLAGUE_COOLDOWN) return;
    this.detectAndCascadePlague();
  }

  /** Scan the grid for the worst 5×5 neighbourhood degradation. If any
   *  patch has lost more than the threshold of its pristine capacity,
   *  the blight fires — desertification travelling outward. */
  private detectLocalBlight(): boolean {
    const LOCAL_BLIGHT_THRESHOLD = 0.38;
    const R = 2;
    const w = this.width;
    const h = this.height;
    let worst = 0;
    for (let y = R; y < h - R; y += 3) {
      for (let x = R; x < w - R; x += 3) {
        let pristine = 0;
        let current = 0;
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            const i = (y + dy) * w + (x + dx);
            pristine += this.originalMaxCells[i] + this.originalMaxSpice[i];
            current += this.maxCells[i] + this.maxSpice[i];
          }
        }
        if (pristine <= 0) continue;
        const local = 1 - current / pristine;
        if (local > worst) worst = local;
        if (worst >= LOCAL_BLIGHT_THRESHOLD) return true;
      }
    }
    return false;
  }

  /** Density gate + partner-graph cascade. A dense-cluster seed becomes
   *  patient zero; infection spreads along favoured-partner ties with
   *  decreasing probability. High-prosociality agents resist a little. */
  private detectAndCascadePlague(): void {
    const PLAGUE_DENSITY = 0.07;
    let alive = 0;
    for (const ag of this.agents) if (ag.alive) alive++;
    const density = alive / (this.width * this.height);
    if (density < PLAGUE_DENSITY) return;

    let seed: Agent | null = null;
    let seedNeighbourhood = -1;
    for (let attempt = 0; attempt < 12; attempt++) {
      const j = Math.floor(this.rng() * this.agents.length);
      const cand = this.agents[j];
      if (!cand?.alive) continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cand.x + dx;
          const ny = cand.y + dy;
          if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
          const occ = this.occupants[ny * this.width + nx];
          if (occ !== -1) count++;
        }
      }
      // Prefer clustered seeds but accept a lone one if all candidates were
      // isolated — otherwise sparse populations never seed a plague at all.
      if (count > seedNeighbourhood) {
        seedNeighbourhood = count;
        seed = cand;
      }
    }
    if (!seed) return;

    const SURVIVE_BONUS = 0.4;
    const infected = new Set<number>();
    const queue: { id: number; strength: number }[] = [
      { id: seed.id, strength: 1 },
    ];
    let deaths = 0;
    let step = 0;
    while (queue.length > 0) {
      const { id, strength } = queue.shift()!;
      step++;
      if (infected.has(id) || strength < 0.15) continue;
      infected.add(id);
      const ag = this.agents[id];
      if (!ag?.alive) continue;
      const immunity = SURVIVE_BONUS * ag.traits.prosociality;
      const isSeed = step === 1;
      // Patient zero always contracts — otherwise a lucky immunity roll
      // silently defeats the outbreak before it starts.
      const dies = isSeed || this.rng() < strength * (1 - immunity);
      if (dies) {
        this.killAgent(ag);
        deaths++;
      }
      for (const fid of ag.favouredPartners) {
        if (!infected.has(fid) && this.agents[fid]?.alive) {
          queue.push({ id: fid, strength: strength * 0.75 });
        }
      }
    }

    if (deaths === 0) return;
    this.lastPlagueDeaths = deaths;
    this.lastPlagueTurn = this.turn;
  }

  private moveAndHarvest(a: Agent): void {
    const target = this.chooseTarget(a);

    a.prevX = a.x;
    a.prevY = a.y;
    if (target.x !== a.x || target.y !== a.y) {
      this.occupants[a.y * this.width + a.x] = -1;
      a.x = target.x;
      a.y = target.y;
      this.occupants[a.y * this.width + a.x] = a.id;
    }

    const idx = a.y * this.width + a.x;
    const sugarGain = this.cells[idx] * sugarYieldFromTraits(a.traits);
    const spiceGain = this.spice[idx] * spiceYieldFromTraits(a.traits);
    a.sugar += sugarGain;
    a.spice += spiceGain;
    // Track "good cells" — anything above the agent's own EMA is worth
    // returning to. EMA update mixes the new gain at ~15%.
    const gain = sugarGain + spiceGain;
    if (gain > a.meanHarvest * 1.25 && gain > 0.5) {
      if (!a.goodCells.includes(idx)) {
        a.goodCells.push(idx);
        if (a.goodCells.length > 4) a.goodCells.shift();
      }
    }
    a.meanHarvest = a.meanHarvest * 0.85 + gain * 0.15;
    this.cells[idx] = 0;
    this.spice[idx] = 0;
    // Each harvest nibbles the cell's carrying capacity.
    if (this.originalMaxCells[idx] > 0 || this.originalMaxSpice[idx] > 0) {
      const DEGRADE_PER_HARVEST = 0.004;
      this.maxCells[idx] = Math.max(
        0,
        this.maxCells[idx] - this.originalMaxCells[idx] * DEGRADE_PER_HARVEST,
      );
      this.maxSpice[idx] = Math.max(
        0,
        this.maxSpice[idx] - this.originalMaxSpice[idx] * DEGRADE_PER_HARVEST,
      );
    }
  }

  /** Move dispatch: greedy (full vision), satisfice (short horizon),
   *  adaptive (vision × learned boldness), social (follow the richest). */
  private chooseTarget(a: Agent): { x: number; y: number } {
    switch (a.sophistication) {
      case "bounded_rational":
        return this.satisficeMove(a);
      case "adaptive":
        return this.adaptiveMove(a);
      case "social":
        return this.imitativeMove(a);
      default:
        return this.greedyMove(a, a.vision);
    }
  }

  /** The four on-axis cells at distance `d`. */
  private axisTargets(a: Agent, d: number): [number, number][] {
    return [
      [a.x + d, a.y],
      [a.x - d, a.y],
      [a.x, a.y + d],
      [a.x, a.y - d],
    ];
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  private isFree(idx: number, a: Agent): boolean {
    const occ = this.occupants[idx];
    return occ === -1 || occ === a.id;
  }

  /** Best free cell within `vision`; ties broken to the nearer cell. */
  private greedyMove(a: Agent, vision: number): { x: number; y: number } {
    let bestX = a.x;
    let bestY = a.y;
    let bestScore = this.scoreCell(a, a.x, a.y);
    let bestDist = 0;

    for (let d = 1; d <= vision; d++) {
      for (const [cx, cy] of this.axisTargets(a, d)) {
        if (!this.inBounds(cx, cy)) continue;
        const idx = cy * this.width + cx;
        if (!this.isFree(idx, a)) continue;
        const score = this.scoreCell(a, cx, cy);
        if (
          score > bestScore ||
          (score === bestScore && bestDist > 0 && d < bestDist)
        ) {
          bestScore = score;
          bestX = cx;
          bestY = cy;
          bestDist = d;
        }
      }
    }
    return { x: bestX, y: bestY };
  }

  /** Half the vision; take the first cell clearly better than staying put. */
  private satisficeMove(a: Agent): { x: number; y: number } {
    const goodEnough = this.scoreCell(a, a.x, a.y) * 1.1 + 0.5;
    const horizon = Math.max(1, Math.ceil(a.vision / 2));

    for (let d = 1; d <= horizon; d++) {
      for (const [cx, cy] of this.axisTargets(a, d)) {
        if (!this.inBounds(cx, cy)) continue;
        const idx = cy * this.width + cx;
        if (!this.isFree(idx, a)) continue;
        if (this.scoreCell(a, cx, cy) >= goodEnough) return { x: cx, y: cy };
      }
    }
    return { x: a.x, y: a.y };
  }

  /** With prob `boldness` use full vision, else look 1 cell. Boldness
   *  is updated in `consume` from whether holdings rose. */
  private adaptiveMove(a: Agent): { x: number; y: number } {
    const vision = this.rng() < a.boldness ? a.vision : 1;
    return this.greedyMove(a, vision);
  }

  /** Step toward the richest visible neighbour; sometimes copy their
   *  motivation. Falls back to greedy if nobody is richer. */
  private imitativeMove(a: Agent): { x: number; y: number } {
    let exemplar = -1;
    let exemplarWealth = holdings(a);
    let ex = a.x;
    let ey = a.y;

    for (let d = 1; d <= a.vision; d++) {
      for (const [cx, cy] of this.axisTargets(a, d)) {
        if (!this.inBounds(cx, cy)) continue;
        const occ = this.occupants[cy * this.width + cx];
        if (occ === -1 || occ === a.id) continue;
        const other = this.agents[occ];
        if (!other.alive) continue;
        const w = holdings(other);
        if (w > exemplarWealth) {
          exemplarWealth = w;
          exemplar = occ;
          ex = cx;
          ey = cy;
        }
      }
    }

    if (exemplar === -1) return this.greedyMove(a, a.vision);

    const role = this.agents[exemplar].motivation;
    if (role !== a.motivation && this.rng() < 0.1) a.motivation = role;

    const stepX = Math.sign(ex - a.x);
    const stepY = Math.sign(ey - a.y);
    const candidates: [number, number][] = [
      [a.x + stepX, a.y + stepY],
      [a.x + stepX, a.y],
      [a.x, a.y + stepY],
    ];

    let bestX = a.x;
    let bestY = a.y;
    let bestScore = this.scoreCell(a, a.x, a.y);
    for (const [cx, cy] of candidates) {
      if (cx === a.x && cy === a.y) continue;
      if (!this.inBounds(cx, cy)) continue;
      const idx = cy * this.width + cx;
      if (!this.isFree(idx, a)) continue;
      const score = this.scoreCell(a, cx, cy);
      if (score > bestScore) {
        bestScore = score;
        bestX = cx;
        bestY = cy;
      }
    }
    return { x: bestX, y: bestY };
  }

  private consume(a: Agent): void {
    if (a.sophistication === "adaptive") {
      const now = holdings(a);
      a.boldness =
        now > a.lastHoldings
          ? Math.min(1, a.boldness + 0.05)
          : Math.max(0.05, a.boldness - 0.05);
      a.lastHoldings = now;
    }

    a.sugar -= a.sugarMetab;
    a.spice -= a.spiceMetab;
    a.age++;

    if (a.sugar <= 0 || a.spice <= 0 || a.age >= a.maxAge) {
      this.killAgent(a);
    }
  }

  private scoreCell(a: Agent, x: number, y: number): number {
    const idx = y * this.width + x;
    const resources = this.cells[idx] + this.spice[idx];
    const pristine =
      this.originalMaxCells[idx] + this.originalMaxSpice[idx];
    const fertility =
      pristine > 0 ? (this.maxCells[idx] + this.maxSpice[idx]) / pristine : 1;
    // Self-history: 10% boost for cells the agent remembers as productive.
    const familiar = a.goodCells.includes(idx) ? 1.1 : 1;

    // Fast path: pure-greed agents don't need the neighbour scan.
    const t = a.traits;
    if (
      t.prosociality < 0.05 &&
      t.dominance < 0.05 &&
      t.statusSeeking < 0.05
    ) {
      return (
        resources * (0.6 + 0.5 * t.greed) * (0.4 + 0.6 * fertility) * familiar
      );
    }

    let count = 0;
    let totalWealth = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= this.height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= this.width) continue;
        const occ = this.occupants[ny * this.width + nx];
        if (occ === -1 || occ === a.id) continue;
        const other = this.agents[occ];
        if (!other.alive) continue;
        count++;
        totalWealth += holdings(other);
      }
    }
    const avgWealth = count > 0 ? totalWealth / count : 0;
    return (
      scoreCellByTraits(
        t,
        resources,
        count,
        avgWealth,
        holdings(a),
        fertility,
      ) * familiar
    );
  }

  /** Pairwise spice-for-sugar exchange. The aggregate of clearing prices
   *  each turn is the emergent market price. */
  private tradePhase(): void {
    let logPriceSum = 0;
    let volume = 0;

    for (const a of this.agents) {
      if (!a.alive) continue;
      const partners = this.partnersFor(a);
      for (const bId of partners) {
        // Each unordered pair handled once.
        if (bId <= a.id) continue;
        const b = this.agents[bId];
        if (!b.alive) continue;
        const price = this.tryTrade(a, b);
        if (price > 0) {
          logPriceSum += Math.log(price);
          volume++;
        }
      }
    }

    this.lastTradeVolume = volume;
    this.lastTradePrice = volume > 0 ? Math.exp(logPriceSum / volume) : 0;
  }

  /** Partner candidates under the active topology. */
  private partnersFor(a: Agent): number[] {
    const out: number[] = [];
    if (this.topology === "random") {
      for (let i = 0; i < 4; i++) {
        const j = Math.floor(this.rng() * this.agents.length);
        const other = this.agents[j];
        if (other && other.alive && other.id !== a.id) out.push(other.id);
      }
    } else {
      const radius = this.topology === "network" ? Math.min(a.vision, 4) : 1;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = a.y + dy;
        if (ny < 0 || ny >= this.height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = a.x + dx;
          if (nx < 0 || nx >= this.width) continue;
          const occ = this.occupants[ny * this.width + nx];
          if (occ !== -1 && occ !== a.id) out.push(occ);
        }
      }
    }
    // Prepend one still-living favoured partner so copied taste in
    // relationships actually bites against the raw topology.
    for (let i = a.favouredPartners.length - 1; i >= 0; i--) {
      const fid = a.favouredPartners[i];
      const other = this.agents[fid];
      if (other?.alive && !out.includes(fid)) {
        out.unshift(fid);
        break;
      }
    }
    return out;
  }

  private tryTrade(a: Agent, b: Agent): number {
    if (b.shamedUntilTurn > this.turn) {
      if (this.rng() < refuseShamedProbability(a.traits)) return 0;
    }
    if (a.shamedUntilTurn > this.turn) {
      if (this.rng() < refuseShamedProbability(b.traits)) return 0;
    }
    // Peer-learned distrust: norm-followers act on it, defectors ignore it.
    const distrustA = this.getDistrust(a.id, b.id);
    const distrustB = this.getDistrust(b.id, a.id);
    if (distrustA > 0 && this.rng() < distrustA * a.traits.prosociality) return 0;
    if (distrustB > 0 && this.rng() < distrustB * b.traits.prosociality) return 0;

    const mrsA = mrs(a);
    const mrsB = mrs(b);
    if (mrsA === mrsB) return 0;

    // Higher MRS = values spice more → buyer.
    const buyer = mrsA > mrsB ? a : b;
    const seller = mrsA > mrsB ? b : a;

    // Local clearing price = geometric mean of the two valuations.
    const price = Math.sqrt(mrsA * mrsB);
    const spiceQty = 1;
    const sugarQty = price * spiceQty;

    if (seller.spice <= spiceQty) return 0;

    // Try tokens first if the buyer holds any (use-them-or-lose-them —
    // issuers can default), or fall back to tokens if buyer is short on
    // sugar. Acceptance rolls here; token movement waits for the Pareto
    // check below.
    let tokenChoice:
      | { issuerId: number; trustworthiness: number; transfer: boolean }
      | null = null;
    let buyerSugarOut = sugarQty;
    let sellerSugarIn = sugarQty;
    const buyerHoldsTokens = (this.tokenHoldings.get(buyer.id)?.size ?? 0) > 0;
    const tryTokensFirst = buyerHoldsTokens || buyer.sugar <= sugarQty;
    if (tryTokensFirst) {
      const proposal = this.chooseTokenPayment(buyer, seller, sugarQty);
      if (proposal) {
        // Provisional: if discounted value fails Pareto below, fall
        // through to sugar trade (when buyer can afford it).
        const sellerValue = sugarQty * proposal.trustworthiness;
        const sellerBefore = welfare(seller.sugar, seller.spice, seller.sugarMetab, seller.spiceMetab);
        const sellerAfter = welfare(seller.sugar + sellerValue, seller.spice - spiceQty, seller.sugarMetab, seller.spiceMetab);
        const buyerBefore = welfare(buyer.sugar, buyer.spice, buyer.sugarMetab, buyer.spiceMetab);
        const buyerAfter = welfare(buyer.sugar, buyer.spice + spiceQty, buyer.sugarMetab, buyer.spiceMetab);
        if (sellerAfter > sellerBefore && buyerAfter > buyerBefore) {
          tokenChoice = proposal;
          buyerSugarOut = 0;
          sellerSugarIn = sellerValue;
        }
      }
      if (!tokenChoice && buyer.sugar <= sugarQty) return 0;
    }

    const buyerBefore = welfare(buyer.sugar, buyer.spice, buyer.sugarMetab, buyer.spiceMetab);
    const sellerBefore = welfare(seller.sugar, seller.spice, seller.sugarMetab, seller.spiceMetab);
    const buyerAfter = welfare(buyer.sugar - buyerSugarOut, buyer.spice + spiceQty, buyer.sugarMetab, buyer.spiceMetab);
    const sellerAfter = welfare(seller.sugar + sellerSugarIn, seller.spice - spiceQty, seller.sugarMetab, seller.spiceMetab);

    if (buyerAfter <= buyerBefore || sellerAfter <= sellerBefore) return 0;

    if (tokenChoice) {
      this.executeTokenPayment(buyer, seller, sugarQty, tokenChoice);
    } else {
      buyer.sugar -= sugarQty;
      seller.sugar += sugarQty;
    }
    buyer.spice += spiceQty;
    seller.spice -= spiceQty;

    // Bonus scales with the pair's min prosociality plus existing trust.
    const trust = this.getTie(a.id, b.id);
    const trustBonus = (Math.min(trust, TIE_CAP) / TIE_CAP) * 0.05;
    const bonus = cooperativeBonus(a.traits, b.traits) + trustBonus;
    if (bonus > 0) {
      buyer.spice += spiceQty * bonus;
      seller.sugar += sugarQty * bonus;
    }

    this.bumpTie(a.id, b.id);
    this.rememberPartner(a, b.id);
    this.rememberPartner(b, a.id);
    return price;
  }

  private rememberPartner(a: Agent, partnerId: number): void {
    if (partnerId === a.id) return;
    const idx = a.favouredPartners.indexOf(partnerId);
    if (idx >= 0) a.favouredPartners.splice(idx, 1);
    a.favouredPartners.push(partnerId);
    if (a.favouredPartners.length > 6) a.favouredPartners.shift();
  }

  private getDistrust(witnessId: number, offenderId: number): number {
    return this.distrust.get(witnessId)?.get(offenderId) ?? 0;
  }

  private bumpDistrust(witnessId: number, offenderId: number, w: number): void {
    if (witnessId === offenderId) return;
    let row = this.distrust.get(witnessId);
    if (!row) {
      row = new Map();
      this.distrust.set(witnessId, row);
    }
    const next = Math.min(1, (row.get(offenderId) ?? 0) + w);
    row.set(offenderId, next);
  }

  private getIssuerDistrust(witnessId: number, issuerId: number): number {
    return this.issuerDistrust.get(witnessId)?.get(issuerId) ?? 0;
  }

  private bumpIssuerDistrust(
    witnessId: number,
    issuerId: number,
    w: number,
  ): void {
    if (witnessId === issuerId) return;
    let row = this.issuerDistrust.get(witnessId);
    if (!row) {
      row = new Map();
      this.issuerDistrust.set(witnessId, row);
    }
    const next = Math.min(1, (row.get(issuerId) ?? 0) + w);
    row.set(issuerId, next);
  }

  private decayReputations(): void {
    const DISTRUST_DECAY = 0.98;
    const DISTRUST_FLOOR = 0.05;
    for (const [wit, row] of this.distrust) {
      for (const [off, w] of row) {
        const next = w * DISTRUST_DECAY;
        if (next < DISTRUST_FLOOR) row.delete(off);
        else row.set(off, next);
      }
      if (row.size === 0) this.distrust.delete(wit);
    }
    for (const [wit, row] of this.issuerDistrust) {
      for (const [iss, w] of row) {
        const next = w * DISTRUST_DECAY;
        if (next < DISTRUST_FLOOR) row.delete(iss);
        else row.set(iss, next);
      }
      if (row.size === 0) this.issuerDistrust.delete(wit);
    }
    for (const [id, n] of this.offenderNotoriety) {
      const next = n * DISTRUST_DECAY;
      if (next < DISTRUST_FLOOR) this.offenderNotoriety.delete(id);
      else this.offenderNotoriety.set(id, next);
    }
  }

  private scrubReputations(id: number): void {
    this.distrust.delete(id);
    this.issuerDistrust.delete(id);
    this.offenderNotoriety.delete(id);
    for (const row of this.distrust.values()) row.delete(id);
    for (const row of this.issuerDistrust.values()) row.delete(id);
  }

  private bumpTie(idA: number, idB: number): void {
    const lo = idA < idB ? idA : idB;
    const hi = idA < idB ? idB : idA;
    let row = this.tiesMap.get(lo);
    if (!row) {
      row = new Map();
      this.tiesMap.set(lo, row);
    }
    const next = Math.min(TIE_CAP, (row.get(hi) ?? 0) + TIE_INCREMENT);
    row.set(hi, next);
  }

  /** Tie weight for a pair (0 if none). Doubles as a trust score. */
  private getTie(idA: number, idB: number): number {
    const lo = idA < idB ? idA : idB;
    const hi = idA < idB ? idB : idA;
    return this.tiesMap.get(lo)?.get(hi) ?? 0;
  }

  /** Erase the pair's tie — coercion destroys trust. */
  private crashTie(idA: number, idB: number): void {
    const lo = idA < idB ? idA : idB;
    const hi = idA < idB ? idB : idA;
    const row = this.tiesMap.get(lo);
    if (!row) return;
    row.delete(hi);
    if (row.size === 0) this.tiesMap.delete(lo);
  }

  /** Credit `qty` tokens to `holder` and grow issuer's liability. */
  private addToken(holderId: number, issuerId: number, qty: number): void {
    if (qty <= 0) return;
    let row = this.tokenHoldings.get(holderId);
    if (!row) {
      row = new Map();
      this.tokenHoldings.set(holderId, row);
    }
    row.set(issuerId, (row.get(issuerId) ?? 0) + qty);
    this.tokenLiability.set(
      issuerId,
      (this.tokenLiability.get(issuerId) ?? 0) + qty,
    );
  }

  /** Debit `qty` from `holder`. `retire` drops the issuer's liability
   *  too; pass `false` for transfers (new holder re-adds it). */
  private removeToken(
    holderId: number,
    issuerId: number,
    qty: number,
    retire: boolean,
  ): boolean {
    const row = this.tokenHoldings.get(holderId);
    if (!row) return false;
    const cur = row.get(issuerId) ?? 0;
    if (cur < qty - 1e-9) return false;
    const next = cur - qty;
    if (next <= 1e-9) {
      row.delete(issuerId);
      if (row.size === 0) this.tokenHoldings.delete(holderId);
    } else {
      row.set(issuerId, next);
    }
    if (retire) {
      const lib = (this.tokenLiability.get(issuerId) ?? 0) - qty;
      if (lib <= 1e-9) this.tokenLiability.delete(issuerId);
      else this.tokenLiability.set(issuerId, lib);
    }
    return true;
  }

  /** Wealth ÷ liability, discounted by the issuer's death risk. 0..1. */
  private trustworthiness(issuer: Agent): number {
    if (!issuer.alive) return 0;
    const wealth = issuer.sugar + issuer.spice;
    const liability = this.tokenLiability.get(issuer.id) ?? 0;
    const collateral = wealth / (liability + TOKEN_PRIOR_LIABILITY);
    const survival = issuer.maxAge > 0 ? 1 - Math.pow(issuer.age / issuer.maxAge, 4) : 0.5;
    return Math.max(0, Math.min(1, collateral)) * Math.max(0, survival);
  }

  /** Pick a token plan the seller accepts, or null. Prefers spending
   *  held tokens; a fresh IOU is the last resort. Acceptance rolls here
   *  so the caller can preview welfare safely. */
  private chooseTokenPayment(
    buyer: Agent,
    seller: Agent,
    deficit: number,
  ): { issuerId: number; trustworthiness: number; transfer: boolean } | null {
    if (deficit <= 0) return null;

    type Option = {
      issuerId: number;
      trustworthiness: number;
      transfer: boolean;
    };
    const options: Option[] = [];

    const held = this.tokenHoldings.get(buyer.id);
    if (held) {
      for (const [issuerId, qty] of held) {
        if (qty < deficit) continue;
        if (issuerId === seller.id) continue;
        const issuer = this.agents[issuerId];
        if (!issuer) continue;
        options.push({
          issuerId,
          trustworthiness: this.trustworthiness(issuer),
          transfer: true,
        });
      }
    }
    options.push({
      issuerId: buyer.id,
      trustworthiness: this.trustworthiness(buyer),
      transfer: false,
    });

    options.sort((p, q) => {
      const dt = q.trustworthiness - p.trustworthiness;
      if (dt !== 0) return dt;
      return p.transfer === q.transfer ? 0 : p.transfer ? -1 : 1;
    });

    const trust = Math.min(1, this.getTie(buyer.id, seller.id) / TIE_CAP);
    for (const opt of options) {
      const distrust = this.getIssuerDistrust(seller.id, opt.issuerId);
      const effectiveTrustworthiness = opt.trustworthiness * (1 - distrust);
      const acceptProb = tokenAcceptanceProb(
        seller.traits,
        trust,
        effectiveTrustworthiness,
      );
      if (this.rng() >= acceptProb) continue;
      return opt;
    }
    return null;
  }

  /** Apply a previously-chosen token payment. */
  private executeTokenPayment(
    buyer: Agent,
    seller: Agent,
    deficit: number,
    choice: { issuerId: number; transfer: boolean },
  ): void {
    if (choice.transfer) {
      this.removeToken(buyer.id, choice.issuerId, deficit, false);
      this.addToken(seller.id, choice.issuerId, deficit);
    } else {
      this.addToken(seller.id, buyer.id, deficit);
      this.tokenIssuedLifetime.set(
        buyer.id,
        (this.tokenIssuedLifetime.get(buyer.id) ?? 0) + deficit,
      );
    }
    this.lastTokenTradeVolume++;
  }

  private decayTies(): void {
    for (const [lo, row] of this.tiesMap) {
      for (const [hi, w] of row) {
        const next = w * TIE_DECAY;
        if (next < TIE_THRESHOLD) row.delete(hi);
        else row.set(hi, next);
      }
      if (row.size === 0) this.tiesMap.delete(lo);
    }
  }

  private scrubTies(id: number): void {
    this.tiesMap.delete(id);
    for (const [lo, row] of this.tiesMap) {
      row.delete(id);
      if (row.size === 0) this.tiesMap.delete(lo);
    }
  }

  /** Friend-of-friend closure: when A has strong ties to B and C, sometimes
   *  a weak seed tie opens between B and C. This is where triangles close
   *  and multi-agent coalitions can form out of a dyadic graph. */
  private triadicClosure(): void {
    const CLOSURE_TIE_THRESHOLD = 2;
    const CLOSURE_PROB = 0.02;
    const SEED_WEIGHT = TIE_INCREMENT * 0.5;

    // Build each agent's list of strong partners (both tie directions).
    const strong = new Map<number, number[]>();
    const push = (id: number, other: number) => {
      let list = strong.get(id);
      if (!list) {
        list = [];
        strong.set(id, list);
      }
      list.push(other);
    };
    for (const [lo, row] of this.tiesMap) {
      for (const [hi, w] of row) {
        if (w < CLOSURE_TIE_THRESHOLD) continue;
        push(lo, hi);
        push(hi, lo);
      }
    }

    let alive = 0;
    for (const ag of this.agents) if (ag.alive) alive++;
    let budget = Math.max(1, Math.floor(alive * 0.02));

    for (const [anchor, partners] of strong) {
      if (budget <= 0) break;
      if (partners.length < 2) continue;
      // Try one random pair per anchor per tick — enough for closure to
      // percolate over ~50 turns without blowing the tie graph up.
      const i = Math.floor(this.rng() * partners.length);
      let j = Math.floor(this.rng() * (partners.length - 1));
      if (j >= i) j++;
      const b = partners[i];
      const c = partners[j];
      if (b === c) continue;
      if (this.getTie(b, c) > 0) continue;
      if (this.rng() >= CLOSURE_PROB) continue;
      const bAgent = this.agents[b];
      const cAgent = this.agents[c];
      if (!bAgent?.alive || !cAgent?.alive) continue;
      // Only close if neither party distrusts the other.
      if (this.getDistrust(b, c) > 0.2) continue;
      if (this.getDistrust(c, b) > 0.2) continue;
      const lo = b < c ? b : c;
      const hi = b < c ? c : b;
      let row = this.tiesMap.get(lo);
      if (!row) {
        row = new Map();
        this.tiesMap.set(lo, row);
      }
      row.set(hi, SEED_WEIGHT);
      budget--;
      void anchor;
    }
  }

  private killAgent(a: Agent): void {
    if (this.inheritance) {
      this.bequeathToTies(a);
    }
    a.alive = false;
    this.occupants[a.y * this.width + a.x] = -1;
    this.scrubTies(a.id);
    this.scrubReputations(a.id);
    this.dishonourTokens(a.id);
  }

  private dishonourTokens(deadId: number): void {
    const outstanding = this.tokenLiability.get(deadId);
    if (outstanding === undefined) return;
    const burnedHolders: number[] = [];
    for (const [holderId, row] of this.tokenHoldings) {
      const held = row.get(deadId);
      if (held === undefined) continue;
      burnedHolders.push(holderId);
      row.delete(deadId);
      if (row.size === 0) this.tokenHoldings.delete(holderId);
    }
    this.tokenLiability.delete(deadId);
    this.tokenDefaultedLifetime.set(
      deadId,
      (this.tokenDefaultedLifetime.get(deadId) ?? 0) + outstanding,
    );
    // Burned holders spread distrust onto every *other* issuer they hold,
    // so a run doesn't need a second default to gather momentum.
    for (const holderId of burnedHolders) {
      const holder = this.agents[holderId];
      if (!holder?.alive) continue;
      const otherIssuers = this.tokenHoldings.get(holderId);
      if (!otherIssuers) continue;
      for (const iss of otherIssuers.keys()) {
        this.bumpIssuerDistrust(holderId, iss, 0.15);
      }
    }
  }

  /** Split the dying agent's wealth among living tie partners weighted
   *  by tie strength. Only the positive part is bequeathed — a starved
   *  agent's negative balance would poison heirs' MRS/price with NaNs. */
  private bequeathToTies(a: Agent): void {
    const sugar = a.sugar > 0 ? a.sugar : 0;
    const spice = a.spice > 0 ? a.spice : 0;
    if (sugar + spice <= 0) return;

    // Ties store each pair once as (lo, hi) — look in both directions.
    const partners: { id: number; weight: number }[] = [];
    const lowMap = this.tiesMap.get(a.id);
    if (lowMap) {
      for (const [hi, w] of lowMap) partners.push({ id: hi, weight: w });
    }
    for (const [lo, row] of this.tiesMap) {
      const w = row.get(a.id);
      if (w !== undefined) partners.push({ id: lo, weight: w });
    }
    if (partners.length === 0) return;

    const living = partners.filter((p) => this.agents[p.id]?.alive);
    const liveWeight = living.reduce((s, p) => s + p.weight, 0);
    if (liveWeight <= 0) return;

    for (const p of living) {
      const share = p.weight / liveWeight;
      this.agents[p.id].sugar += sugar * share;
      this.agents[p.id].spice += spice * share;
    }
    a.sugar = 0;
    a.spice = 0;
  }

  private findEmptyCell(): number {
    for (let i = 0; i < 30; i++) {
      const idx = Math.floor(this.rng() * this.occupants.length);
      if (this.occupants[idx] === -1) return idx;
    }
    for (let i = 0; i < this.occupants.length; i++) {
      if (this.occupants[i] === -1) return i;
    }
    return -1;
  }

  getSnapshot(): EngineSnapshot {
    let alive = 0;
    let totalWealth = 0;
    const wealths: number[] = [];
    const wealthBins = new Array(WEALTH_BIN_EDGES.length + 1).fill(0);
    const motivationCounts = {
      material: 0,
      symbolic: 0,
      normative: 0,
      power: 0,
    };

    const tied = new Set<number>();
    let tieCount = 0;
    for (const [lo, row] of this.tiesMap) {
      for (const hi of row.keys()) {
        tied.add(lo);
        tied.add(hi);
        tieCount++;
      }
    }

    // For the segregation index — same-motivation pairs out of all neighbour pairs.
    let neighbourPairs = 0;
    let sameMotivationPairs = 0;
    let isolates = 0;

    for (const a of this.agents) {
      if (!a.alive) continue;
      alive++;
      motivationCounts[a.motivation]++;
      if (!tied.has(a.id)) isolates++;
      const w = holdings(a);
      totalWealth += w;
      wealths.push(w);
      let placed = false;
      for (let i = 0; i < WEALTH_BIN_EDGES.length; i++) {
        if (w < WEALTH_BIN_EDGES[i]) {
          wealthBins[i]++;
          placed = true;
          break;
        }
      }
      if (!placed) wealthBins[wealthBins.length - 1]++;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = a.y + dy;
        if (ny < 0 || ny >= this.height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = a.x + dx;
          if (nx < 0 || nx >= this.width) continue;
          const occ = this.occupants[ny * this.width + nx];
          if (occ === -1) continue;
          const n = this.agents[occ];
          if (!n.alive) continue;
          neighbourPairs++;
          if (n.motivation === a.motivation) sameMotivationPairs++;
        }
      }
    }

    const tokens = this.tokenSnapshot();
    const topIssuerMistrust = this.computeTopIssuerDistrust(
      tokens.topIssuerId,
      alive,
    );
    const BANK_RUN_THRESHOLD = 0.55;
    const BANK_RUN_COOLDOWN = 200;
    let bankRunActive = false;
    if (
      tokens.topIssuerId >= 0 &&
      topIssuerMistrust >= BANK_RUN_THRESHOLD &&
      this.turn - this.bankRunTurn > BANK_RUN_COOLDOWN
    ) {
      this.executeBankRun(tokens.topIssuerId);
      this.bankRunTurn = this.turn;
      this.bankRunIssuerId = tokens.topIssuerId;
      bankRunActive = true;
    } else if (this.turn === this.bankRunTurn) {
      bankRunActive = true;
    }

    return {
      turn: this.turn,
      alive,
      totalWealth,
      gini: giniCoefficient(wealths),
      wealthBins,
      tradePrice: this.lastTradePrice,
      tradeVolume: this.lastTradeVolume,
      motivationCounts,
      segregation: segregationIndex(
        sameMotivationPairs,
        neighbourPairs,
        motivationCounts,
        alive,
      ),
      coercionCount: this.lastCoercionCount,
      shamingCount: this.lastShamingCount,
      tieCount,
      isolateShare: alive > 0 ? isolates / alive : 0,
      blightActive: this.turn < this.blightUntilTurn,
      blightStartedTurn: this.lastBlightTurn,
      plagueDeathsThisTurn:
        this.turn - 1 === this.lastPlagueTurn ? this.lastPlagueDeaths : 0,
      landDegradation: this.computeLandDegradation(),
      ...tokens,
      topInfluencerId: this.lastInfluencerId,
      topInfluencerCentrality: this.lastInfluencerCentrality,
      topIssuerMistrust,
      bankRunActive,
      bankRunStartedTurn: this.bankRunTurn,
    };
  }

  /** A run on the biggest issuer: holders redeem what the issuer can
   *  cover (out of its own sugar) and burn the rest. Credit collapses. */
  private executeBankRun(issuerId: number): void {
    const issuer = this.agents[issuerId];
    if (!issuer?.alive) return;
    const outstanding = this.tokenLiability.get(issuerId) ?? 0;
    if (outstanding <= 0) return;

    let redeemable = issuer.sugar * 0.7;
    for (const [holderId, row] of this.tokenHoldings) {
      const held = row.get(issuerId);
      if (held === undefined) continue;
      const holder = this.agents[holderId];
      const pay = Math.min(held, redeemable);
      if (holder?.alive && pay > 0) {
        holder.sugar += pay;
        issuer.sugar -= pay;
        redeemable -= pay;
      }
      row.delete(issuerId);
      if (row.size === 0) this.tokenHoldings.delete(holderId);
      if (holder?.alive) this.bumpIssuerDistrust(holder.id, issuerId, 0.8);
    }
    this.tokenLiability.delete(issuerId);
    this.tokenDefaultedLifetime.set(
      issuerId,
      (this.tokenDefaultedLifetime.get(issuerId) ?? 0) + outstanding,
    );
  }

  private tokenSnapshot(): {
    tokenSupply: number;
    tokenTradeVolume: number;
    topIssuerId: number;
    topIssuerLiability: number;
    circulatingIssuers: number;
  } {
    let supply = 0;
    let topId = -1;
    let topQty = 0;
    for (const [issuerId, qty] of this.tokenLiability) {
      supply += qty;
      if (qty > topQty) {
        topQty = qty;
        topId = issuerId;
      }
    }
    // ≥3 distinct holders = the tokens have started circulating as money.
    const holdersPerIssuer = new Map<number, number>();
    for (const row of this.tokenHoldings.values()) {
      for (const issuerId of row.keys()) {
        holdersPerIssuer.set(issuerId, (holdersPerIssuer.get(issuerId) ?? 0) + 1);
      }
    }
    let circulating = 0;
    for (const count of holdersPerIssuer.values()) {
      if (count >= 3) circulating++;
    }
    return {
      tokenSupply: supply,
      tokenTradeVolume: this.lastTokenTradeVolume,
      topIssuerId: topId,
      topIssuerLiability: topQty,
      circulatingIssuers: circulating,
    };
  }

  private computeLandDegradation(): number {
    if (this.pristineLandTotal <= 0) return 0;
    let current = 0;
    for (let i = 0; i < this.maxCells.length; i++) {
      current += this.maxCells[i] + this.maxSpice[i];
    }
    return Math.max(0, 1 - current / this.pristineLandTotal);
  }

  private refreshInfluencer(): void {
    if (this.tiesMap.size === 0) {
      this.lastInfluencerId = -1;
      this.lastInfluencerCentrality = 0;
      return;
    }
    const inbound = new Map<number, number>();
    const add = (id: number, w: number) => {
      inbound.set(id, (inbound.get(id) ?? 0) + w);
    };
    for (const [lo, row] of this.tiesMap) {
      for (const [hi, w] of row) {
        add(lo, w);
        add(hi, w);
      }
    }
    let topId = -1;
    let topW = 0;
    for (const [id, w] of inbound) {
      if (w > topW && this.agents[id]?.alive) {
        topW = w;
        topId = id;
      }
    }
    this.lastInfluencerId = topId;
    this.lastInfluencerCentrality = topW;
  }

  /** Holder-normalised: what share of the top issuer's holders distrust
   *  the issuer, weighted by how strong that distrust is. This is the
   *  meaningful "bank run" indicator — the general population's opinion
   *  is irrelevant, only actual holders can start a run. */
  private computeTopIssuerDistrust(topIssuerId: number, alive: number): number {
    if (topIssuerId < 0 || alive <= 0) return 0;
    let holders = 0;
    let sum = 0;
    for (const [holderId, row] of this.tokenHoldings) {
      if (!row.has(topIssuerId)) continue;
      if (!this.agents[holderId]?.alive) continue;
      holders++;
      const w = this.issuerDistrust.get(holderId)?.get(topIssuerId) ?? 0;
      sum += w;
    }
    if (holders === 0) return 0;
    return sum / holders;
  }

  randomFloat(): number {
    return this.rng();
  }

  /** Flat [loId, hiId, weight, …] view of the tie map, for the worker. */
  get ties(): Float32Array {
    let count = 0;
    for (const row of this.tiesMap.values()) count += row.size;
    const out = new Float32Array(count * 3);
    let i = 0;
    for (const [lo, row] of this.tiesMap) {
      for (const [hi, w] of row) {
        out[i++] = lo;
        out[i++] = hi;
        out[i++] = w;
      }
    }
    return out;
  }
}

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/** Spatial sorting of motivation. 0 = fully mixed, 1 = fully sorted.
 *  Normalised against the random baseline Σpₘ². */
function segregationIndex(
  samePairs: number,
  totalPairs: number,
  counts: Record<AgentMotivation, number>,
  alive: number,
): number {
  if (totalPairs === 0 || alive === 0) return 0;
  const observed = samePairs / totalPairs;
  let expected = 0;
  for (const k of Object.keys(counts) as AgentMotivation[]) {
    const p = counts[k] / alive;
    expected += p * p;
  }
  if (expected >= 1) return 0;
  const idx = (observed - expected) / (1 - expected);
  return idx < 0 ? 0 : idx > 1 ? 1 : idx;
}

function giniCoefficient(values: number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  let total = 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    total += sorted[i];
    weighted += (i + 1) * sorted[i];
  }
  if (total <= 0) return 0;
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

/** Sugar and spice peak in different places so any settled agent is
 *  rich in one and short on the other — the precondition for trade. */
function buildLandscape(
  sugar: Float32Array,
  spice: Float32Array,
  width: number,
  height: number,
  landscape: Landscape,
  rng: () => number,
): void {
  if (landscape === "flat") {
    sugar.fill(3);
    spice.fill(3);
    return;
  }

  type Peak = { x: number; y: number };
  let sugarPeaks: Peak[] = [];
  let spicePeaks: Peak[] = [];
  let sigma = Math.min(width, height) / 6;

  if (landscape === "two_peaks") {
    // Sugar east–west, spice north–south — gradients cross.
    sugarPeaks = [
      { x: width * 0.27, y: height * 0.5 },
      { x: width * 0.73, y: height * 0.5 },
    ];
    spicePeaks = [
      { x: width * 0.5, y: height * 0.27 },
      { x: width * 0.5, y: height * 0.73 },
    ];
    sigma = Math.min(width, height) / 5;
  } else if (landscape === "centre") {
    // Sugar core, spice in the corners.
    sugarPeaks = [{ x: width * 0.5, y: height * 0.5 }];
    spicePeaks = [
      { x: width * 0.2, y: height * 0.2 },
      { x: width * 0.8, y: height * 0.8 },
    ];
    sigma = Math.min(width, height) / 4;
  } else if (landscape === "scattered") {
    const k = 6;
    for (let i = 0; i < k; i++) {
      sugarPeaks.push({ x: rng() * width, y: rng() * height });
      spicePeaks.push({ x: rng() * width, y: rng() * height });
    }
    sigma = Math.min(width, height) / 10;
  }

  fillGaussian(sugar, width, height, sugarPeaks, sigma);
  fillGaussian(spice, width, height, spicePeaks, sigma);
}

function fillGaussian(
  out: Float32Array,
  width: number,
  height: number,
  peaks: { x: number; y: number }[],
  sigma: number,
): void {
  const twoSigmaSq = 2 * sigma * sigma;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let best = 0;
      for (const p of peaks) {
        const dx = x - p.x;
        const dy = y - p.y;
        const v = 4 * Math.exp(-(dx * dx + dy * dy) / twoSigmaSq);
        if (v > best) best = v;
      }
      out[y * width + x] = best;
    }
  }
}

/** Build a weighted random picker. Falls back to `fallback` if every weight is 0. */
function buildWeightedPicker<K extends string>(
  weights: WeightedSelection<K>,
  fallback: K,
  rng: () => number,
): () => K {
  const keys: K[] = [];
  const cumWeights: number[] = [];
  let acc = 0;
  for (const [k, w] of Object.entries(weights) as [K, number | undefined][]) {
    if (w === undefined || w <= 0) continue;
    keys.push(k);
    acc += w;
    cumWeights.push(acc);
  }
  const total = acc;
  return () => {
    if (keys.length === 0) return fallback;
    if (keys.length === 1) return keys[0];
    const r = rng() * total;
    for (let i = 0; i < cumWeights.length; i++) {
      if (r < cumWeights[i]) return keys[i];
    }
    return keys[keys.length - 1];
  };
}

function spawnAgents(
  engine: Engine,
  config: SimulationConfig,
  count: number,
): Agent[] {
  const physics = config.world.physics;
  const h = physics.heterogeneity;
  const rng = () => engine.randomFloat();

  const sampleAttr = (mean: number) => {
    if (h === 0) return mean;
    return mean * (1 - h + 2 * h * rng());
  };

  const buildPicker = <K extends string>(
    weights: WeightedSelection<K>,
    fallback: K,
  ): (() => K) => buildWeightedPicker(weights, fallback, rng);

  const pickMotivation = buildPicker(config.agents.motivation, "material");
  const pickSophistication = buildPicker(
    config.agents.sophistication,
    "minimal",
  );

  const baseline = 15;
  const eq = config.world.equality;
  const wealths: number[] = [];
  for (let i = 0; i < count; i++) {
    if (eq === 0) {
      wealths.push(baseline);
    } else {
      const u = Math.max(0.001, rng());
      const exp = -Math.log(u) * baseline;
      wealths.push(baseline * (1 - eq) + exp * eq);
    }
  }

  const positions = placeAgents(
    engine.width,
    engine.height,
    config.world.initialSettlement,
    count,
    rng,
    wealths,
  );

  const agents: Agent[] = [];
  for (let i = 0; i < count; i++) {
    const p = positions[i];
    if (!p) continue;
    // Uneven split — each agent starts rich in one, short on the other.
    const frac = 0.3 + rng() * 0.4;
    const sugar = Math.max(1, wealths[i] * frac);
    const spice = Math.max(1, wealths[i] * (1 - frac));
    const metabMean = physics.metabolism;
    // The chosen motivation seeds a trait centroid; the label is later
    // derived back from the jittered vector.
    const seedMotivation = pickMotivation();
    const traits = sampleTraits(seedMotivation, rng);
    agents.push({
      id: i,
      alive: true,
      x: p.x,
      y: p.y,
      prevX: p.x,
      prevY: p.y,
      sugar,
      spice,
      initialSugar: sugar,
      initialSpice: spice,
      age: 0,
      vision: Math.max(1, Math.round(sampleAttr(physics.vision))),
      sugarMetab: Math.max(0.1, sampleAttr(metabMean)),
      spiceMetab: Math.max(0.1, sampleAttr(metabMean)),
      maxAge: Math.max(10, Math.round(sampleAttr(physics.lifespan))),
      motivation: motivationFromTraits(traits),
      traits,
      sophistication: pickSophistication(),
      boldness: 0.5,
      lastHoldings: sugar + spice,
      shamedUntilTurn: 0,
      favouredPartners: [],
      goodCells: [],
      meanHarvest: 0,
    });
  }

  // Stagger ages so the cohort is demographically mixed from turn one.
  // Otherwise everyone hits fertility together and the pool dies at once.
  for (const a of agents) {
    a.age = Math.floor(rng() * a.maxAge * 0.6);
  }

  return agents;
}

function placeAgents(
  W: number,
  H: number,
  settlement: InitialSettlement,
  count: number,
  rng: () => number,
  wealths: number[],
): ({ x: number; y: number } | null)[] {
  const positions: ({ x: number; y: number } | null)[] = new Array(count).fill(
    null,
  );
  const occupied = new Set<number>();

  function tryPlace(slot: number, x: number, y: number): boolean {
    const ix = Math.max(0, Math.min(W - 1, Math.floor(x)));
    const iy = Math.max(0, Math.min(H - 1, Math.floor(y)));
    const key = iy * W + ix;
    if (occupied.has(key)) return false;
    occupied.add(key);
    positions[slot] = { x: ix, y: iy };
    return true;
  }

  function normal(): number {
    const u1 = Math.max(0.0001, rng());
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  if (settlement === "scattered") {
    for (let i = 0; i < count; i++) {
      let tries = 0;
      while (tries < 50 && !positions[i]) {
        tryPlace(i, rng() * W, rng() * H);
        tries++;
      }
    }
    return positions;
  }

  if (settlement === "single") {
    const cx = W / 2;
    const cy = H / 2;
    const sigma = Math.min(W, H) / 12;
    for (let i = 0; i < count; i++) {
      let tries = 0;
      while (tries < 80 && !positions[i]) {
        tryPlace(i, cx + normal() * sigma, cy + normal() * sigma);
        tries++;
      }
    }
    return positions;
  }

  if (settlement === "clustered") {
    const k = Math.min(5, Math.max(2, Math.floor(count / 100)));
    const centroids: { x: number; y: number }[] = [];
    for (let i = 0; i < k; i++) {
      centroids.push({
        x: 0.2 * W + rng() * 0.6 * W,
        y: 0.2 * H + rng() * 0.6 * H,
      });
    }
    const sigma = Math.min(W, H) / 10;
    for (let i = 0; i < count; i++) {
      let tries = 0;
      while (tries < 80 && !positions[i]) {
        const c = centroids[Math.floor(rng() * k)];
        tryPlace(i, c.x + normal() * sigma, c.y + normal() * sigma);
        tries++;
      }
    }
    return positions;
  }

  // segregated
  const order = Array.from({ length: count }, (_, i) => i);
  order.sort((a, b) => wealths[b] - wealths[a]);
  const quadrants = [
    { x0: 0, y0: 0, x1: W / 2, y1: H / 2 },
    { x0: W / 2, y0: 0, x1: W, y1: H / 2 },
    { x0: 0, y0: H / 2, x1: W / 2, y1: H },
    { x0: W / 2, y0: H / 2, x1: W, y1: H },
  ];
  const groupSize = Math.ceil(count / 4);
  for (let oi = 0; oi < order.length; oi++) {
    const origI = order[oi];
    const q = quadrants[Math.min(3, Math.floor(oi / groupSize))];
    let tries = 0;
    while (tries < 80 && !positions[origI]) {
      tryPlace(
        origI,
        q.x0 + rng() * (q.x1 - q.x0),
        q.y0 + rng() * (q.y1 - q.y0),
      );
      tries++;
    }
  }
  return positions;
}
