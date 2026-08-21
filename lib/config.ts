export type Scale = "village" | "town" | "city";

export type Equality = number;

export type Landscape = "two_peaks" | "centre" | "scattered" | "flat";

export type InitialSettlement =
  "scattered" | "clustered" | "single" | "segregated";

export type AgentSophistication =
  "minimal" | "bounded_rational" | "adaptive" | "social";

export type AgentMotivation = "material" | "symbolic" | "normative" | "power";

export type InteractionTopology = "spatial" | "random" | "network";

export type AgentModelKind = "epstein_minimal";

export type ObserverKey =
  | "epstein"
  | "bourdieu"
  | "marx"
  | "polanyi"
  | "granovetter"
  | "turchin"
  | "schelling"
  | "farmer"
  | "flack"
  | "axelrod";

export interface WorldPhysics {
  metabolism: number;
  regrowthRate: number;
  vision: number;
  lifespan: number;
  heterogeneity: number;
}

export interface WorldConfig {
  scale: Scale;
  equality: Equality;
  landscape: Landscape;
  initialSettlement: InitialSettlement;
  culturalTransmission: boolean;
  inheritance: boolean;
  conflict: boolean;
  substrateDiffusion: boolean;
  physics: WorldPhysics;
}

export type WeightedSelection<K extends string> = Partial<Record<K, number>>;

export interface AgentModel {
  kind: AgentModelKind;
  sophistication: WeightedSelection<AgentSophistication>;
  motivation: WeightedSelection<AgentMotivation>;
  topology: InteractionTopology;
  mutationRate?: number;
}

export const DEFAULT_MUTATION_RATE = 0.04;

export function normalizeWeights<K extends string>(
  weights: WeightedSelection<K>,
): Record<string, number> {
  let total = 0;
  for (const w of Object.values(weights) as (number | undefined)[]) {
    if (w !== undefined) total += w;
  }
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [k, w] of Object.entries(weights) as [
    string,
    number | undefined,
  ][]) {
    if (w === undefined) continue;
    out[k] = w / total;
  }
  return out;
}

export function describeMix<K extends string>(
  weights: WeightedSelection<K>,
  labelOf: (k: K) => string,
): string {
  const entries = Object.entries(weights).filter(
    ([, w]) => w !== undefined,
  ) as [K, number][];
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
  village: {
    label: "Village",
    agents: 500,
    hint: "You can follow single lives",
  },
  town: {
    label: "Town",
    agents: 1000,
    hint: "Groups and habits start forming",
  },
  city: { label: "City", agents: 5000, hint: "Whole districts rise and fall" },
};

export function equalityBucket(v: Equality): { label: string; hint: string } {
  if (v < 0.1)
    return {
      label: "Egalitarian",
      hint: "Everyone gets the same. Any gap that opens later was made by the run.",
    };
  if (v < 0.4)
    return {
      label: "Almost equal",
      hint: "Small random differences. See whether tiny luck snowballs.",
    };
  if (v < 0.75)
    return {
      label: "Already divided",
      hint: "Rich and poor exist from turn one.",
    };
  return {
    label: "Very unequal",
    hint: "A few very rich agents and a lot of poor ones.",
  };
}

export const LANDSCAPE_INFO: Record<
  Landscape,
  { label: string; hint: string }
> = {
  two_peaks: {
    label: "Two peaks",
    hint: "Two rich areas. Expect two crowds, trade between them, and fights.",
  },
  centre: {
    label: "Single centre",
    hint: "One rich middle and an empty edge. Everyone gets pulled inward.",
  },
  scattered: {
    label: "Scattered",
    hint: "Lots of small patches, so lots of small separate settlements.",
  },
  flat: {
    label: "Flat",
    hint: "Food everywhere, the same amount. The land has no say.",
  },
};

export const SETTLEMENT_INFO: Record<
  InitialSettlement,
  { label: string; hint: string }
> = {
  scattered: {
    label: "Scattered",
    hint: "Everyone lands on a random square. No pattern to start with.",
  },
  clustered: {
    label: "Clustered",
    hint: "A few small groups in different places. Some grouping is given to you.",
  },
  single: {
    label: "One settlement",
    hint: "Everyone starts in the same place. They have to move out to spread.",
  },
  segregated: {
    label: "Segregated",
    hint: "Rich and poor start in separate corners. See if they ever mix.",
  },
};

