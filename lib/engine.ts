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
  village: 40,
  town: 70,
  city: 110,
};

const AGENT_COUNT: Record<Scale, number> = {
  village: 200,
  town: 800,
  city: 3000,
};

export interface Agent {
  id: number;
  alive: boolean;
  x: number;
  y: number;
  /** Position at the start of this tick, used for inter-frame interpolation. */
  prevX: number;
  prevY: number;
  /** Holdings of the two traded goods. */
  sugar: number;
  spice: number;
  age: number;
  vision: number;
  /** Per-good consumption each turn. Differing ratios are what drive trade. */
  sugarMetab: number;
  spiceMetab: number;
  maxAge: number;
  initialSugar: number;
  initialSpice: number;
  motivation: AgentMotivation;
  /** Decision rule governing movement (and, for social agents, imitation). */
  sophistication: AgentSophistication;
  /** Adaptive agents only: learned willingness to range far afield (0..1). */
  boldness: number;
  /** Adaptive agents only: holdings at the previous tick, to sense gain or loss. */
  lastHoldings: number;
}

/** Combined holdings — the scalar "wealth" used for Gini, tiers, and display. */
export function holdings(a: Agent): number {
  return a.sugar + a.spice;
}

/**
 * Marginal rate of substitution: how many units of sugar this agent will give
 * up for one unit of spice, given current holdings and per-good needs. An agent
 * rich in sugar and short on spice values spice highly (high MRS) and will buy
 * it; two agents with different MRS both gain by trading toward the middle.
 */
export function mrs(a: Agent): number {
  return (a.sugar / a.sugarMetab) / (a.spice / a.spiceMetab);
}

/** Cobb-Douglas welfare. Movement and trade both try to raise it. */
function welfare(sugar: number, spice: number, ms: number, msp: number): number {
  const mt = ms + msp;
  return Math.pow(sugar, ms / mt) * Math.pow(spice, msp / mt);
}

export const WEALTH_BIN_EDGES = [5, 10, 20, 40, 80] as const;
export const WEALTH_BIN_LABELS = ["<5", "5–10", "10–20", "20–40", "40–80", "80+"] as const;

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
}

export class Engine {
  readonly width: number;
  readonly height: number;
  /** Sugar landscape: carrying capacity and current stock per cell. */
  readonly maxCells: Float32Array;
  readonly cells: Float32Array;
  /** Spice landscape: the second good, spatially anti-correlated with sugar. */
  readonly maxSpice: Float32Array;
  readonly spice: Float32Array;
  readonly occupants: Int32Array;
  agents: Agent[];
  turn = 0;

  /** Trade telemetry for the most recent tick. */
  private lastTradePrice = 0;
  private lastTradeVolume = 0;

  private rng: () => number;
  private regrowthRate: number;
  private reproduction: boolean;
  private topology: InteractionTopology;

  constructor(config: SimulationConfig) {
    this.rng = mulberry32(config.seed || 1);
    this.regrowthRate = config.world.physics.regrowthRate;
    this.reproduction = config.world.reproduction;
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

    const requested = AGENT_COUNT[config.world.scale];
    const cap = Math.floor(total * 0.5);
    const count = Math.min(requested, cap);

    this.agents = spawnAgents(this, config, count);
    for (const a of this.agents) {
      this.occupants[a.y * this.width + a.x] = a.id;
    }
  }

  tick(): void {
    this.regrow(this.cells, this.maxCells);
    this.regrow(this.spice, this.maxSpice);

    const order: number[] = [];
    for (const a of this.agents) {
      if (a.alive) order.push(a.id);
    }
    shuffle(order, this.rng);

    // Phase 1: move toward the best cell and harvest both goods.
    for (const id of order) {
      const a = this.agents[id];
      if (!a.alive) continue;
      this.moveAndHarvest(a);
    }

    // Phase 2: trade with neighbours. A market — and a price — emerges here.
    this.tradePhase();

    // Phase 3: pay metabolism, age, and die (or leave an heir). Capture the
    // living set first so reproduction's newborns don't act this turn.
    const living: number[] = [];
    for (const a of this.agents) {
      if (a.alive) living.push(a.id);
    }
    for (const id of living) {
      const a = this.agents[id];
      if (!a.alive) continue;
      this.consume(a);
    }

    this.turn++;
  }

