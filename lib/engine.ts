import type {
  AgentMotivation,
  InitialSettlement,
  Landscape,
  Scale,
  SimulationConfig,
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
  wealth: number;
  age: number;
  vision: number;
  metabolism: number;
  maxAge: number;
  initialEndowment: number;
  motivation: AgentMotivation;
}

export const WEALTH_BIN_EDGES = [5, 10, 20, 40, 80] as const;
export const WEALTH_BIN_LABELS = ["<5", "5–10", "10–20", "20–40", "40–80", "80+"] as const;

export interface EngineSnapshot {
  turn: number;
  alive: number;
  gini: number;
  totalWealth: number;
  wealthBins: number[];
}

export class Engine {
  readonly width: number;
  readonly height: number;
  readonly maxCells: Float32Array;
  readonly cells: Float32Array;
  readonly occupants: Int32Array;
  agents: Agent[];
  turn = 0;

  private rng: () => number;
  private regrowthRate: number;
  private reproduction: boolean;

  constructor(config: SimulationConfig) {
    this.rng = mulberry32(config.seed || 1);
    this.regrowthRate = config.world.physics.regrowthRate;
    this.reproduction = config.world.reproduction;

    const size = GRID_SIZE[config.world.scale];
    this.width = size;
    this.height = size;

    const total = size * size;
    this.maxCells = new Float32Array(total);
    this.cells = new Float32Array(total);
    this.occupants = new Int32Array(total).fill(-1);

    buildLandscape(
      this.maxCells,
      this.width,
      this.height,
      config.world.landscape,
      this.rng,
    );
    this.cells.set(this.maxCells);

    const requested = AGENT_COUNT[config.world.scale];
    const cap = Math.floor(total * 0.5);
    const count = Math.min(requested, cap);

    this.agents = spawnAgents(this, config, count);
    for (const a of this.agents) {
      this.occupants[a.y * this.width + a.x] = a.id;
    }
  }

  tick(): void {
    for (let i = 0; i < this.cells.length; i++) {
      const m = this.maxCells[i];
      if (m > 0) {
        const next = this.cells[i] + this.regrowthRate * m;
        this.cells[i] = next > m ? m : next;
      }
    }

    const order: number[] = [];
    for (const a of this.agents) {
      if (a.alive) order.push(a.id);
    }
    shuffle(order, this.rng);

    for (const id of order) {
      const a = this.agents[id];
      if (!a.alive) continue;
      this.actAgent(a);
    }

    this.turn++;
  }

  private actAgent(a: Agent): void {
    let bestX = a.x;
    let bestY = a.y;
    let bestVal = this.cells[a.y * this.width + a.x];
    let bestDist = 0;

    for (let d = 1; d <= a.vision; d++) {
      const targets: [number, number][] = [
        [a.x + d, a.y],
        [a.x - d, a.y],
        [a.x, a.y + d],
        [a.x, a.y - d],
      ];
      for (const [cx, cy] of targets) {
        if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) continue;
        const idx = cy * this.width + cx;
        if (this.occupants[idx] !== -1 && this.occupants[idx] !== a.id) continue;
        const v = this.cells[idx];
        if (
          v > bestVal ||
          (v === bestVal && bestDist > 0 && d < bestDist)
        ) {
          bestVal = v;
          bestX = cx;
          bestY = cy;
          bestDist = d;
        }
      }
    }

    if (bestX !== a.x || bestY !== a.y) {
      this.occupants[a.y * this.width + a.x] = -1;
      a.x = bestX;
      a.y = bestY;
      this.occupants[a.y * this.width + a.x] = a.id;
    }

    const idx = a.y * this.width + a.x;
    a.wealth += this.cells[idx];
    this.cells[idx] = 0;

    a.wealth -= a.metabolism;
    a.age++;

    if (a.wealth <= 0 || a.age >= a.maxAge) {
      this.killAgent(a);
    }
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
      wealth: a.initialEndowment,
      initialEndowment: a.initialEndowment,
      age: 0,
      vision: a.vision,
      metabolism: a.metabolism,
      maxAge: a.maxAge,
      motivation: a.motivation,
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
      totalWealth += a.wealth;
      wealths.push(a.wealth);
      let placed = false;
      for (let i = 0; i < WEALTH_BIN_EDGES.length; i++) {
        if (a.wealth < WEALTH_BIN_EDGES[i]) {
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

function buildLandscape(
  max: Float32Array,
  width: number,
  height: number,
  landscape: Landscape,
  rng: () => number,
): void {
  if (landscape === "flat") {
    max.fill(3);
    return;
  }

  type Peak = { x: number; y: number };
  let peaks: Peak[] = [];
  let sigma = Math.min(width, height) / 6;

  if (landscape === "two_peaks") {
    peaks = [
      { x: width * 0.27, y: height * 0.5 },
      { x: width * 0.73, y: height * 0.5 },
    ];
    sigma = Math.min(width, height) / 5;
  } else if (landscape === "centre") {
    peaks = [{ x: width * 0.5, y: height * 0.5 }];
    sigma = Math.min(width, height) / 4;
  } else if (landscape === "scattered") {
    const k = 8;
    for (let i = 0; i < k; i++) {
      peaks.push({ x: rng() * width, y: rng() * height });
    }
    sigma = Math.min(width, height) / 10;
  }

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
      max[y * width + x] = best;
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

  const motivationKeys: AgentMotivation[] = [];
  const motivationCumWeights: number[] = [];
  let acc = 0;
  for (const [k, w] of Object.entries(config.agents.motivation) as [
    AgentMotivation,
    number | undefined,
  ][]) {
    if (w === undefined || w <= 0) continue;
    motivationKeys.push(k);
    acc += w;
    motivationCumWeights.push(acc);
  }
  const motivationTotal = acc;
  const pickMotivation = (): AgentMotivation => {
    if (motivationKeys.length === 0) return "material";
    if (motivationKeys.length === 1) return motivationKeys[0];
    const r = rng() * motivationTotal;
    for (let i = 0; i < motivationCumWeights.length; i++) {
      if (r < motivationCumWeights[i]) return motivationKeys[i];
    }
    return motivationKeys[motivationKeys.length - 1];
  };

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
    agents.push({
      id: i,
      alive: true,
      x: p.x,
      y: p.y,
      wealth: wealths[i],
      initialEndowment: wealths[i],
      age: 0,
      vision: Math.max(1, Math.round(sampleAttr(physics.vision))),
      metabolism: Math.max(0.1, sampleAttr(physics.metabolism)),
      maxAge: Math.max(10, Math.round(sampleAttr(physics.lifespan))),
      motivation: pickMotivation(),
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
