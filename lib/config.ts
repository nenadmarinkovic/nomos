export type Scale = "village" | "town" | "city";

/** Starting wealth concentration: 0 = perfectly equal, 1 = power-law extreme. */
export type Equality = number;

export type Landscape = "two_peaks" | "centre" | "scattered" | "flat";

export type AgentSophistication =
  | "minimal"
  | "bounded_rational"
  | "adaptive"
  | "social";

export type AgentMotivation = "material" | "symbolic" | "normative" | "mixed";

export type InteractionTopology =
  | "spatial"
  | "random"
  | "network"
  | "hierarchical";

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

export interface SimulationConfig {
  scale: Scale;
  equality: Equality;
  landscape: Landscape;
  reproduction: boolean;
  sophistication: AgentSophistication;
  motivation: AgentMotivation;
  topology: InteractionTopology;
  observers: ObserverKey[];
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
  mixed: {
    label: "Mixed",
    hint: "Weighted blend of all three. Realistic but harder to interpret.",
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
  hierarchical: {
    label: "Hierarchical",
    hint: "Layered access through brokers and gatekeepers.",
  },
};

export const REPRODUCTION_HINT =
  "Agents inherit wealth and traits from their parents. Reveals how structure reproduces across generations.";

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

export const DEFAULT_CONFIG: SimulationConfig = {
  scale: "town",
  equality: 0.2,
  landscape: "two_peaks",
  reproduction: false,
  sophistication: "bounded_rational",
  motivation: "material",
  topology: "spatial",
  observers: ["epstein"],
};