  private regrow(stock: Float32Array, max: Float32Array): void {
    for (let i = 0; i < stock.length; i++) {
      const m = max[i];
      if (m > 0) {
        const next = stock[i] + this.regrowthRate * m;
        stock[i] = next > m ? m : next;
      }
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
    a.sugar += this.cells[idx];
    a.spice += this.spice[idx];
    this.cells[idx] = 0;
    this.spice[idx] = 0;
  }

  /**
   * Pick the cell an agent moves to this tick. Sophistication selects the rule:
   * minimal agents optimise greedily over their whole field of view; bounded
   * agents satisfice over a shorter horizon; adaptive agents learn how far to
   * range based on whether ranging has been paying off; social agents follow
   * and imitate the wealthiest neighbour they can see.
   */
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

  /** The four on-axis cells exactly `d` steps from the agent. */
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

  /** Reactive optimiser: the best free cell within `vision`, ties broken nearer. */
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

  /**
   * Bounded rationality: look only half as far and take the first cell that is
   * clearly better than standing still, rather than scanning for the optimum.
   */
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

  /**
   * Adaptation: with probability `boldness` the agent ranges across its whole
   * field of view; otherwise it stays local. Boldness is reinforced each tick
   * in `consume` depending on whether holdings rose — agents learn whether
   * exploration pays off in the world they actually inhabit.
   */
  private adaptiveMove(a: Agent): { x: number; y: number } {
    const vision = this.rng() < a.boldness ? a.vision : 1;
    return this.greedyMove(a, vision);
  }

  /**
   * Social imitation: head toward the wealthiest neighbour in view and, now and
   * then, adopt their motivation — strategies spread through proximity. With no
   * richer neighbour to follow, the agent falls back to greedy optimisation.
   */
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

    // Gossip: occasionally take on the richer neighbour's motivation.
    const role = this.agents[exemplar].motivation;
    if (role !== a.motivation && this.rng() < 0.1) a.motivation = role;

    // Step one cell toward the exemplar, onto the best free cell in that line.
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
    // Total stuff on the cell. Trade later sorts out the sugar/spice imbalance;
    // movement just chases abundance, as before.
    const resources = this.cells[y * this.width + x] + this.spice[y * this.width + x];
    if (a.motivation === "material") return resources;

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
    const own = holdings(a);

    switch (a.motivation) {
      case "symbolic":
        return resources + avgWealth * 0.08;
      case "normative":
        return resources + count * 0.6;
      case "power":
        return count > 0 && own > avgWealth
          ? resources + count * 0.7
          : resources;
      default:
        return resources;
    }
  }

