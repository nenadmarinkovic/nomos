import type { WorldView } from "@/lib/world";

/** Mutable singleton holding the latest world snapshot from the simulation
 * worker. SimulationCanvas writes to it on each frame; floating windows that
 * read raw world state (the network graph) read from it. Not reactive — those
 * windows already re-render via the store's turn counter. */
export const activeWorldRef: { current: WorldView | null } = { current: null };
