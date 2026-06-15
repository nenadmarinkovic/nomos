export type Scale = "village" | "town" | "city";

export type Equality = "equal" | "slight" | "stratified" | "extreme";

export type Landscape = "two_peaks" | "centre" | "scattered" | "flat";

export type AgentSophistication =
  | "minimal"
  | "bounded_rational"
  | "adaptive"
  | "social";

export type InteractionTopology =
  | "spatial"
  | "random"
  | "network"
  | "hierarchical";

export type ObserverKey =
  | "epstein"
  | "bourdieu"
  | "marx"
  | "luhmann"
  | "ibn_khaldun"
  | "turchin"
  | "schelling"
  | "flack";

export interface SimulationConfig {
  scale: Scale;
  equality: Equality;
  landscape: Landscape;
  reproduction: boolean;
  sophistication: AgentSophistication;
  topology: InteractionTopology;
  observers: ObserverKey[];
}

export const SCALE_INFO: Record<Scale, { label: string; agents: number; hint: string }> = {
  village: { label: "Village", agents: 500, hint: "Individual lives visible" },
  town: { label: "Town", agents: 5000, hint: "Institutions crystallize" },
  city: { label: "City", agents: 50000, hint: "Civilizations rise and fall" },
};

export const OBSERVER_INFO: Record<ObserverKey, { label: string; lens: string }> = {
  epstein: { label: "Epstein", lens: "macro patterns from micro rules" },
  bourdieu: { label: "Bourdieu", lens: "capital, field, habitus" },
  marx: { label: "Marx", lens: "class, surplus, consciousness" },
  luhmann: { label: "Luhmann", lens: "subsystems, binary codes" },
  ibn_khaldun: { label: "Ibn Khaldun", lens: "asabiyyah, cycles" },
  turchin: { label: "Turchin", lens: "elite overproduction" },
  schelling: { label: "Schelling", lens: "thresholds, segregation" },
  flack: { label: "Flack", lens: "slow variables, policing" },
};

export const DEFAULT_CONFIG: SimulationConfig = {
  scale: "town",
  equality: "slight",
  landscape: "two_peaks",
  reproduction: false,
  sophistication: "bounded_rational",
  topology: "spatial",
  observers: ["epstein"],
};