  /**
   * Every agent looks to its partners (chosen by the configured topology) and
   * trades spice for sugar whenever both sides come out ahead. The price paid
   * is the geometric mean of the two valuations — the local clearing rate.
   * Aggregated across the field, those rates are the emergent market price.
   */
  private tradePhase(): void {
    let logPriceSum = 0;
    let volume = 0;

    for (const a of this.agents) {
      if (!a.alive) continue;
      const partners = this.partnersFor(a);
      for (const bId of partners) {
        // Pair each unordered couple once.
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

  /** Candidate trading partners for one agent under the active topology. */
  private partnersFor(a: Agent): number[] {
    const out: number[] = [];
    if (this.topology === "random") {
      // Anyone may meet anyone: a few random draws from the field.
      for (let i = 0; i < 4; i++) {
        const j = Math.floor(this.rng() * this.agents.length);
        const other = this.agents[j];
        if (other && other.alive && other.id !== a.id) out.push(other.id);
      }
      return out;
    }
    // Spatial (adjacent only) and network (persistent neighbourhood within
    // vision) both read the grid; network simply reaches further.
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

  /**
   * Attempt a single spice-for-sugar exchange between two agents. Executes only
   * if both end up strictly better off (a Pareto improvement). Returns the price
   * paid (sugar per spice), or 0 if no trade happened.
   */
  private tryTrade(a: Agent, b: Agent): number {
    const mrsA = mrs(a);
    const mrsB = mrs(b);
    if (mrsA === mrsB) return 0;

    // The higher-MRS agent values spice more, so it buys spice and sells sugar.
    const buyer = mrsA > mrsB ? a : b;
    const seller = mrsA > mrsB ? b : a;

    // Local price: geometric mean of the two valuations (sugar per spice).
    const price = Math.sqrt(mrsA * mrsB);
    const spiceQty = 1;
    const sugarQty = price * spiceQty;

    // Feasibility: seller can spare the spice, buyer can spare the sugar.
    if (seller.spice <= spiceQty || buyer.sugar <= sugarQty) return 0;

    const buyerBefore = welfare(buyer.sugar, buyer.spice, buyer.sugarMetab, buyer.spiceMetab);
    const sellerBefore = welfare(seller.sugar, seller.spice, seller.sugarMetab, seller.spiceMetab);
    const buyerAfter = welfare(buyer.sugar - sugarQty, buyer.spice + spiceQty, buyer.sugarMetab, buyer.spiceMetab);
    const sellerAfter = welfare(seller.sugar + sugarQty, seller.spice - spiceQty, seller.sugarMetab, seller.spiceMetab);

    if (buyerAfter <= buyerBefore || sellerAfter <= sellerBefore) return 0;

    buyer.sugar -= sugarQty;
    buyer.spice += spiceQty;
    seller.sugar += sugarQty;
    seller.spice -= spiceQty;
    return price;
  }

  private killAgent(a: Agent): void {
    a.alive = false;
    this.occupants[a.y * this.width + a.x] = -1;

    if (!this.reproduction) return;

    const idx = this.findEmptyCell();
    if (idx < 0) return;

    const cx = idx % this.width;
    const cy = Math.floor(idx / this.width);
    const child: Agent = {
      id: this.agents.length,
      alive: true,
      x: cx,
      y: cy,
      prevX: cx,
      prevY: cy,
      sugar: a.initialSugar,
      spice: a.initialSpice,
      initialSugar: a.initialSugar,
      initialSpice: a.initialSpice,
      age: 0,
      vision: a.vision,
      sugarMetab: a.sugarMetab,
      spiceMetab: a.spiceMetab,
      maxAge: a.maxAge,
      motivation: a.motivation,
      sophistication: a.sophistication,
      boldness: 0.5,
      lastHoldings: a.initialSugar + a.initialSpice,
    };
    this.agents.push(child);
    this.occupants[idx] = child.id;
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
    for (const a of this.agents) {
      if (!a.alive) continue;
      alive++;
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
    }
    return {
      turn: this.turn,
      alive,
      totalWealth,
      gini: giniCoefficient(wealths),
      wealthBins,
      tradePrice: this.lastTradePrice,
      tradeVolume: this.lastTradeVolume,
    };
  }

  randomFloat(): number {
    return this.rng();
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

/**
 * Build the sugar and spice landscapes. The two goods are placed in different
 * parts of the world so that wherever an agent settles it tends to be rich in
 * one good and short of the other — the geographic precondition for trade.
 */
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
    // Sugar runs east–west, spice north–south: the two gradients cross.
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
    // Sugar at the core, spice in the periphery corners.
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

  // Weighted draw from a mix like { material: 1, power: 2 }, normalised on the
  // fly. Used for both motivation and sophistication so an agent's traits match
  // the proportions the operator set on the setup screen.
  const buildPicker = <K extends string>(
    weights: WeightedSelection<K>,
    fallback: K,
  ): (() => K) => {
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
  };

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
    // Split the endowment unevenly between the two goods so holdings differ
    // from the start — the other precondition for trade.
    const frac = 0.3 + rng() * 0.4;
    const sugar = Math.max(1, wealths[i] * frac);
    const spice = Math.max(1, wealths[i] * (1 - frac));
    const metabMean = physics.metabolism;
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
      motivation: pickMotivation(),
      sophistication: pickSophistication(),
      boldness: 0.5,
      lastHoldings: sugar + spice,
    });
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
