import type { AgentMotivation } from "@/lib/config";

/**
 * The world, decoupled from the engine.
 *
 * v0.3 moves the tick loop into a Web Worker, so the main thread no longer
 * holds a live `Engine`. The renderer, inspector, and network graph instead
 * read a `WorldView` — a read-only snapshot the worker produces each tick and
 * the main thread rehydrates from transferable buffers. The `Engine` itself
 * satisfies `WorldView` structurally, so the same code paths work on either
 * side of the worker boundary.
 */

export const MOTIVATIONS: readonly AgentMotivation[] = [
  "material",
  "symbolic",
  "normative",
  "power",
];

/** The per-agent fields the UI reads — a subset of the engine's full `Agent`. */
export interface RenderAgent {
  id: number;
  alive: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  sugar: number;
  spice: number;
  age: number;
  maxAge: number;
  vision: number;
  sugarMetab: number;
  spiceMetab: number;
  motivation: AgentMotivation;
}

export interface WorldView {
  width: number;
  height: number;
  turn: number;
  cells: Float32Array;
  maxCells: Float32Array;
  spice: Float32Array;
  maxSpice: Float32Array;
  occupants: Int32Array;
  /** Indexed by agent id (id === array index). */
  agents: readonly RenderAgent[];
  /** Flat triples [idA, idB, weight, …] of decaying trade-partner ties. */
  ties: Float32Array;
}

/**
 * A flattened, structurally-cloned world ready to post across the worker
 * boundary. Agents are packed into one Float32 buffer (column-major per agent)
 * so the whole frame moves as a handful of transferable ArrayBuffers.
 */
export interface WorldFrame {
  width: number;
  height: number;
  turn: number;
  count: number;
  cells: ArrayBuffer;
  maxCells: ArrayBuffer;
  spice: ArrayBuffer;
  maxSpice: ArrayBuffer;
  occupants: ArrayBuffer;
  agents: ArrayBuffer;
  /** Flat triples buffer of trade-partner ties, [idA, idB, weight, …]. */
  ties: ArrayBuffer;
}

const STRIDE = 14;
const ID = 0;
const ALIVE = 1;
const X = 2;
const Y = 3;
const PREV_X = 4;
const PREV_Y = 5;
const SUGAR = 6;
const SPICE = 7;
const AGE = 8;
const MAX_AGE = 9;
const VISION = 10;
const SUGAR_METAB = 11;
const SPICE_METAB = 12;
const MOTIV = 13;

/**
 * Pack a world into transferable buffers. Resource and occupant grids are
 * copied (`.slice()`) so the engine keeps its own arrays after the buffers are
 * transferred away. Integers (ids, coordinates) sit comfortably within
 * Float32's exact-integer range, so a single Float32 buffer carries every
 * agent field.
 */
export function serializeWorld(view: WorldView): {
  frame: WorldFrame;
  transfer: ArrayBuffer[];
} {
  const count = view.agents.length;
  const data = new Float32Array(count * STRIDE);
  for (let i = 0; i < count; i++) {
    const a = view.agents[i];
    const o = i * STRIDE;
    data[o + ID] = a.id;
    data[o + ALIVE] = a.alive ? 1 : 0;
    data[o + X] = a.x;
    data[o + Y] = a.y;
    data[o + PREV_X] = a.prevX;
    data[o + PREV_Y] = a.prevY;
    data[o + SUGAR] = a.sugar;
    data[o + SPICE] = a.spice;
    data[o + AGE] = a.age;
    data[o + MAX_AGE] = a.maxAge;
    data[o + VISION] = a.vision;
    data[o + SUGAR_METAB] = a.sugarMetab;
    data[o + SPICE_METAB] = a.spiceMetab;
    data[o + MOTIV] = Math.max(0, MOTIVATIONS.indexOf(a.motivation));
  }

  const cells = view.cells.slice();
  const maxCells = view.maxCells.slice();
  const spice = view.spice.slice();
  const maxSpice = view.maxSpice.slice();
  const occupants = view.occupants.slice();
  const ties = view.ties.slice();

  const frame: WorldFrame = {
    width: view.width,
    height: view.height,
    turn: view.turn,
    count,
    cells: cells.buffer,
    maxCells: maxCells.buffer,
    spice: spice.buffer,
    maxSpice: maxSpice.buffer,
    occupants: occupants.buffer,
    agents: data.buffer,
    ties: ties.buffer,
  };

  return {
    frame,
    transfer: [
      frame.cells,
      frame.maxCells,
      frame.spice,
      frame.maxSpice,
      frame.occupants,
      frame.agents,
      frame.ties,
    ],
  };
}

/** Rehydrate a posted frame into a `WorldView` (no copies — wraps the buffers). */
export function deserializeWorld(frame: WorldFrame): WorldView {
  const data = new Float32Array(frame.agents);
  const agents: RenderAgent[] = new Array(frame.count);
  for (let i = 0; i < frame.count; i++) {
    const o = i * STRIDE;
    agents[i] = {
      id: data[o + ID],
      alive: data[o + ALIVE] !== 0,
      x: data[o + X],
      y: data[o + Y],
      prevX: data[o + PREV_X],
      prevY: data[o + PREV_Y],
      sugar: data[o + SUGAR],
      spice: data[o + SPICE],
      age: data[o + AGE],
      maxAge: data[o + MAX_AGE],
      vision: data[o + VISION],
      sugarMetab: data[o + SUGAR_METAB],
      spiceMetab: data[o + SPICE_METAB],
      motivation: MOTIVATIONS[data[o + MOTIV]] ?? "material",
    };
  }

  return {
    width: frame.width,
    height: frame.height,
    turn: frame.turn,
    cells: new Float32Array(frame.cells),
    maxCells: new Float32Array(frame.maxCells),
    spice: new Float32Array(frame.spice),
    maxSpice: new Float32Array(frame.maxSpice),
    occupants: new Int32Array(frame.occupants),
    agents,
    ties: new Float32Array(frame.ties),
  };
}
