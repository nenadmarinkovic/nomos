import type { ObserverKey } from "@/lib/config";
import type { EventKind } from "@/lib/events";

/**
 * Route a significant event to the single best-fit observer.
 *
 * The original design fired every active observer at every event, which
 * produced N paragraphs about the same moment and overwhelmed the reader.
 * The intellectual move ("same emergence, different vocabularies") still
 * lands across the run: a society throws many kinds of events, and each
 * kind picks the theorist whose lens has the most concrete purchase on it.
 *
 * Priority list per event kind: first match in the active set wins. A
 * round-robin counter shifts the starting index so repeated occurrences of
 * the same kind reach for a different available voice.
 */

const PRIORITY: Record<EventKind, ObserverKey[]> = {
  /** The simulation begins — methodological self-reference fits best, with
   *  Polanyi as backup for the pre-commodified opening, Durkheim for the
   *  collective-conscience reading. */
  founding: ["epstein", "polanyi", "durkheim"],

  /** Wealth concentrating — Marx's home turf, Bourdieu for cultural lock-in,
   *  Turchin for the structural-demographic warning. */
  inequality_surge: ["marx", "bourdieu", "turchin"],

  /** The gap narrows — Polanyi reads the counter-movement, Durkheim the
   *  re-knit social tissue, Marx the redistribution. */
  leveling: ["polanyi", "durkheim", "marx"],

  /** Crossing the 0.5 Gini line — Bourdieu's distinction crystallises;
   *  Marx names the class division; Turchin counts the elite. */
  stratification: ["bourdieu", "marx", "turchin"],

  /** Population falls hard — Turchin's secular cycle, Flack's slow variables
   *  failing, Epstein's grown-it-here. */
  population_crash: ["turchin", "flack", "epstein"],

  /** Population rises — Epstein on emergence, Granovetter on new ties,
   *  Durkheim on the thickening collective. */
  population_boom: ["epstein", "granovetter", "durkheim"],

  /** Exchange thickens into a market — exactly Polanyi's great
   *  transformation, with Farmer reading the microstructure and
   *  Granovetter the embedded relations. */
  market_forming: ["polanyi", "farmer", "granovetter"],

  /** Prices convulse — Farmer's complexity economics, then Polanyi's
   *  fictitious-commodity stress, then Schelling's cascade. */
  price_shock: ["farmer", "polanyi", "schelling"],

  /** Society all but gone — Turchin's collapse phase, Flack's eroded
   *  slow variables, Marx's contradictions resolved by rupture. */
  collapse: ["turchin", "flack", "marx"],

  /** Agents sorting themselves in space — Schelling's tipping dynamics,
   *  Bourdieu's distinction inscribed in territory, Durkheim's mechanical
   *  solidarity of the like-with-like. */
  segregation: ["schelling", "bourdieu", "durkheim"],

  /** One disposition spreading through the population — Bourdieu's habitus
   *  reproducing, Schelling's preference cascade, Granovetter's contagion
   *  along ties. */
  motivation_shift: ["bourdieu", "schelling", "granovetter"],

  /** A burst of expropriation — Marx names it dispossession, Durkheim the
   *  violated norm, Flack the policing that fails or holds. */
  coercion_wave: ["marx", "durkheim", "flack"],

  /** The trade web dissolving — Granovetter's structure unravelling,
   *  Flack's slow variables eroding, Polanyi's disembedding. */
  network_fracture: ["granovetter", "flack", "polanyi"],

  /** Inequality that has sat at an extreme level for a long stretch.
   *  Marx names the calcified class division; Bourdieu reads the
   *  reproduction; Turchin's elite overproduction has found its host. */
  extreme_inequality: ["marx", "bourdieu", "turchin"],

  /** A top tier holding most of the wealth indefinitely — oligarchic
   *  consolidation. Turchin's elite capture; Marx's owners; Flack's
   *  slow variables holding the asymmetry in place. */
  oligarchy: ["turchin", "marx", "flack"],

  /** Exogenous land-side shock (blight halving regrowth) — Polanyi reads
   *  the substrate failing the embedded economy; Epstein the methodological
   *  shock; Farmer the dynamical perturbation. */
  shock_blight: ["polanyi", "epstein", "farmer"],

  /** Exogenous mortality shock (a fraction of the population vanishes).
   *  Turchin reads the secular cycle's mortality phase; Durkheim the
   *  rupture of the social tissue; Flack the slow variables tested. */
  shock_plague: ["turchin", "durkheim", "flack"],

  /** Heartbeat reading on a stable society. Cycles through every available
   *  theorist so the user hears a different voice on each passage. */
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
  ],
};

/** Module-scoped rotation counter: keys are event kinds, values are the
 *  next "starting offset" into the priority list. Resets per page load,
 *  which is fine — runs are session-scoped. */
const rotation = new Map<EventKind, number>();

/**
 * Pick the observer to narrate this event. Returns null only when the user
 * has no observers selected at all.
 */
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

  // None of the preferred theorists for this kind are selected — pick a
  // deterministic fallback from whoever the user did select.
  const fallbackIdx = (offset + (available.length - 1)) % available.length;
  rotation.set(kind, offset + 1);
  return available[fallbackIdx];
}

/** Reset the rotation state. Called when a new run starts so the first
 *  event of each kind in the new run goes to the priority's top pick
 *  regardless of what happened in the previous session. */
export function resetObserverRotation(): void {
  rotation.clear();
}
