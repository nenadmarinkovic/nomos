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

/** Each trait ∈ [0,1]. All behaviour rules read from these. */
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
  /** Position at the start of this tick — used to interpolate the render. */
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
  /** Derived label — recomputed each tick from traits. Not the source of truth. */
  motivation: AgentMotivation;
  traits: AgentTraits;
  sophistication: AgentSophistication;
  /** Adaptive agents: learned willingness to range far (0..1). */
  boldness: number;
  /** Adaptive agents: last tick's holdings, to detect gain or loss. */
  lastHoldings: number;
  /** Turn after which others may trade with this agent again. */
  shamedUntilTurn: number;
}

/** Seed positions for each named motivation. New agents are drawn around one
 *  of these with jitter; the label is then derived back from the trait vector. */
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

/** Small random walk around a starting point. Used at birth so children
 *  inherit parents but don't clone them. */
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

/** Move `traits` a fraction `rate` of the way toward `target`. */
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

// All rule helpers below take an agent's traits and return a behaviour
// number. They are the only place sociological intuitions are encoded.

/** Greedy agents harvest more; dominant agents harvest less (they
 *  specialise in seizure, not gathering). */
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

/** Return the named motivation whose centroid is closest to `t`. The
 *  label is *derived*, not configured — it's a description, not an input. */
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

/** Per-tick chance this agent tries to seize from a neighbour. Squaring
 *  dominance makes borderline-dominant agents rarely attack. */
function attackPropensity(t: AgentTraits): number {
  const ATTEMPT_RATE = 0.18;
  return ATTEMPT_RATE * t.dominance * t.dominance * (1 - t.prosociality);
}

/** A nearby agent above this prosociality witnesses coercion and shames
 *  the attacker. */
const WITNESS_PROSOCIALITY_THRESHOLD = 0.65;

/** Chance this agent refuses to trade with a shamed partner. Below
 *  prosociality 0.4 they don't care; above 0.8 they always refuse. */
function refuseShamedProbability(t: AgentTraits): number {
  const p = t.prosociality;
  return p < 0.4 ? 0 : Math.min(1, (p - 0.4) / 0.4);
}

/** Bonus rate on a trade. Geometric: a defector partner kills the bonus
 *  even if the other side is highly prosocial. */
function cooperativeBonus(a: AgentTraits, b: AgentTraits): number {
  return 0.1 * Math.min(a.prosociality, b.prosociality);
}

/** Chance an agent looks for a richer neighbour to imitate this tick. */
function imitationPropensity(t: AgentTraits): number {
  const BASE = 0.03;
  return BASE * t.statusSeeking;
}

/** Soft denominator giving fresh issuers a baseline trustworthiness.
 *  Tuned up after the bench showed `wealth / (liability + 1)` collapsed
 *  too fast after the first issuance — tokens reached one holder and
 *  then never circulated to a third. */
const TOKEN_PRIOR_LIABILITY = 4;

/** Probability the seller accepts a token. The 0.08 floor is the
 *  bootstrap term — without it, third-party sellers with no personal
 *  tie to the issuer almost always refused, and tokens never crossed
 *  the threshold from bilateral credit into circulating money. */
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

/** Score a cell for movement. Greed values raw resources; prosocial
 *  agents seek company; dominant agents want crowds they can dominate;
 *  status-seekers chase wealthy neighbours. */
