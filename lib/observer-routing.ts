import type { ObserverKey } from "@/lib/config";
import type { EventKind } from "@/lib/events";

/**
 * Route each event to the single best-fit theorist. First match in the
 * active set wins; a per-kind rotation counter shifts the starting index
 * so repeated occurrences reach for a different voice.
 */

const PRIORITY: Record<EventKind, ObserverKey[]> = {
  /** Founding: methodological reference, Polanyi's pre-commodified opening,
   *  Durkheim's collective conscience. */
  founding: ["epstein", "polanyi", "durkheim"],

  /** Wealth concentrating: Marx, Bourdieu (lock-in), Turchin. */
  inequality_surge: ["marx", "bourdieu", "turchin"],

  /** Gap narrows: Polanyi (counter-movement), Durkheim, Marx. */
  leveling: ["polanyi", "durkheim", "marx"],

  /** Crossing Gini 0.5: Bourdieu (distinction), Marx (class), Turchin. */
  stratification: ["bourdieu", "marx", "turchin"],

  /** Hard population fall: Turchin (secular cycle), Flack, Epstein. */
  population_crash: ["turchin", "flack", "epstein"],

  /** Population rises: Epstein, Granovetter, Durkheim. */
  population_boom: ["epstein", "granovetter", "durkheim"],

  /** Market thickens: Polanyi (transformation), Farmer, Granovetter. */
  market_forming: ["polanyi", "farmer", "granovetter"],

  /** Price shock: Farmer, Polanyi, Schelling. */
  price_shock: ["farmer", "polanyi", "schelling"],

  /** Collapse: Turchin, Flack, Marx. */
  collapse: ["turchin", "flack", "marx"],

  /** Spatial sorting: Schelling first, then Bourdieu, Durkheim. */
  segregation: ["schelling", "bourdieu", "durkheim"],

  /** One disposition spreading: Bourdieu, Schelling, Granovetter. */
  motivation_shift: ["bourdieu", "schelling", "granovetter"],

  /** Predation burst: Axelrod (defection/TfT), Marx, Durkheim, Flack. */
  coercion_wave: ["axelrod", "marx", "durkheim", "flack"],

  /** Cooperation locking in: Axelrod, Granovetter, Flack, Epstein. */
  cooperation_thickens: ["axelrod", "granovetter", "flack", "epstein"],

  /** Trade web unravelling: Granovetter, Flack, Polanyi. */
  network_fracture: ["granovetter", "flack", "polanyi"],

  /** Calcified inequality: Marx, Bourdieu (reproduction), Turchin. */
  extreme_inequality: ["marx", "bourdieu", "turchin"],

  /** Elite capture: Turchin, Marx, Flack. */
  oligarchy: ["turchin", "marx", "flack"],

  /** Land-side shock: Polanyi, Epstein, Farmer. */
  shock_blight: ["polanyi", "epstein", "farmer"],

  /** Mortality shock: Turchin, Durkheim, Flack. */
  shock_plague: ["turchin", "durkheim", "flack"],

  /** Trust anchor emerges: Granovetter (centrality), Flack, Durkheim. */
  leadership_emerges: ["granovetter", "flack", "durkheim"],

  /** Run on the top issuer: Polanyi (fictitious commodity), Farmer, Marx. */
  bank_run: ["polanyi", "farmer", "marx"],

  /** Heartbeat: cycle through every theorist. */
  passage: [
    "epstein",
    "marx",
    "durkheim",
    "bourdieu",
    "polanyi",
    "granovetter",
    "schelling",
    "turchin",
    "farmer",
    "flack",
    "axelrod",
  ],
};

/** Per-kind rotation offset. Resets per page load — runs are session-scoped. */
const rotation = new Map<EventKind, number>();

/** Pick the observer to narrate this event. Null only when no observers are selected. */
export function pickObserver(
  kind: EventKind,
  available: readonly ObserverKey[],
): ObserverKey | null {
  if (available.length === 0) return null;
  const order = PRIORITY[kind] ?? [];
  const availSet = new Set(available);
  const offset = rotation.get(kind) ?? 0;

  // Walk the priority list starting at the rotation offset.
  for (let i = 0; i < order.length; i++) {
    const candidate = order[(i + offset) % order.length];
    if (availSet.has(candidate)) {
      rotation.set(kind, offset + 1);
      return candidate;
    }
  }

  // No preferred theorist available — pick a deterministic fallback.
  const fallbackIdx = (offset + (available.length - 1)) % available.length;
  rotation.set(kind, offset + 1);
  return available[fallbackIdx];
}

/** Reset per-run so each run's first-of-kind goes to the top priority pick. */
export function resetObserverRotation(): void {
  rotation.clear();
}
