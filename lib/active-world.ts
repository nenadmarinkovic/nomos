import type { WorldView } from "@/lib/world";

/** Mutable singleton holding the latest world snapshot from the simulation
 * worker. SimulationEngine (mounted at the AppShell root) writes to it on each
 * frame; canvases, the network graph, and the mini sim window read from it. */
export const activeWorldRef: { current: WorldView | null } = { current: null };

/** performance.now() at the moment the last worker frame arrived. Used by the
 * main canvas and the mini sim window to interpolate between two ticks. */
export const activeFrameAtRef: { current: number } = { current: 0 };

/** The current tick interval in ms (BASE_TICK_MS / speed). Renderers read it
 * to compute interpolation progress. */
export const activeIntervalRef: { current: number } = { current: 200 };
