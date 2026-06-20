import type { Engine } from "@/lib/engine";

/** Mutable singleton holding the currently active simulation engine.
 * SimulationCanvas writes to it; floating windows that need raw engine
 * state (network graph, lineage, etc.) read from it. Not reactive — those
 * windows already re-render via the store's turn counter. */
export const activeEngineRef: { current: Engine | null } = { current: null };
