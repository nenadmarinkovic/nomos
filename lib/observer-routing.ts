import type { ObserverKey } from "@/lib/config";
import type { EventKind } from "@/lib/events";

const PRIORITY: Record<EventKind, ObserverKey[]> = {
  founding: ["epstein", "polanyi", "durkheim"],

  inequality_surge: ["marx", "bourdieu", "turchin"],

  leveling: ["polanyi", "durkheim", "marx"],

  stratification: ["bourdieu", "marx", "turchin"],

  population_crash: ["turchin", "flack", "epstein"],

  population_boom: ["epstein", "granovetter", "durkheim"],

  market_forming: ["polanyi", "farmer", "granovetter"],

  price_shock: ["farmer", "polanyi", "schelling"],

  collapse: ["turchin", "flack", "marx"],

  segregation: ["schelling", "bourdieu", "durkheim"],

  motivation_shift: ["bourdieu", "schelling", "granovetter"],

  coercion_wave: ["axelrod", "marx", "durkheim", "flack"],

  cooperation_thickens: ["axelrod", "granovetter", "flack", "epstein"],

  network_fracture: ["granovetter", "flack", "polanyi"],

  extreme_inequality: ["marx", "bourdieu", "turchin"],

  oligarchy: ["turchin", "marx", "flack"],

  shock_blight: ["polanyi", "epstein", "farmer"],

  shock_plague: ["turchin", "durkheim", "flack"],

  leadership_emerges: ["granovetter", "flack", "durkheim"],

  bank_run: ["polanyi", "farmer", "marx"],

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

const rotation = new Map<EventKind, number>();

export function pickObserver(
  kind: EventKind,
  available: readonly ObserverKey[],
): ObserverKey | null {
  if (available.length === 0) return null;
  const order = PRIORITY[kind] ?? [];
  const availSet = new Set(available);
  const offset = rotation.get(kind) ?? 0;

  for (let i = 0; i < order.length; i++) {
    const candidate = order[(i + offset) % order.length];
    if (availSet.has(candidate)) {
      rotation.set(kind, offset + 1);
      return candidate;
    }
  }

  const fallbackIdx = (offset + (available.length - 1)) % available.length;
  rotation.set(kind, offset + 1);
  return available[fallbackIdx];
}

export function resetObserverRotation(): void {
  rotation.clear();
}
