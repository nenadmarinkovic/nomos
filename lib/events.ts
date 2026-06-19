import type { EngineSnapshot } from "@/lib/engine";

/**
 * Significant-event detection.
 *
 * The observers do not narrate every tick — that would be noise (and a Mistral
 * call per observer per tick). Instead we watch the macro metrics and surface
 * the handful of moments that actually mean something: a founding, a crash, a
 * surge in inequality, a collapse. Each detected event carries a factual
 * summary that becomes the raw material a theorist reads through their lens.
 */

export type EventKind =
  | "founding"
  | "inequality_surge"
  | "leveling"
  | "stratification"
  | "population_crash"
  | "population_boom"
  | "collapse";

export interface MetricPoint {
  turn: number;
  alive: number;
  gini: number;
}

export interface EventMetrics {
  turn: number;
  alive: number;
  gini: number;
  totalWealth: number;
  /** Change in living population over the detection window. */
  deltaAlive: number;
  /** Change in Gini over the detection window. */
  deltaGini: number;
  /** Share of the living population sitting in the wealthiest bin (0..1). */
  topWealthShare: number;
}

export interface SignificantEvent {
  id: string;
  turn: number;
  kind: EventKind;
  /** Short human-readable label for the chronicle. */
  title: string;
  /** Factual, theory-neutral description handed to the model. */
  summary: string;
  severity: "minor" | "major";
  metrics: EventMetrics;
}

export interface DetectorState {
  /** Highest living population seen so far this run. */
  peakAlive: number;
  /** Turn of the last event we emitted, or null if none yet. */
  lastEventTurn: number | null;
}

/** Turns back we compare against when measuring change. */
const WINDOW = 8;
/** Minimum turns between non-founding events, to keep narration sparse. */
const COOLDOWN = 6;

const TITLES: Record<EventKind, string> = {
  founding: "The founding",
  inequality_surge: "Inequality surges",
  leveling: "The gap narrows",
  stratification: "Society stratifies",
  population_crash: "Population crashes",
  population_boom: "Population booms",
  collapse: "Collapse",
};

/**
 * Inspect the latest snapshot against recent history and return a single
 * significant event, or `null` if nothing notable happened this turn.
 */
export function detectEvent(
  snapshot: EngineSnapshot,
  history: MetricPoint[],
  state: DetectorState,
): SignificantEvent | null {
  const { turn, alive, gini, wealthBins } = snapshot;
  const total = wealthBins.reduce((s, n) => s + n, 0);
  const topWealthShare =
    total > 0 ? wealthBins[wealthBins.length - 1] / total : 0;

  // The founding: emitted once, before anything has happened.
  if (turn === 0) {
    return makeEvent("founding", "major", snapshot, {
      deltaAlive: 0,
      deltaGini: 0,
      topWealthShare,
    });
  }

  // Reference point ~WINDOW turns back for measuring change.
  const ref = referencePoint(history, turn);
  if (!ref) return null;

  if (state.lastEventTurn !== null && turn - state.lastEventTurn < COOLDOWN) {
    return null;
  }

  const deltaAlive = alive - ref.alive;
  const deltaGini = gini - ref.gini;
  const alivePct = ref.alive > 0 ? deltaAlive / ref.alive : 0;
  const shared = { deltaAlive, deltaGini, topWealthShare };

  // Collapse takes priority: the society is all but gone.
  if (state.peakAlive > 20 && alive <= state.peakAlive * 0.18) {
    return makeEvent("collapse", "major", snapshot, shared);
  }

  if (alivePct <= -0.25) {
    return makeEvent("population_crash", "major", snapshot, shared);
  }

  if (deltaGini >= 0.08) {
    return makeEvent("inequality_surge", "major", snapshot, shared);
  }

  // Crossing the 0.5 Gini line is a qualitative threshold of its own.
  if (ref.gini < 0.5 && gini >= 0.5) {
    return makeEvent("stratification", "major", snapshot, shared);
  }

  if (deltaGini <= -0.08) {
    return makeEvent("leveling", "minor", snapshot, shared);
  }

  if (alivePct >= 0.35 && deltaAlive >= 15) {
    return makeEvent("population_boom", "minor", snapshot, shared);
  }

  return null;
}

function referencePoint(
  history: MetricPoint[],
  turn: number,
): MetricPoint | null {
  if (history.length < 2) return null;
  const targetTurn = turn - WINDOW;
  let ref: MetricPoint | null = null;
  for (const p of history) {
    if (p.turn <= targetTurn) ref = p;
    else break;
  }
  // Fall back to the oldest point we have if the window predates the run.
  return ref ?? history[0];
}

function makeEvent(
  kind: EventKind,
  severity: "minor" | "major",
  snapshot: EngineSnapshot,
  partial: Pick<EventMetrics, "deltaAlive" | "deltaGini" | "topWealthShare">,
): SignificantEvent {
  const metrics: EventMetrics = {
    turn: snapshot.turn,
    alive: snapshot.alive,
    gini: snapshot.gini,
    totalWealth: snapshot.totalWealth,
    ...partial,
  };
  return {
    id: `${snapshot.turn}:${kind}`,
    turn: snapshot.turn,
    kind,
    title: TITLES[kind],
    summary: summarize(kind, metrics),
    severity,
    metrics,
  };
}

function summarize(kind: EventKind, m: EventMetrics): string {
  const gini = m.gini.toFixed(2);
  const alive = m.alive.toLocaleString();
  const wealth = Math.round(m.totalWealth).toLocaleString();
  const dGini = signed(m.deltaGini, 2);
  const dAlive = signed(m.deltaAlive, 0);
  const topPct = Math.round(m.topWealthShare * 100);

  switch (kind) {
    case "founding":
      return `Turn ${m.turn}. The society begins with ${alive} living agents, a Gini coefficient of ${gini}, and ${wealth} total wealth in circulation.`;
    case "inequality_surge":
      return `By turn ${m.turn} the Gini coefficient has climbed to ${gini} (${dGini} over recent turns). The wealthiest tier now holds ${topPct}% of the population's standing while ${alive} agents remain alive.`;
    case "leveling":
      return `By turn ${m.turn} the Gini coefficient has fallen to ${gini} (${dGini} over recent turns). Holdings are converging; ${alive} agents are alive.`;
    case "stratification":
      return `At turn ${m.turn} the Gini coefficient has crossed 0.5, reaching ${gini}. A distinct top tier holding ${topPct}% of standing has separated from the rest. ${alive} agents are alive.`;
    case "population_crash":
      return `Between recent turns the living population fell by ${dAlive} to ${alive} at turn ${m.turn}, while the Gini coefficient sits at ${gini}.`;
    case "population_boom":
      return `The living population has grown by ${dAlive} to ${alive} by turn ${m.turn}, with the Gini coefficient at ${gini}.`;
    case "collapse":
      return `By turn ${m.turn} the society has all but collapsed: only ${alive} agents remain alive, with a Gini coefficient of ${gini}.`;
  }
}

function signed(n: number, digits: number): string {
  const v = n.toFixed(digits);
  return n > 0 ? `+${v}` : v;
}