export const SOPHISTICATION_INFO: Record<
  AgentSophistication,
  { label: string; hint: string }
> = {
  minimal: {
    label: "Simple",
    hint: "Sees the best square it can and goes there. No thinking ahead.",
  },
  bounded_rational: {
    label: "Good enough",
    hint: "Takes the first decent option nearby instead of hunting for the best.",
  },
  adaptive: {
    label: "Learns",
    hint: "Remembers how past moves went and adjusts how far it ranges.",
  },
  social: {
    label: "Copies others",
    hint: "Follows the richest neighbour it can see, whatever the food looks like.",
  },
};

export const MOTIVATION_INFO: Record<
  AgentMotivation,
  { label: string; hint: string }
> = {
  material: {
    label: "Material",
    hint: "Wants food and wealth above all.",
  },
  symbolic: {
    label: "Symbolic",
    hint: "Wants status. Hangs around whoever is doing well.",
  },
  normative: {
    label: "Normative",
    hint: "Wants to fit in. Sticks close to the group.",
  },
  power: {
    label: "Power",
    hint: "Wants control. Looks for weaker neighbours to push around.",
  },
};

export const TOPOLOGY_INFO: Record<
  InteractionTopology,
  { label: string; hint: string }
> = {
  spatial: {
    label: "Neighbours only",
    hint: "You deal with whoever is standing next to you. Nothing travels fast.",
  },
  random: {
    label: "Anyone at random",
    hint: "Distance stops mattering. Anyone can run into anyone.",
  },
  network: {
    label: "Regular contacts",
    hint: "Agents keep the same partners, so influence flows through friends of friends.",
  },
};

interface PhysicsBucket {
  value: number;
  label: string;
  hint: string;
}

export const METABOLISM_BUCKETS: readonly PhysicsBucket[] = [
  {
    value: 0.5,
    label: "Easy living",
    hint: "Barely anything is spent per turn. Food piles up.",
  },
  {
    value: 1,
    label: "Modest needs",
    hint: "The normal rate. What comes in roughly matches what goes out.",
  },
  {
    value: 2,
    label: "Demanding",
    hint: "Staying alive is work. A bad patch of luck can kill you.",
  },
  {
    value: 3,
    label: "Brutal",
    hint: "Every turn is a near miss. One bad stretch and people starve.",
  },
];

export const REGROWTH_BUCKETS: readonly PhysicsBucket[] = [
  {
    value: 0.02,
    label: "Slow",
    hint: "Once a patch is stripped it stays bare for a very long time.",
  },
  {
    value: 0.1,
    label: "Steady",
    hint: "Food comes back about as fast as it gets eaten.",
  },
  {
    value: 0.3,
    label: "Fast",
    hint: "The land bounces back quickly. It can support a lot of people.",
  },
  {
    value: 0.6,
    label: "Endless",
    hint: "Grows back faster than anyone can eat it. Nobody really goes hungry.",
  },
];

export const VISION_BUCKETS: readonly PhysicsBucket[] = [
  {
    value: 1,
    label: "Their own square",
    hint: "They only know about the square under their feet. Effectively blind.",
  },
  {
    value: 3,
    label: "A few squares",
    hint: "They only see what is close by, and miss everything else.",
  },
  {
    value: 6,
    label: "Half the map",
    hint: "They can spot food far away and walk toward it.",
  },
  {
    value: 12,
    label: "The whole map",
    hint: "Everyone knows about every opportunity. Nothing is hidden.",
  },
];

export const HETEROGENEITY_BUCKETS: readonly PhysicsBucket[] = [
  {
    value: 0,
    label: "Identical",
    hint: "Same eyesight, same appetite, same lifespan for everyone.",
  },
  {
    value: 0.15,
    label: "A little variation",
    hint: "Small differences between agents. No extremes.",
  },
  {
    value: 0.4,
    label: "Noticeable variation",
    hint: "Some see further, some eat more, some live longer.",
  },
  {
    value: 0.7,
    label: "Huge variation",
    hint: "Very capable agents living alongside very limited ones.",
  },
];

