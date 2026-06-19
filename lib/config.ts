export type Scale = "village" | "town" | "city";

/** Starting wealth concentration: 0 = perfectly equal, 1 = power-law extreme. */
export type Equality = number;

export type Landscape = "two_peaks" | "centre" | "scattered" | "flat";

export type InitialSettlement =
  | "scattered"
  | "clustered"
  | "single"
  | "segregated";

export type AgentSophistication =
  | "minimal"
  | "bounded_rational"
  | "adaptive"
  | "social";

export type AgentMotivation = "material" | "symbolic" | "normative" | "power";

export type InteractionTopology = "spatial" | "random" | "network";

/** Discriminant for agent rule sets. New models slot in here. */
export type AgentModelKind = "epstein_minimal";

export type ObserverKey =
  | "epstein"
  | "bourdieu"
  | "marx"
  | "weber"
  | "durkheim"
  | "luhmann"
  | "ibn_khaldun"
  | "turchin"
  | "schelling"
  | "ostrom"
  | "butler"
  | "flack";

export interface WorldPhysics {
  /** Resources consumed by each agent per turn. */
  metabolism: number;
  /** Fraction of depleted resources that grow back each turn (0..1). */
  regrowthRate: number;
  /** How many cells of the grid an agent can perceive. */
  vision: number;
  /** Maximum age in turns before an agent dies. */
  lifespan: number;
  /** Per-agent spread around metabolism / vision / lifespan means. 0 = identical, 1 = wide. */
  heterogeneity: number;
}

export interface WorldConfig {
  scale: Scale;
  equality: Equality;
  landscape: Landscape;
  initialSettlement: InitialSettlement;
  reproduction: boolean;
  physics: WorldPhysics;
}

export type WeightedSelection<K extends string> = Partial<Record<K, number>>;

export interface AgentModel {
  kind: AgentModelKind;
  sophistication: WeightedSelection<AgentSophistication>;
  motivation: WeightedSelection<AgentMotivation>;
  topology: InteractionTopology;
}

export function normalizeWeights<K extends string>(
  weights: WeightedSelection<K>,
): Record<string, number> {
  let total = 0;
  for (const w of Object.values(weights) as (number | undefined)[]) {
    if (w !== undefined) total += w;
  }
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [k, w] of Object.entries(weights) as [string, number | undefined][]) {
    if (w === undefined) continue;
    out[k] = w / total;
  }
  return out;
}

export function describeMix<K extends string>(
  weights: WeightedSelection<K>,
  labelOf: (k: K) => string,
): string {
  const entries = Object.entries(weights).filter(([, w]) => w !== undefined) as [
    K,
    number,
  ][];
  if (entries.length === 0) return "None";
  if (entries.length === 1) return labelOf(entries[0][0]);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  return entries
    .map(([k, w]) => `${labelOf(k)} ${Math.round((w / total) * 100)}%`)
    .join(" · ");
}