function scoreCellByTraits(
  t: AgentTraits,
  resources: number,
  neighbourCount: number,
  neighbourAvgWealth: number,
  ownWealth: number,
): number {
  const resourceWeight = 0.6 + 0.5 * t.greed;
  const proximityWeight = 0.6 * t.prosociality;
  const predatoryWeight =
    ownWealth > neighbourAvgWealth ? 0.8 * t.dominance : 0;
  const statusWeight = 0.1 * t.statusSeeking;
  return (
    resources * resourceWeight +
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

// Tie weight bumps by INCREMENT per successful trade, decays per tick,
// drops below THRESHOLD, and never exceeds CAP.
const TIE_INCREMENT = 1;
const TIE_DECAY = 0.97;
const TIE_THRESHOLD = 0.25;
const TIE_CAP = 8;

// Substrate cellular-automaton step (only when substrateDiffusion is on).
// STOCK_DIFFUSION: share of the gap to each neighbour that standing
// resources flow across per tick — must stay < 0.25 for stability with
// four neighbours. FERTILITY_SPREAD: how fast a cell's fertility (its
// max ÷ pristine ceiling) relaxes toward its neighbours' — the rate at
// which exhaustion spreads and fertile land reseeds the worn ground.
const STOCK_DIFFUSION = 0.12;
const FERTILITY_SPREAD = 0.05;

export interface EngineSnapshot {
  turn: number;
  alive: number;
  gini: number;
  totalWealth: number;
  wealthBins: number[];
  /** Geometric-mean exchange rate (sugar per spice) of trades this turn, or 0 if none. */
  tradePrice: number;
  /** Number of trades executed this turn. */
  tradeVolume: number;
  /** Per-motivation alive count, in the canonical motivation order. */
  motivationCounts: {
    material: number;
    symbolic: number;
    normative: number;
    power: number;
  };
  /** Spatial assortativity of motivation, 0..1. 0 = neighbours are a random
   *  draw of the population; 1 = every agent sits only beside its own kind. */
  segregation: number;
  /** Successful seizures this turn. */
  coercionCount: number;
  /** Coercions a prosocial witness sanctioned this turn. */
  shamingCount: number;
  tieCount: number;
  /** Share (0..1) of living agents with no surviving trade tie. */
  isolateShare: number;
  blightActive: boolean;
  /** Turn the most recent blight began, or -9999 if none yet. */
  blightStartedTurn: number;
  /** Deaths from plague *this turn* (0 otherwise). */
  plagueDeathsThisTurn: number;
  /** 0..1 — how much carrying capacity the landscape has lost vs pristine. */
  landDegradation: number;
  /** Total tokens currently held across all agents. */
  tokenSupply: number;
  /** Trades paid in tokens this tick. */
  tokenTradeVolume: number;
  /** Agent with the largest current liability — closest thing to a bank.
   *  -1 if no tokens are in circulation. */
  topIssuerId: number;
  topIssuerLiability: number;
  /** Issuers whose tokens are held by ≥3 distinct agents — these are the
   *  ones whose IOUs have begun to *circulate*, i.e. emergent money. */
  circulatingIssuers: number;
}

export class Engine {
  readonly width: number;
  readonly height: number;
  /** Mutable: cells lose capacity on harvest, recover when fallow. */
  maxCells: Float32Array;
  readonly cells: Float32Array;
  maxSpice: Float32Array;
  readonly spice: Float32Array;
  readonly occupants: Int32Array;
  /** Pristine ceiling for each cell — what `maxCells`/`maxSpice` recover
   *  toward but never exceed. */
  private originalMaxCells: Float32Array;
  private originalMaxSpice: Float32Array;
  private pristineLandTotal: number;
  /** Reusable write buffer for the synchronous substrate CA step. */
  private diffScratch: Float32Array;
  agents: Agent[];
  turn = 0;

  private lastTradePrice = 0;
  private lastTradeVolume = 0;
  private lastCoercionCount = 0;
  private lastShamingCount = 0;

  /** Blight halves regrowth while active; plague kills a random share in
   *  one tick. Both triggers depend on the world's own state — see
   *  `rollShocks`. */
  private blightUntilTurn = 0;
  private lastBlightTurn = -9999;
  private lastPlagueTurn = -9999;
  private lastPlagueDeaths = 0;

  /** Sparse: outer key = lower agent id, inner = higher. */
  private tiesMap = new Map<number, Map<number, number>>();

  // Token economy. tokenHoldings[holder][issuer] = qty held.
  // tokenLiability[issuer] = total outstanding (sum over holders).
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
  /** Soft ceiling — birth rate scales down as population approaches it. */
  private populationCap: number;
  /** Used at birth: rare mutations resample the child's trait centroid
   *  from the configured motivation mix. */
  private mutationMotivation: () => AgentMotivation;

  constructor(config: SimulationConfig) {
    this.rng = mulberry32(config.seed || 1);
    this.regrowthRate = config.world.physics.regrowthRate;
    this.reproduction = config.world.reproduction;
    // Legacy configs predate these toggles — default them on.
    this.culturalTransmission = config.world.culturalTransmission ?? true;
    this.inheritance = config.world.inheritance ?? true;
    this.conflict = config.world.conflict ?? true;
    // Unlike the social toggles above, this one defaults *off* for legacy
    // configs: it alters substrate physics, so a run saved before the
    // feature existed must replay exactly as it was recorded.
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

    // Combat runs before trade so any seizures price into the market.
    this.combatPhase();
    this.tradePhase();
    this.decayTies();
    // Cultural drift runs after trade so wealth comparisons use post-trade
    // holdings, not stale ones.
    this.culturalPhase();

    // Snapshot the living set so this tick's newborns can't act yet.
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

    this.turn++;
  }

  /** Recompute every agent's motivation label from their current traits. */
  private refreshMotivationLabels(): void {
    for (const a of this.agents) {
      if (!a.alive) continue;
      a.motivation = motivationFromTraits(a.traits);
    }
  }

  /** Every agent rolls against `attackPropensity`. Targets are visibly
   *  poorer neighbours that aren't trade partners and aren't peers in
   *  dominance (so high-dominance agents skip each other). */
  private combatPhase(): void {
    if (!this.conflict) return;

    const MIN_GAP = 4;
    const TAKE_FRACTION = 0.3;
    // Targets whose dominance is ≥ PEER_RATIO × attacker's are treated
    // as peers and skipped — prevents the dynamic collapsing into a
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
          // Trade partners are off-limits — embedded relationships shield
          // against predation.
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
      // Trust between these two is destroyed by the seizure.
      this.crashTie(a.id, bestTarget.id);

      // A nearby prosocial witness shames the attacker for SHAME_TURNS;
      // others may then refuse to trade with them.
      const SHAME_TURNS = 15;
      const SHAME_VISION = 3;
      let witnessed = false;
      for (let dy = -SHAME_VISION; dy <= SHAME_VISION && !witnessed; dy++) {
        const ny = bestTarget.y + dy;
        if (ny < 0 || ny >= this.height) continue;
        for (let dx = -SHAME_VISION; dx <= SHAME_VISION && !witnessed; dx++) {
          const nx = bestTarget.x + dx;
          if (nx < 0 || nx >= this.width) continue;
          const occ = this.occupants[ny * this.width + nx];
          if (occ === -1 || occ === a.id) continue;
          const w = this.agents[occ];
          if (
            w?.alive &&
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

  /** Agents drift toward the traits of a wealthier visible neighbour, at
   *  a speed scaled by `statusSeeking`. Each step costs wealth in
   *  proportion to how far the traits moved — identity change isn't free. */
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
      // Wealth cost proportional to trait-space distance travelled.
      // Without this, subcultures never stabilise — anyone flips toward
      // whoever happens to be rich today.
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
    }
  }

  /** Birth probability per agent scales with wealth, age, and a soft
   *  brake as population approaches the cap. */
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

      // Triangular bell: peak fertility at mid-life, zero at the extremes.
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

  /** Place a child near the parent. Inherits the parent's traits with
   *  small drift; rare mutations resample from the configured mix. */
  private bear(parent: Agent): void {
    let idx = this.findEmptyCellNear(parent.x, parent.y, parent.vision);
    if (idx < 0) idx = this.findEmptyCell();
    if (idx < 0) return;
    const cx = idx % this.width;
    const cy = Math.floor(idx / this.width);

    const MUTATION_RATE = 0.04;
    const inheritSeed = this.rng() >= MUTATION_RATE;
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
    // Seasonal swing — regrowth between ~30% and ~170% of base over 60 turns.
    const SEASON_PERIOD = 60;
    const SEASON_AMPLITUDE = 0.7;
    const seasonal =
      1 + SEASON_AMPLITUDE * Math.sin((this.turn * 2 * Math.PI) / SEASON_PERIOD);
    const blightActive = isSugar && this.turn < this.blightUntilTurn;
    const blightFactor = blightActive ? 0.4 : 1;
    const rate = this.regrowthRate * seasonal * blightFactor;
    // Fallow (un-occupied) cells slowly recover their carrying capacity.
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

  /** One synchronous cellular-automaton step over the substrate. Standing
   *  resources diffuse to the four orthogonal neighbours (rich cells bleed
   *  into exhausted ones), and each cell's fertility relaxes toward its
   *  neighbours' — so worn ground spreads like desertification and fertile
   *  land slowly reseeds the depleted cells beside it. Every cell is
   *  computed from the *old* grid and written to a scratch buffer before
   *  being committed, so the update is a true CA, not a sequential sweep.
   *  No RNG is consumed, so the diffusion never shifts the agent stream. */
  private diffuseSubstrate(): void {
    this.diffuseStock(this.cells);
    this.diffuseStock(this.spice);
    this.spreadFertility(this.maxCells, this.originalMaxCells);
    this.spreadFertility(this.maxSpice, this.originalMaxSpice);
  }

  /** Conservative diffusion of a standing-resource grid. Reflecting (no-flux)
   *  boundaries — edge cells simply have fewer neighbours — so total stock is
   *  preserved exactly. */
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

  /** Relax each cell's fertility — its current ceiling as a fraction of its
   *  pristine ceiling — toward the mean of its fertile neighbours'. Working
   *  in fraction space keeps the landscape's underlying shape intact (a peak
   *  stays a peak): only *depletion* spreads and heals, never the base relief.
   *  Naturally barren cells (no pristine capacity) take no part. */
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

  /** Blight risk grows with land degradation; plague risk grows with
   *  density. Both depend on what the society has done, not on dice. */
  private rollShocks(): void {
    // Quiet during the first 100 turns so the society can establish.
    if (this.turn < 100) return;
    if (this.turn < this.blightUntilTurn) return;
    if (this.turn - this.lastPlagueTurn < 60) return;

    let currentLandTotal = 0;
    for (let i = 0; i < this.maxCells.length; i++) {
      currentLandTotal += this.maxCells[i] + this.maxSpice[i];
    }
    const landRatio =
      this.pristineLandTotal > 0
        ? currentLandTotal / this.pristineLandTotal
        : 1;
    const degradation = Math.max(0, 1 - landRatio);
    const BLIGHT_BASE = 0.0005;
    // Squared so mild degradation is almost harmless and severe is fatal.
    const blightRate = BLIGHT_BASE + 0.02 * Math.pow(degradation, 2);

    let alive = 0;
    for (const ag of this.agents) if (ag.alive) alive++;
    const density = alive / (this.width * this.height);
    const DENSITY_THRESHOLD = 0.25;
    const overcrowding = Math.max(0, density - DENSITY_THRESHOLD);
    const PLAGUE_BASE = 0.0002;
    const plagueRate = PLAGUE_BASE + 0.04 * overcrowding;

    const r = this.rng();
    if (r < blightRate) {
      this.blightUntilTurn = this.turn + 25;
      this.lastBlightTurn = this.turn;
    } else if (r < blightRate + plagueRate) {
      const PLAGUE_SHARE = 0.05;
      this.lastPlagueDeaths = 0;
      for (const ag of this.agents) {
        if (!ag.alive) continue;
        if (this.rng() < PLAGUE_SHARE) {
          this.killAgent(ag);
          this.lastPlagueDeaths++;
        }
      }
      this.lastPlagueTurn = this.turn;
    }
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
    this.cells[idx] = 0;
    this.spice[idx] = 0;
    // Each harvest nibbles a small fraction off the cell's carrying capacity.
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

  /** Movement rule depends on the agent's sophistication: greedy =
   *  optimise over full vision; bounded = satisfice in a shorter horizon;
   *  adaptive = vision depends on learned boldness; social = follow the
   *  wealthiest neighbour. */
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

  /** With probability `boldness` use full vision; otherwise just look 1
   *  cell. Boldness is updated in `consume` based on whether holdings rose. */
  private adaptiveMove(a: Agent): { x: number; y: number } {
    const vision = this.rng() < a.boldness ? a.vision : 1;
    return this.greedyMove(a, vision);
  }

  /** Move one step toward the wealthiest visible neighbour; occasionally
   *  copy their motivation. Falls back to greedy if nobody is richer. */
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
    const resources =
      this.cells[y * this.width + x] + this.spice[y * this.width + x];

    // Fast path: pure-greed agents ignore neighbours, so skip the scan.
    const t = a.traits;
    if (
      t.prosociality < 0.05 &&
      t.dominance < 0.05 &&
      t.statusSeeking < 0.05
    ) {
      return resources * (0.6 + 0.5 * t.greed);
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
    return scoreCellByTraits(t, resources, count, avgWealth, holdings(a));
  }

  /** Every agent meets partners (chosen by the configured topology) and
   *  trades spice for sugar whenever both come out ahead. The aggregate
   *  of pairwise clearing prices is the emergent market price. */
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
      // Random meetings: a few draws from the whole field.
      for (let i = 0; i < 4; i++) {
        const j = Math.floor(this.rng() * this.agents.length);
        const other = this.agents[j];
        if (other && other.alive && other.id !== a.id) out.push(other.id);
      }
      return out;
    }
    // Spatial = adjacent; network = within vision (further reach).
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
    return out;
  }

  /** One spice-for-sugar exchange. Executes only if both sides end up
   *  strictly better off. Returns the price (sugar per spice), or 0. */
  private tryTrade(a: Agent, b: Agent): number {
    // A shamed partner: each party rolls their refuse-shamed probability.
    if (b.shamedUntilTurn > this.turn) {
      if (this.rng() < refuseShamedProbability(a.traits)) return 0;
    }
    if (a.shamedUntilTurn > this.turn) {
      if (this.rng() < refuseShamedProbability(b.traits)) return 0;
    }

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

    // Pick a payment mode. Tokens get *first* try whenever the buyer
    // already holds third-party IOUs (use-them-or-lose-them: an issuer
    // can default at any tick), and as a fallback when the buyer can't
    // cover in sugar. The chosen plan's acceptance roll commits here
    // but the actual token movement waits for the welfare check.
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
        // Provisional take: the welfare check below decides. If the
        // discounted value fails Pareto, we fall through to a normal
        // sugar trade (when buyer can afford it).
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

    // Cooperative dividend — scales with the pair's min prosociality and
    // with their existing trust.
    const trust = this.getTie(a.id, b.id);
    const trustBonus = (Math.min(trust, TIE_CAP) / TIE_CAP) * 0.05;
    const bonus = cooperativeBonus(a.traits, b.traits) + trustBonus;
    if (bonus > 0) {
      buyer.spice += spiceQty * bonus;
      seller.sugar += sugarQty * bonus;
    }

    this.bumpTie(a.id, b.id);
    return price;
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

  /** Tie weight between two agents (0 if none). Doubles as a trust score. */
  private getTie(idA: number, idB: number): number {
    const lo = idA < idB ? idA : idB;
    const hi = idA < idB ? idB : idA;
    return this.tiesMap.get(lo)?.get(hi) ?? 0;
  }

  /** Erase the dyad's tie — used when coercion destroys trust. */
  private crashTie(idA: number, idB: number): void {
    const lo = idA < idB ? idA : idB;
    const hi = idA < idB ? idB : idA;
    const row = this.tiesMap.get(lo);
    if (!row) return;
    row.delete(hi);
    if (row.size === 0) this.tiesMap.delete(lo);
  }

  /** Credit `qty` of `issuer`'s tokens to `holder` and grow the issuer's
   *  outstanding liability. */
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

  /** Debit `qty` of `issuer`'s tokens from `holder`. `retire` drops the
   *  liability too — pass `false` when this is part of a transfer, since
   *  the new holder will re-add it. */
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

  /** 0..1 — collateral ratio (wealth ÷ liability) discounted by death risk. */
  private trustworthiness(issuer: Agent): number {
    if (!issuer.alive) return 0;
    const wealth = issuer.sugar + issuer.spice;
    const liability = this.tokenLiability.get(issuer.id) ?? 0;
    const collateral = wealth / (liability + TOKEN_PRIOR_LIABILITY);
    const survival = issuer.maxAge > 0 ? 1 - Math.pow(issuer.age / issuer.maxAge, 4) : 0.5;
    return Math.max(0, Math.min(1, collateral)) * Math.max(0, survival);
  }

  /** Pick a token plan the seller will accept. Returns null if every
   *  option was refused. Preferred order: spend tokens already held;
   *  print a fresh IOU only as last resort. The acceptance roll is
   *  consumed here so the caller can preview welfare safely. */
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
      const acceptProb = tokenAcceptanceProb(
        seller.traits,
        trust,
        opt.trustworthiness,
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

  private killAgent(a: Agent): void {
    // Bequeath holdings to trade-tie partners so wealth doesn't vanish
    // every time a hoarder dies.
    if (this.inheritance) {
      this.bequeathToTies(a);
    }
    a.alive = false;
    this.occupants[a.y * this.width + a.x] = -1;
    this.scrubTies(a.id);
    this.dishonourTokens(a.id);
  }

  /** All tokens this agent issued become worthless. Holders lose them. */
  private dishonourTokens(deadId: number): void {
    const outstanding = this.tokenLiability.get(deadId);
    if (outstanding === undefined) return;
    for (const [holderId, row] of this.tokenHoldings) {
      const held = row.get(deadId);
      if (held === undefined) continue;
      row.delete(deadId);
      if (row.size === 0) this.tokenHoldings.delete(holderId);
    }
    this.tokenLiability.delete(deadId);
    this.tokenDefaultedLifetime.set(
      deadId,
      (this.tokenDefaultedLifetime.get(deadId) ?? 0) + outstanding,
    );
  }

  /** Split the dying agent's wealth among its living tie partners,
   *  weighted by tie strength. Only the *positive* part of each good is
   *  bequeathed: a starved agent dies because one good ran below zero, and
   *  that debt is not a thing heirs can inherit — passing it on would push
   *  living agents negative, which then poisons `mrs`/price with NaNs. */
  private bequeathToTies(a: Agent): void {
    const sugar = a.sugar > 0 ? a.sugar : 0;
    const spice = a.spice > 0 ? a.spice : 0;
    if (sugar + spice <= 0) return;

    // Ties are stored once per (lo, hi) pair, so look in both directions.
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
        this.turn === this.lastPlagueTurn ? this.lastPlagueDeaths : 0,
      landDegradation: this.computeLandDegradation(),
      ...this.tokenSnapshot(),
    };
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
    // ≥3 distinct holders = the issuer's tokens have started to circulate.
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

  randomFloat(): number {
    return this.rng();
  }

  /** Flat [idA, idB, weight, …] view of the trade-tie map. */
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

/** Spatial sorting of motivation, 0..1. 0 = neighbours are a random draw
 *  of the population; 1 = agents sit only beside their own kind.
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

/** Lay down sugar and spice on the grid. The two goods peak in different
 *  places so settling anywhere means you're rich in one and short on the
 *  other — that's what makes trade worth doing. */
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
    // Uneven split so each agent starts rich in one good and short on the
    // other — the precondition for trade.
    const frac = 0.3 + rng() * 0.4;
    const sugar = Math.max(1, wealths[i] * frac);
    const spice = Math.max(1, wealths[i] * (1 - frac));
    const metabMean = physics.metabolism;
    // Configured motivation seeds the trait centroid; the displayed label
    // is then derived from the jittered trait vector.
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
    });
  }

  // Stagger ages so the cohort is demographically mixed from turn one —
  // otherwise everyone reaches fertility together and the breeding pool
  // is mostly dead by then.
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