export const LIFESPAN_BUCKETS: readonly PhysicsBucket[] = [
  {
    value: 30,
    label: "Short",
    hint: "Agents die young. The population turns over fast.",
  },
  {
    value: 60,
    label: "Normal",
    hint: "Long enough to build something up, and to lose it again.",
  },
  {
    value: 120,
    label: "Long",
    hint: "Wealth and habits stick around. Slow turnover.",
  },
  {
    value: 200,
    label: "Very long",
    hint: "Agents barely die. Whatever forms early tends to stay.",
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
    lens: "big patterns coming out of small rules",
    sees: "Society as a generative system. Large-scale patterns — inequality, classes, markets, money, even the identities people end up wearing — emerge from the simple rules each agent follows locally. No central planner required, and no category set in advance.",
    watches:
      "Whether the macro phenomena under review were *grown* rather than stipulated — money issued by agents and accepted by strangers, classes that cluster out of trait variance instead of being configured, commons that wear thin from individually-rational harvest. If you didn't grow it, you didn't explain it.",
  },
  bourdieu: {
    label: "Bourdieu",
    name: "Pierre Bourdieu",
    era: "1930–2002",
    lens: "status, taste and how advantage gets passed on",
    sees: "Society as a field of struggles where actors deploy economic, cultural, social, and symbolic capital. Tastes and bodies carry the structure forward; even the slow remaking of an agent's dispositions through imitating their wealthier neighbours is habitus reproducing itself, at a real cost.",
    watches:
      "How habitus reproduces across generations even when the children's traits drift; how economic capital converts into the social capital of being trusted to issue an IOU; where symbolic violence does the quiet work of making the resulting hierarchy feel natural to those at its bottom.",
  },
  marx: {
    label: "Marx",
    name: "Karl Marx",
    era: "1818–1883",
    lens: "who owns what, and who works for whom",
    sees: "Society shaped by who owns the means of production and who must sell their labour. Material conditions come first; ideas, identities, even the soil's exhaustion follow from the appetite of accumulation.",
    watches:
      "Surplus extraction, alienation, and the contradictions that turn quantitative pressure into qualitative rupture. Private promises-to-pay issued by the strong are debt as new chains; the land worn down by relentless harvest is the commons devoured to feed accumulation; class is what people *do* to and for each other, not the label they were given.",
  },
  polanyi: {
    label: "Polanyi",
    name: "Karl Polanyi",
    era: "1886–1964",
    lens: "when trade between neighbours turns into a market",
    sees: "Pre-modern economic life is embedded in social relations — reciprocity, redistribution, householding. Money, land, and labour are *fictitious commodities*: treat them as ordinary goods and society reacts to protect itself. The self-regulating market is a recent and unstable invention. Society is not the sum of its traders: the shared moral understanding that gives a promise weight exists above any one of them, and reacts as a body when the market strains it.",
    watches:
      "When trade disembeds from kinship and locality into impersonal price; when promises-to-pay accepted by strangers harden into a circulating medium that has detached from the relations that birthed it; when land's stress under commodification shows as exhausted soil; when the counter-movement appears as shaming, refusal of trade, the community asserting itself against pure market logic; whether the collective understanding holding all this together is binding enough that strangers will take each other's word, or has loosened into a normlessness where nothing does.",
  },
  granovetter: {
    label: "Granovetter",
    name: "Mark Granovetter",
    era: "contemporary",
    lens: "who knows whom, and what travels along those links",
    sees: "Economic action embedded in concrete personal networks. Markets aren't anonymous; they run on who knows whom, on the trust accumulated by repeated dealing, on the bridging weak ties that carry information across cluster boundaries.",
    watches:
      "Which agents become brokers between clusters; when the tie graph fragments into cliques; where embedded trade-partner trust quietly shields against predation that strangers would suffer; how an issuer's promises travel through the network from holder to holder until they're being accepted by people who never met the issuer at all — that moment is when private credit has become money.",
  },
  turchin: {
    label: "Turchin",
    name: "Peter Turchin",
    era: "contemporary",
    lens: "the long build-up before a crisis",
    sees: "History as quantifiable. Societies oscillate between integrative and disintegrative phases driven by elite competition, popular immiseration, and the exhaustion of the substrate that fed the integrative climb.",
    watches:
      "Too many elites chasing too few positions; real wages falling; the soil's carrying capacity declining beneath the population it sustains; financialisation — credit notes proliferating as the late-cycle elite buys time with promises — as a marker of disintegration. The structural-demographic preconditions of crisis.",
  },
  schelling: {
    label: "Schelling",
    name: "Thomas Schelling",
    era: "1921–2016",
    lens: "small preferences that tip into big sorting",
    sees: "Macrobehavior as the accidental sum of micromotives. Mild individual preferences can compound into outcomes nobody wanted; individually rational harvest can leave the commons bare; individually rational mistrust can collapse a credit cascade.",
    watches:
      "Tipping points, thresholds, the moment when small preference shifts cascade into spatial sorting, when an issuer's notes tip from a one-off favour into a circulating money, when individually-trivial harvest decisions cross over into a substrate that can no longer support the population.",
  },
  farmer: {
    label: "Farmer",
    name: "J. Doyne Farmer",
    era: "contemporary",
    lens: "prices, money and instability",
    sees: "The economy as an evolving complex system, far from equilibrium. Prices form from adaptive agents reacting to each other; money itself is endogenously created when one agent's promise gets accepted by enough others; stability is a balance the system keeps re-finding, not a baseline it sits on.",
    watches:
      "How the emergent price arises and where it gets volatile; when positive feedback concentrates wealth; when private-credit issuance scales beyond the collateral that backs it; how the discount on a risky issuer's notes prices the perceived chance of default; when the system tips toward runaway instability rather than self-correcting.",
  },
  flack: {
    label: "Flack",
    name: "Jessica Flack",
    era: "contemporary",
    lens: "the quiet things holding a society together",
    sees: "Society as a system stabilised by slow variables — norms, institutions, conventions, the soil's carrying capacity, the standing of an issuer whose notes others trust — that absorb fast-moving conflict and keep the whole legible.",
    watches:
      "How policing and conflict management coarse-grain the world; where collective computation lives — in the consensus that this issuer's promises are good, in the shared classification of who counts as predator; what fails when slow variables erode: when the land's reserve runs down, when trust in the standing issuer thins, when policing stops being credible.",
  },
  axelrod: {
    label: "Axelrod",
    name: "Robert Axelrod",
    era: "contemporary",
    lens: "who cooperates, who cheats, and what happens next",
    sees: "Cooperation as something that *evolves*, not something imposed. When the same partners meet again and again, selfish agents discover that reciprocity beats betrayal — niceness, retaliation, forgiveness, and clarity together produce a robust strategy that resists exploitation. Credit between repeat partners is the same logic in monetary form: a willingness to be exploited once, on the bet that the partner will be there next round.",
    watches:
      "Whether the shadow of the future is long enough for reciprocity to take root; whether retaliation against defectors is swift, proportionate, and visible to bystanders; whether trade partners' standing shields them from being preyed upon by the same agents who prey on strangers; whether an issuer's reputation for paying back lets their promises circulate. Predation surfacing is not collapse but the *test* the strategy was built for.",
  },
};

export const DEFAULT_PHYSICS: WorldPhysics = {
  metabolism: 1,
  regrowthRate: 0.1,
  vision: 3,
  lifespan: 60,
  heterogeneity: 0.4,
};

export const DEFAULT_CONFIG: SimulationConfig = {
  seed: 0,
  world: {
    scale: "town",
    equality: 0.05,
    landscape: "two_peaks",
    initialSettlement: "scattered",
    culturalTransmission: true,
    inheritance: true,
    conflict: true,
    substrateDiffusion: true,
    physics: DEFAULT_PHYSICS,
  },
  agents: {
    kind: "epstein_minimal",
    sophistication: {
      minimal: 1,
      bounded_rational: 1,
      adaptive: 1,
      social: 1,
    },
    motivation: {
      material: 1,
      symbolic: 1,
      normative: 1,
      power: 1,
    },
    topology: "spatial",
    mutationRate: DEFAULT_MUTATION_RATE,
  },
  observers: ["epstein", "marx", "bourdieu", "polanyi", "axelrod"],
};