export interface SimulationConfig {
  seed: number;
  world: WorldConfig;
  agents: AgentModel;
  observers: ObserverKey[];
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

export const SCALE_INFO: Record<
  Scale,
  { label: string; agents: number; hint: string }
> = {
  village: { label: "Village", agents: 500, hint: "Individual lives visible" },
  town: { label: "Town", agents: 5000, hint: "Institutions crystallize" },
  city: { label: "City", agents: 50000, hint: "Civilizations rise and fall" },
};

export function equalityBucket(v: Equality): { label: string; hint: string } {
  if (v < 0.1)
    return {
      label: "Egalitarian",
      hint: "Everyone starts with identical resources. Any divergence is endogenous.",
    };
  if (v < 0.4)
    return {
      label: "Slight noise",
      hint: "Tiny random variation. Tests whether small accidents amplify.",
    };
  if (v < 0.75)
    return {
      label: "Stratified",
      hint: "Wealth bands already exist. Inheritance and class matter from turn one.",
    };
  return {
    label: "Extreme",
    hint: "Few rich, many poor. Power-law distribution from the start.",
  };
}

export const LANDSCAPE_INFO: Record<
  Landscape,
  { label: string; hint: string }
> = {
  two_peaks: {
    label: "Two peaks",
    hint: "Two abundant zones. Migration, trade, and conflict likely.",
  },
  centre: {
    label: "Single centre",
    hint: "One resource core with periphery. Classic urbanization pull.",
  },
  scattered: {
    label: "Scattered",
    hint: "Many small patches. Favours local economies and many small settlements.",
  },
  flat: {
    label: "Flat",
    hint: "Uniform abundance everywhere. No geographic pull.",
  },
};

export const SETTLEMENT_INFO: Record<
  InitialSettlement,
  { label: string; hint: string }
> = {
  scattered: {
    label: "Scattered",
    hint: "Every agent picks a random spot. The starting distribution is uniform.",
  },
  clustered: {
    label: "Clustered",
    hint: "A few small groups in different locations. The world starts already grainy.",
  },
  single: {
    label: "One settlement",
    hint: "Everyone begins together in one place. Migration must happen for the world to spread.",
  },
  segregated: {
    label: "Segregated",
    hint: "Groups are pre-separated by wealth band. Tests whether sorted worlds stay sorted.",
  },
};

export const SOPHISTICATION_INFO: Record<
  AgentSophistication,
  { label: string; hint: string }
> = {
  minimal: {
    label: "Minimal",
    hint: "Reactive only. Agents follow simple stimulus → response rules.",
  },
  bounded_rational: {
    label: "Bounded",
    hint: "Limited information, good-enough rather than optimal choices.",
  },
  adaptive: {
    label: "Adaptive",
    hint: "Learn from outcomes and adjust strategies over time.",
  },
  social: {
    label: "Social",
    hint: "Imitate, signal, and gossip. Behaviour spreads through ties.",
  },
};

export const MOTIVATION_INFO: Record<
  AgentMotivation,
  { label: string; hint: string }
> = {
  material: {
    label: "Material",
    hint: "Resources and labour come first.",
  },
  symbolic: {
    label: "Symbolic",
    hint: "Status, taste, and distinction drive choices.",
  },
  normative: {
    label: "Normative",
    hint: "Belonging and ritual conformity guide action.",
  },
  power: {
    label: "Power",
    hint: "Authority and control over others. The drive to lead, command, and be obeyed.",
  },
};

export const TOPOLOGY_INFO: Record<
  InteractionTopology,
  { label: string; hint: string }
> = {
  spatial: {
    label: "Local spatial",
    hint: "Neighbours only. Geography is destiny.",
  },
  random: {
    label: "Random mixing",
    hint: "Anyone may meet anyone. No social friction.",
  },
  network: {
    label: "Network",
    hint: "Persistent ties. Friends of friends carry influence.",
  },
};

export const REPRODUCTION_HINT =
  "Every society reproduces. The question is whether children inherit what their parents accumulated, or each life begins from scratch.";

interface PhysicsBucket {
  value: number;
  label: string;
  hint: string;
}

export const METABOLISM_BUCKETS: readonly PhysicsBucket[] = [
  {
    value: 0.5,
    label: "Easy living",
    hint: "Bodies cost little. Surplus is easy to accumulate.",
  },
  {
    value: 1,
    label: "Modest needs",
    hint: "Standard rate. Steady consumption against steady production.",
  },
  {
    value: 2,
    label: "Demanding",
    hint: "Survival is work. Falling behind on resources is dangerous.",
  },
  {
    value: 3,
    label: "Brutal",
    hint: "Constant pressure. Famine looms if production stalls.",
  },
];

export const REGROWTH_BUCKETS: readonly PhysicsBucket[] = [
  {
    value: 0.02,
    label: "Slow recovery",
    hint: "Once exhausted, land takes generations to recover.",
  },
  {
    value: 0.1,
    label: "Steady regrowth",
    hint: "Resources replenish at a sustainable pace.",
  },
  {
    value: 0.3,
    label: "Fast renewal",
    hint: "The world heals quickly. Carrying capacity is generous.",
  },
  {
    value: 0.6,
    label: "Abundance",
    hint: "Almost faster than it can be consumed. Scarcity rarely bites.",
  },
];

export const VISION_BUCKETS: readonly PhysicsBucket[] = [
  {
    value: 1,
    label: "Their own square",
    hint: "Agents perceive only what they stand on. Nearly blind.",
  },
  {
    value: 3,
    label: "Their neighbourhood",
    hint: "Local awareness only. Geography hides opportunities.",
  },
  {
    value: 6,
    label: "Half the valley",
    hint: "Wide awareness. Agents can plan toward distant resources.",
  },
  {
    value: 12,
    label: "Across the world",
    hint: "Effectively global perception. Information is free.",
  },
];

export const HETEROGENEITY_BUCKETS: readonly PhysicsBucket[] = [
  {
    value: 0,
    label: "Identical",
    hint: "Every agent shares the same vision, metabolism, and lifespan. A perfectly uniform population.",
  },
  {
    value: 0.15,
    label: "Slight variation",
    hint: "Small random spread around each mean. Realistic without dramatic outliers.",
  },
  {
    value: 0.4,
    label: "Wide spread",
    hint: "Significant differences between agents. Some see further, some need more, some live longer.",
  },
  {
    value: 0.7,
    label: "Extreme variation",
    hint: "Strong dispersion. The population mixes very capable and very limited agents.",
  },
];

export const LIFESPAN_BUCKETS: readonly PhysicsBucket[] = [
  {
    value: 30,
    label: "Short and brutal",
    hint: "Few turns per agent. Rapid turnover.",
  },
  {
    value: 60,
    label: "Mortal lives",
    hint: "Standard arc. Time to accumulate, time to lose it.",
  },
  {
    value: 120,
    label: "Long-lived",
    hint: "Wealth and habits persist longer. Slower turnover.",
  },
  {
    value: 200,
    label: "Generational",
    hint: "Near-permanent agents. Structure entrenches before death matters.",
  },
];

export interface ObserverEntry {
  label: string;
  name: string;
  era: string;
  lens: string;
  sees: string;
  watches: string;
}

export const OBSERVER_INFO: Record<ObserverKey, ObserverEntry> = {
  epstein: {
    label: "Epstein",
    name: "Joshua Epstein",
    era: "contemporary",
    lens: "macro patterns from micro rules",
    sees: "Society as a generative system. Large-scale patterns emerge from the simple rules each agent follows locally — no central planner required.",
    watches:
      "Whether inequality, segregation, and crisis can be 'grown' from agent interactions alone. If you didn't grow it, you didn't explain it.",
  },
  bourdieu: {
    label: "Bourdieu",
    name: "Pierre Bourdieu",
    era: "1930–2002",
    lens: "capital, field, habitus",
    sees: "Society as a field of struggles where actors deploy economic, cultural, social, and symbolic capital. Tastes and bodies carry the structure forward.",
    watches:
      "How habitus reproduces class across generations, how capital converts between forms, and where symbolic violence is doing the quiet work.",
  },
  marx: {
    label: "Marx",
    name: "Karl Marx",
    era: "1818–1883",
    lens: "class, surplus, consciousness",
    sees: "Society shaped by who owns the means of production and who must sell their labour. Material conditions come first; ideas follow.",
    watches:
      "Surplus extraction, alienation, and the contradictions that turn quantitative pressure into qualitative rupture.",
  },
  weber: {
    label: "Weber",
    name: "Max Weber",
    era: "1864–1920",
    lens: "rationalization, legitimacy, bureaucracy",
    sees: "Modernity as the disenchantment of the world — life increasingly governed by calculable rules and means-ends rationality. The iron cage builds itself.",
    watches:
      "How charisma routinizes into bureaucracy, how authority claims legitimacy (traditional, charismatic, legal-rational), and where rationalization corrodes meaning.",
  },
  durkheim: {
    label: "Durkheim",
    name: "Émile Durkheim",
    era: "1858–1917",
    lens: "solidarity, anomie, social facts",
    sees: "Society as a moral reality above individuals. Social facts — norms, rituals, collective beliefs — have causal force no one person creates or controls.",
    watches:
      "The shift from mechanical to organic solidarity, anomie when shared norms loosen, and rituals that bind a group into a single conscience.",
  },
  luhmann: {
    label: "Luhmann",
    name: "Niklas Luhmann",
    era: "1927–1998",
    lens: "subsystems, binary codes",
    sees: "Society as a network of autopoietic subsystems — law, economy, politics, science — each operating on its own binary code and unable to fully translate the others.",
    watches:
      "How subsystems differentiate, draw boundaries, and communicate through structural couplings. Where one code colonizes another.",
  },
  ibn_khaldun: {
    label: "Ibn Khaldun",
    name: "Ibn Khaldun",
    era: "1332–1406",
    lens: "asabiyyah, cycles",
    sees: "Civilization as a cycle. Group solidarity ('asabiyyah') is forged on the periphery, conquers the centre, then dissolves into luxury within three generations.",
    watches:
      "Cohesion vs. decadence. The slow erosion of solidarity once a dynasty grows comfortable, and the next periphery rising to replace it.",
  },
  turchin: {
    label: "Turchin",
    name: "Peter Turchin",
    era: "contemporary",
    lens: "elite overproduction",
    sees: "History as quantifiable. Societies oscillate between integrative and disintegrative phases driven by elite competition and popular immiseration.",
    watches:
      "Too many elites chasing too few positions, real wages falling, state finances cracking. The structural-demographic preconditions of crisis.",
  },
  schelling: {
    label: "Schelling",
    name: "Thomas Schelling",
    era: "1921–2016",
    lens: "thresholds, segregation",
    sees: "Macrobehavior as the accidental sum of micromotives. Mild individual preferences can compound into outcomes nobody wanted.",
    watches:
      "Tipping points, thresholds, and the moments when small preference shifts cascade into segregation, runs, or coordination collapse.",
  },
  ostrom: {
    label: "Ostrom",
    name: "Elinor Ostrom",
    era: "1933–2012",
    lens: "commons, governance, polycentricity",
    sees: "Communities can govern shared resources sustainably — neither pure market nor pure state — when the rules fit the situation. Hobbes and Smith don't exhaust the options.",
    watches:
      "How groups craft rules, monitor each other, and resolve disputes. The design principles that let a commons survive enclosure and free-riding.",
  },
  butler: {
    label: "Butler",
    name: "Judith Butler",
    era: "contemporary",
    lens: "performativity, recognition, norms",
    sees: "Identity not as expressed but as performed. Gender, race, and selfhood are produced through repeated acts that cite norms into existence.",
    watches:
      "Which bodies become intelligible and which don't, how norms reproduce by being cited, and where performance fails or refuses the categories meant to contain it.",
  },
  flack: {
    label: "Flack",
    name: "Jessica Flack",
    era: "contemporary",
    lens: "slow variables, policing",
    sees: "Society as a system stabilized by slow variables — norms, institutions, conventions — that absorb fast-moving conflict and keep the whole legible.",
    watches:
      "How policing and conflict management coarse-grain the world, where collective computation lives, and what fails when slow variables erode.",
  },
};

export const DEFAULT_PHYSICS: WorldPhysics = {
  metabolism: 1,
  regrowthRate: 0.1,
  vision: 3,
  lifespan: 60,
  heterogeneity: 0.15,
};

export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 0,
  world: {
    scale: "town",
    equality: 0.2,
    landscape: "two_peaks",
    initialSettlement: "scattered",
    reproduction: true,
    physics: DEFAULT_PHYSICS,
  },
  agents: {
    kind: "epstein_minimal",
    sophistication: { bounded_rational: 1 },
    motivation: { material: 1 },
    topology: "spatial",
  },
  observers: ["epstein"],
};
