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
  /** Turn until which Normative agents refuse to trade with this agent.
   *  Set when a coercive act lands within sight of a Normative — the
   *  community sanction is real, not just a tag. */
  shamedUntilTurn: number;
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

/** Sugar harvest multiplier per motivation. Material agents are the
 *  productive subject (Marx); Symbolic agents care for luxury goods and
 *  collect food poorly; Normatives gather at base rate; Power agents harvest
 *  badly but supplement through coercion (`combatPhase`). */
function sugarYieldFactor(m: AgentMotivation): number {
  switch (m) {
    case "material":
      return 1.3;
    case "symbolic":
      return 0.9;
    case "normative":
      return 1.0;
    case "power":
      return 0.6;
  }
}

/** Spice harvest multiplier per motivation. Symbolic agents are the
 *  luxury-good specialists; otherwise mostly the inverse of sugar. */
function spiceYieldFactor(m: AgentMotivation): number {
  switch (m) {
    case "material":
      return 0.9;
    case "symbolic":
      return 1.3;
    case "normative":
      return 1.0;
    case "power":
      return 0.6;
  }
}

export const WEALTH_BIN_EDGES = [5, 10, 20, 40, 80] as const;
export const WEALTH_BIN_LABELS = ["<5", "5–10", "10–20", "20–40", "40–80", "80+"] as const;

/** Trade-tie dynamics. A successful trade adds INCREMENT to the dyad's weight;
 * each tick every weight is multiplied by DECAY; weights below THRESHOLD are
 * dropped. CAP prevents a single pair from dominating the layout visually. */
const TIE_INCREMENT = 1;
const TIE_DECAY = 0.97;
const TIE_THRESHOLD = 0.25;
const TIE_CAP = 8;

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

  /** Sparse dyadic trade-tie weights. Outer key = lower agent id, inner key =
   * higher id. Decays each tick; bumps on each successful trade. */
  private tiesMap = new Map<number, Map<number, number>>();

  private rng: () => number;
  private regrowthRate: number;
  private reproduction: boolean;
  private culturalTransmission: boolean;
  private inheritance: boolean;
  private conflict: boolean;
  private topology: InteractionTopology;
  /** Carrying capacity — the starting agent count. Births stop once the
   *  living population reaches this; deaths free up the budget so births
   *  can fire again. Keeps the simulation performant (no 12 000-agent
   *  runaway at city scale) and gives demographic dynamics in a bounded
   *  envelope. */
  private populationCap: number;
  /** Mutation picker over the *original* configured motivation mix. Used at
   *  birth to occasionally hand a child a different motivation than the
   *  parent's — keeps rare motivations from going permanently extinct. */
  private mutationMotivation: () => AgentMotivation;

  constructor(config: SimulationConfig) {
    this.rng = mulberry32(config.seed || 1);
    this.regrowthRate = config.world.physics.regrowthRate;
    this.reproduction = config.world.reproduction;
    // Default the v0.5 toggles to `true` when reading legacy configs (saved
    // runs from before these fields existed): the new dynamics are part of
    // the engine's intended behaviour, not opt-in.
    this.culturalTransmission = config.world.culturalTransmission ?? true;
    this.inheritance = config.world.inheritance ?? true;
    this.conflict = config.world.conflict ?? true;
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
    this.populationCap = count;

    // Sampler over the original motivation mix, used for birth mutations.
    // Built off the same RNG as everything else so the run stays deterministic.
    this.mutationMotivation = buildWeightedPicker(
      config.agents.motivation,
      "material",
      this.rng,
    );

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

    // Phase 2a: power agents may take from weaker neighbours — the engine
    // expression of domination. Runs before trade so a successful coercion
    // shifts the wealth landscape the market then prices in.
    this.combatPhase();

    // Phase 2b: trade with neighbours. A market — and a price — emerges here.
    this.tradePhase();
    this.decayTies();

    // Phase 2c: cultural transmission — agents occasionally adopt the
    // motivation of a wealthier neighbour (Bourdieusian imitation up the
    // ladder). Runs after trade so the wealth that drives the imitation is
    // the current market-clearing wealth.
    this.culturalPhase();

    // Phase 3: pay metabolism, age, and die. Capture the living set first so
    // any newborns from phase 4 don't act this turn.
    const living: number[] = [];
    for (const a of this.agents) {
      if (a.alive) living.push(a.id);
    }
    for (const id of living) {
      const a = this.agents[id];
      if (!a.alive) continue;
      this.consume(a);
    }

    // Phase 4: fertile agents may reproduce. Births are decoupled from deaths
    // — they happen when an agent is wealthy and in a fertile age range, not
    // because somebody else died. Population genuinely fluctuates.
    this.reproductionPhase(living);

    this.turn++;
  }

  /** Combat phase — power-motivated agents may take a share of a weaker
   *  neighbour's holdings. The engine expression of Weberian domination.
   *
   *  Rules: a power agent acts at most once per tick (small RNG gate), looks
   *  within its vision for the wealthiest non-power neighbour whose total
   *  wealth is well below the attacker's, and if it finds one, transfers a
   *  fixed fraction of the victim's holdings to itself. Power doesn't attack
   *  other power agents — keeps the dynamic from collapsing into a
   *  free-for-all. */
  private combatPhase(): void {
    if (!this.conflict) return;

    /** Per-tick probability a power agent attempts to dominate. Kept low so
     *  combat is an occasional shock, not a constant grind. */
    const ATTEMPT_RATE = 0.06;
    /** Wealth gap required before an attack is considered worth attempting.
     *  Prevents broke power agents from picking on similarly-broke targets. */
    const MIN_GAP = 4;
    /** Share of the victim's holdings the attacker seizes. */
    const TAKE_FRACTION = 0.3;

    for (const a of this.agents) {
      if (!a.alive || a.motivation !== "power") continue;
      if (this.rng() >= ATTEMPT_RATE) continue;

      const myWealth = a.sugar + a.spice;
      if (myWealth <= 1) continue;

      let bestTarget: Agent | null = null;
      let bestGap = MIN_GAP;
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
          if (!t.alive || t.motivation === "power") continue;
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

      // Norm enforcement. If any Normative agent witnessed the act from
      // within their vision of the victim, the attacker is marked shamed
      // — Normative agents will refuse to trade with them for SHAME_TURNS.
      // This is Durkheim's social fact made mechanical: coercion has a
      // social cost beyond the immediate retaliation.
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
          if (w?.alive && w.motivation === "normative") {
            witnessed = true;
          }
        }
      }
      if (witnessed) {
        a.shamedUntilTurn = this.turn + SHAME_TURNS;
      }
    }
  }

  /** Cultural transmission — agents occasionally adopt the motivation of a
   *  wealthier neighbour. The dynamic captures Bourdieusian habitus
   *  reproduction by imitation up the social ladder and Schelling-style
   *  preference cascades from interaction.
   *
   *  Each tick, every agent has a small chance of looking around. If the
   *  wealthiest agent within vision is *richer* and holds a different
   *  motivation, our agent flips to that motivation. Net effect over the
   *  run: motivations spread horizontally, not only descend through
   *  birth — and a dominant strain can colonise a neighbourhood through
   *  example alone. */
  private culturalPhase(): void {
    if (!this.culturalTransmission) return;

    /** Per-tick probability an agent considers adopting a neighbour. */
    const ADOPTION_RATE = 0.01;

    for (const a of this.agents) {
      if (!a.alive) continue;
      if (this.rng() >= ADOPTION_RATE) continue;

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
          if (!n.alive || n.motivation === a.motivation) continue;
          const w = n.sugar + n.spice;
          if (w > bestWealth) {
            bestWealth = w;
            bestNeighbour = n;
          }
        }
      }

      if (bestNeighbour) {
        a.motivation = bestNeighbour.motivation;
      }
    }
  }

  /** Per-tick birth dynamics. Each living agent's odds of reproducing this
   *  tick scale with wealth (richer agents reproduce more) and age (a bell
   *  curve peaking mid-life, zero in childhood and at the edge of death).
   *  A spawned child takes the parent's traits and is placed near them. */
  private reproductionPhase(livingIds: number[]): void {
    if (!this.reproduction) return;

    // Cap births at the starting population. While alive < cap, births can
    // fire; once alive == cap, they stop until a death frees up the slot.
    // Visible demographic dynamics (line dips and recovers) without runaway.
    if (livingIds.length >= this.populationCap) return;
    let budget = this.populationCap - livingIds.length;

    // Count alive motivations once — bear() uses this to bias mutation
    // toward any extinct motivation so diversity can recover.
    const motivationCounts: Record<AgentMotivation, number> = {
      material: 0,
      symbolic: 0,
      normative: 0,
      power: 0,
    };
    for (const id of livingIds) {
      const a = this.agents[id];
      if (a.alive) motivationCounts[a.motivation]++;
    }

    /** Base per-tick probability at peak fertility and full wealth factor.
     *  Generous so the population recovers quickly toward the cap after
     *  famine; the cap above is what stops overshoot. */
    const BASE_RATE = 0.04;

    for (const id of livingIds) {
      if (budget <= 0) break;
      const a = this.agents[id];
      if (!a.alive) continue;

      // Triangular bell over normalised age: peak at 0.5, zero at <0.15
      // or >0.85. Agents are infertile when very young or very old.
      const ageNorm = a.maxAge > 0 ? a.age / a.maxAge : 0.5;
      const ageFactor = Math.max(0, 1 - Math.abs(ageNorm - 0.5) * 2.5);
      if (ageFactor <= 0) continue;

      // Saturating wealth factor: 0 when broke, ~1 at modest holdings,
      // capped at 2 so a single hoarder can't dominate births.
      const wealth = a.sugar + a.spice;
      const wealthFactor = Math.min(2, wealth / 20);
      if (wealthFactor <= 0) continue;

      const p = BASE_RATE * ageFactor * wealthFactor;
      if (this.rng() >= p) continue;

      this.bear(a, motivationCounts);
      budget--;
    }
  }

  /** Place a child of `parent` on a free cell — preferably near the parent,
   *  falling back to anywhere on the grid if the neighbourhood is full.
   *
   *  Motivation inheritance is mostly parental, with a small mutation rate
   *  drawing from the original mix — and an *extinction guard* on top: if
   *  any motivation has zero living agents in the population this tick,
   *  every mutation forces a draw from those extinct strains so diversity
   *  always has a path back. */
  private bear(
    parent: Agent,
    motivationCounts: Record<AgentMotivation, number>,
  ): void {
    let idx = this.findEmptyCellNear(parent.x, parent.y, parent.vision);
    if (idx < 0) idx = this.findEmptyCell();
    if (idx < 0) return;
    const cx = idx % this.width;
    const cy = Math.floor(idx / this.width);

    const MUTATION_RATE = 0.04;
    let motivation = parent.motivation;
    if (this.rng() < MUTATION_RATE) {
      // Extinction guard — if any strain is gone, revive one of them.
      const extinct = (
        Object.keys(motivationCounts) as AgentMotivation[]
      ).filter((k) => motivationCounts[k] === 0);
      if (extinct.length > 0) {
        motivation =
          extinct[Math.floor(this.rng() * extinct.length)];
      } else {
        motivation = this.mutationMotivation();
      }
    }
    // Keep the live counts current so subsequent births in the same tick
    // see this newborn and don't double-revive the same strain.
    motivationCounts[motivation]++;

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
      motivation,
      sophistication: parent.sophistication,
      boldness: 0.5,
      lastHoldings: parent.initialSugar + parent.initialSpice,
      shamedUntilTurn: 0,
    };
    this.agents.push(child);
    this.occupants[idx] = child.id;
  }

  /** Sample an empty cell within `radius` of (cx, cy). Returns the grid
   *  index, or -1 if no free neighbour was found after a bounded search. */
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

  private regrow(stock: Float32Array, max: Float32Array): void {
    // Slow seasonal cycle modulates regrowth between ~60 % and ~140 % of the
    // base rate over an 80-turn period. The substrate breathes — booms and
    // famines become inevitable, not just the consequence of internal
    // economic shocks. Turchin's secular cycles get a substrate to ride on.
    const SEASON_PERIOD = 80;
    const SEASON_AMPLITUDE = 0.4;
    const seasonal =
      1 + SEASON_AMPLITUDE * Math.sin((this.turn * 2 * Math.PI) / SEASON_PERIOD);
    const rate = this.regrowthRate * seasonal;
    for (let i = 0; i < stock.length; i++) {
      const m = max[i];
      if (m > 0) {
        const next = stock[i] + rate * m;
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
    // Specialisation by motivation. Different drives produce different
    // economic profiles — pure monocultures become self-defeating because
    // each strain's strength is another's weakness.
    //   - Material: productive subject. Better sugar yield.
    //   - Symbolic: luxury orientation. Better spice yield.
    //   - Normative: balanced; cooperation bonus shows up in trade.
    //   - Power:    predatory; bad at gathering, supplements by combat.
    const sugarGain = this.cells[idx] * sugarYieldFactor(a.motivation);
    const spiceGain = this.spice[idx] * spiceYieldFactor(a.motivation);
    a.sugar += sugarGain;
    a.spice += spiceGain;
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
    // Norm enforcement: a Normative agent refuses to trade with anyone the
    // community has shamed. The sanction has real economic teeth — a
    // chronically coercive Power agent loses access to the spice/sugar
    // market for as long as the shame holds.
    if (
      (a.motivation === "normative" && b.shamedUntilTurn > this.turn) ||
      (b.motivation === "normative" && a.shamedUntilTurn > this.turn)
    ) {
      return 0;
    }

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

    // Normative cooperative dividend. When either side is Normative, both
    // parties pocket a small bonus on the goods that just moved — the gains
    // from cooperative exchange Durkheim insisted on. Normative monocultures
    // are economically *more* efficient than pure Material ones, but only
    // when they're trading.
    if (a.motivation === "normative" || b.motivation === "normative") {
      const BONUS = 0.05;
      buyer.spice += spiceQty * BONUS;
      seller.sugar += sugarQty * BONUS;
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
    // Bequeath holdings to surviving trade-tie partners, weighted by tie
    // strength. Without this, sugar and spice held by the dying agent simply
    // vanish from the system — and Gini resets harder than it should every
    // time a hoarder dies. With inheritance, wealth concentrates across
    // generations (Marx is happy) and trade-ties carry real economic stakes,
    // not just sociological ones (Granovetter is happy).
    if (this.inheritance) {
      this.bequeathToTies(a);
    }
    a.alive = false;
    this.occupants[a.y * this.width + a.x] = -1;
    this.scrubTies(a.id);
    // Births are no longer triggered by deaths — see `reproductionPhase`.
  }

  /** Distribute a dying agent's holdings to its surviving tie partners,
   *  weighted by tie strength. No-op if it has no ties or is broke. */
  private bequeathToTies(a: Agent): void {
    const totalWealth = a.sugar + a.spice;
    if (totalWealth <= 0) return;

    // Collect every tie this agent has, whether stored as low→high or
    // high→low in the sparse map.
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

    // Filter to living partners. Dead partners' shares would vanish too —
    // we'd rather route everything to the living so wealth is preserved.
    const living = partners.filter((p) => this.agents[p.id]?.alive);
    const liveWeight = living.reduce((s, p) => s + p.weight, 0);
    if (liveWeight <= 0) return;

    for (const p of living) {
      const share = p.weight / liveWeight;
      this.agents[p.id].sugar += a.sugar * share;
      this.agents[p.id].spice += a.spice * share;
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
    for (const a of this.agents) {
      if (!a.alive) continue;
      alive++;
      motivationCounts[a.motivation]++;
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
      motivationCounts,
    };
  }

  randomFloat(): number {
    return this.rng();
  }

  /** Flat [idA, idB, weight, ...] view of the current trade-tie map. */
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

/** Weighted draw factory. Sums the (non-zero) weights once and returns a
 *  function that, on each call, picks a key in proportion to those weights
 *  using the supplied RNG. Falls back to `fallback` if every weight is 0. */
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

  // Weighted draw from a mix like { material: 1, power: 2 }, normalised on the
  // fly. Used for both motivation and sophistication so an agent's traits match
  // the proportions the operator set on the setup screen.
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
      shamedUntilTurn: 0,
    });
  }

  // Stagger initial ages across the population. Without this, every agent
  // is born at T=0 and reaches the fertile window (≥ 0.15 × maxAge) at the
  // same time — by then half have starved and the breeding pool is gone.
  // Seeding ages in [0, 0.6 × maxAge] makes the cohort demographically
  // mixed from turn one, so births can start immediately.
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
