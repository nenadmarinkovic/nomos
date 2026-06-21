import type { AgentMotivation } from "@/lib/config";
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
  | "market_forming"
  | "price_shock"
  | "collapse"
  | "segregation"
  | "motivation_shift"
  | "coercion_wave"
  | "network_fracture"
  | "passage";

export interface MetricPoint {
  turn: number;
  alive: number;
  gini: number;
  /** Emergent exchange rate this turn (sugar per spice), 0 if no trade. */
  tradePrice: number;
  /** Spatial assortativity of motivation, 0..1. */
  segregation: number;
  /** Share (0..1) of living agents with no surviving trade tie. */
  isolateShare: number;
  /** Population share (0..1) per motivation at this point. */
  motivationShares: Record<AgentMotivation, number>;
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
  /** Emergent exchange rate this turn (sugar per spice), 0 if no trade. */
  tradePrice: number;
  /** Trades executed this turn. */
  tradeVolume: number;
  /** Spatial assortativity of motivation, 0..1. */
  segregation: number;
  /** Coercive seizures executed this turn. */
  coercionCount: number;
  /** Coercions this turn that drew a community sanction. */
  shamingCount: number;
  /** Share (0..1) of living agents trading with no one. */
  isolateShare: number;
  /** Motivation surging in a `motivation_shift`, if any. */
  risingMotivation?: AgentMotivation;
  /** Its population share at the window's start and now (0..1). */
  motivationFrom?: number;
  motivationTo?: number;
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
  /** Whether a market has already been announced this run. */
  marketFormed: boolean;
  /** Hysteresis latch for segregation: false after a sorting event fires,
   *  re-armed only once the index relaxes back below `SEGREGATION_REARM`, so
   *  oscillation around the line doesn't refire every cooldown. */
  segregationArmed: boolean;
}

/** Turns back we compare against when measuring change. */
const WINDOW = 8;
/** Minimum turns between non-founding events. At 1× speed (5 turns/sec)
 *  that's a little over two seconds between events — fast enough to keep
 *  the chronicle moving, slow enough that each reading still has weight. */
const COOLDOWN = 12;

const TITLES: Record<EventKind, string> = {
  founding: "The founding",
  inequality_surge: "Inequality surges",
  leveling: "The gap narrows",
  stratification: "Society stratifies",
  population_crash: "Population crashes",
  population_boom: "Population booms",
  market_forming: "A market emerges",
  price_shock: "Prices convulse",
  collapse: "Collapse",
  segregation: "The society sorts itself",
  motivation_shift: "A way of life spreads",
  coercion_wave: "The strong take",
  network_fracture: "The web of trade frays",
  passage: "The chronicle continues",
};

/** Human phrasing for each motivation, used in `motivation_shift` summaries. */
const MOTIVATION_LABEL: Record<AgentMotivation, string> = {
  material: "material gain",
  symbolic: "status and display",
  normative: "shared norms and fair dealing",
  power: "domination over others",
};

/** Turns of silence after which a heartbeat `passage` event fires regardless
 *  of whether anything notable happened. Keeps the chronicle alive during
 *  stable phases — observers comment on the current state instead of waiting
 *  for the next inflection. */
const PASSAGE_INTERVAL = 30;

/** Trades per turn before we call it a genuine market rather than barter noise. */
const MARKET_THRESHOLD = 12;

/** Coercion telemetry. A wave is called when seizures in a single turn clear
 *  both an absolute floor and a per-capita rate, so it scales with population
 *  instead of firing constantly at city scale. */
const COERCION_FLOOR = 3;
const COERCION_RATE = 0.012;

/** Segregation threshold. The index is noisy turn to turn, so we fire only
 *  when it crosses *up* through a genuinely notable level (having been below
 *  it at the window's start), not on every upward wobble. */
const SEGREGATION_LINE = 0.25;
const SEGREGATION_REARM = 0.15;

/** A motivation must gain at least this much population share over the window
 *  and reach at least this dominance for a takeover to register. */
const MOTIVATION_SURGE = 0.08;
const MOTIVATION_DOMINANCE = 0.4;

/** Isolation must climb this much over the window, to at least this level,
 *  before we call the trade web fractured. */
const ISOLATE_SURGE = 0.15;
const ISOLATE_LEVEL = 0.4;

/**
 * Inspect the latest snapshot against recent history and return a single
 * significant event, or `null` if nothing notable happened this turn.
 */
export function detectEvent(
  snapshot: EngineSnapshot,
  history: MetricPoint[],
  state: DetectorState,
): SignificantEvent | null {
  const { turn, alive, gini, wealthBins, tradePrice, tradeVolume } = snapshot;
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

  // The first time trade thickens into a real market.
  if (!state.marketFormed && tradeVolume >= MARKET_THRESHOLD) {
    state.marketFormed = true;
    return makeEvent("market_forming", "major", snapshot, shared);
  }

  // Collapse takes priority: the society is all but gone.
  if (state.peakAlive > 20 && alive <= state.peakAlive * 0.18) {
    return makeEvent("collapse", "major", snapshot, shared);
  }

  if (alivePct <= -0.25) {
    return makeEvent("population_crash", "major", snapshot, shared);
  }

  if (deltaGini >= 0.05) {
    return makeEvent("inequality_surge", "major", snapshot, shared);
  }

  // Crossing the 0.5 Gini line is a qualitative threshold of its own.
  if (ref.gini < 0.5 && gini >= 0.5) {
    return makeEvent("stratification", "major", snapshot, shared);
  }

  // A sharp swing in the exchange rate, once a market is actually running.
  if (
    state.marketFormed &&
    tradeVolume >= MARKET_THRESHOLD / 2 &&
    ref.tradePrice > 0 &&
    tradePrice > 0
  ) {
    const ratio = tradePrice / ref.tradePrice;
    if (ratio >= 1.6 || ratio <= 0.625) {
      return makeEvent("price_shock", "minor", snapshot, shared);
    }
  }

  if (deltaGini <= -0.05) {
    return makeEvent("leveling", "minor", snapshot, shared);
  }

  if (alivePct >= 0.35 && deltaAlive >= 15) {
    return makeEvent("population_boom", "minor", snapshot, shared);
  }

  // A burst of predation this turn — surfaces the combat subsystem directly
  // instead of waiting for it to register as a Gini move. Major when the
  // community actually sanctioned the aggressors.
  const coercionFloor = Math.max(
    COERCION_FLOOR,
    Math.round(alive * COERCION_RATE),
  );
  if ((snapshot.coercionCount ?? 0) >= coercionFloor) {
    return makeEvent(
      "coercion_wave",
      (snapshot.shamingCount ?? 0) > 0 ? "major" : "minor",
      snapshot,
      shared,
    );
  }

  // Spatial sorting — agents crossing up into a notably clustered regime.
  // Latched so a society hovering near the line reports the transition once,
  // not on every cooldown; re-arms when it relaxes back below the lower band.
  const seg = snapshot.segregation ?? 0;
  const refSeg = ref.segregation ?? 0;
  if (seg < SEGREGATION_REARM) state.segregationArmed = true;
  if (
    state.segregationArmed &&
    refSeg < SEGREGATION_LINE &&
    seg >= SEGREGATION_LINE
  ) {
    state.segregationArmed = false;
    return makeEvent("segregation", "minor", snapshot, shared);
  }

  // Cultural takeover — one motivation's population share has surged. Reads
  // cultural transmission and imitation, which are otherwise invisible to the
  // macro metrics.
  const shift = detectMotivationShift(snapshot, ref);
  if (shift) {
    return makeEvent("motivation_shift", "minor", snapshot, {
      ...shared,
      ...shift,
    });
  }

  // The trade web frays — isolation climbing as ties decay faster than they
  // form. Granovetter's structure dissolving.
  const refIso = ref.isolateShare ?? snapshot.isolateShare ?? 0;
  if (
    (snapshot.isolateShare ?? 0) - refIso >= ISOLATE_SURGE &&
    (snapshot.isolateShare ?? 0) >= ISOLATE_LEVEL
  ) {
    return makeEvent("network_fracture", "minor", snapshot, shared);
  }

  // Heartbeat — if the society has been quietly stable for long enough,
  // emit a passage event so the chronicle keeps moving. Routed observer
  // rotates so the user hears different voices on the same stable world.
  if (
    state.lastEventTurn !== null &&
    turn - state.lastEventTurn >= PASSAGE_INTERVAL
  ) {
    return makeEvent("passage", "minor", snapshot, shared);
  }

  return null;
}

/**
 * Detect whether a single motivation has captured a meaningful slice of the
 * population over the detection window. Compares each motivation's current
 * share against its share at the reference point and returns the strongest
 * riser that also clears the surge and dominance thresholds, or null.
 */
function detectMotivationShift(
  snapshot: EngineSnapshot,
  ref: MetricPoint,
): Pick<EventMetrics, "risingMotivation" | "motivationFrom" | "motivationTo"> | null {
  if (snapshot.alive <= 0 || !ref.motivationShares) return null;
  const counts = snapshot.motivationCounts;
  const keys = Object.keys(counts) as AgentMotivation[];

  let best: AgentMotivation | null = null;
  let bestDelta = 0;
  for (const k of keys) {
    const now = counts[k] / snapshot.alive;
    const was = ref.motivationShares[k] ?? 0;
    const delta = now - was;
    if (now >= MOTIVATION_DOMINANCE && delta >= MOTIVATION_SURGE && delta > bestDelta) {
      best = k;
      bestDelta = delta;
    }
  }
  if (!best) return null;
  return {
    risingMotivation: best,
    motivationFrom: ref.motivationShares[best] ?? 0,
    motivationTo: counts[best] / snapshot.alive,
  };
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
  partial: Pick<EventMetrics, "deltaAlive" | "deltaGini" | "topWealthShare"> &
    Partial<
      Pick<
        EventMetrics,
        "risingMotivation" | "motivationFrom" | "motivationTo"
      >
    >,
): SignificantEvent {
  const metrics: EventMetrics = {
    turn: snapshot.turn,
    alive: snapshot.alive,
    gini: snapshot.gini,
    totalWealth: snapshot.totalWealth,
    tradePrice: snapshot.tradePrice,
    tradeVolume: snapshot.tradeVolume,
    segregation: snapshot.segregation ?? 0,
    coercionCount: snapshot.coercionCount ?? 0,
    shamingCount: snapshot.shamingCount ?? 0,
    isolateShare: snapshot.isolateShare ?? 0,
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
  const price = m.tradePrice.toFixed(2);

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
    case "market_forming":
      return `By turn ${m.turn} exchange between agents has thickened into a market: ${m.tradeVolume} trades clear this turn at a price of about ${price} units of sugar per unit of spice. ${alive} agents are alive, with a Gini coefficient of ${gini}.`;
    case "price_shock":
      return `At turn ${m.turn} the exchange rate has swung sharply to about ${price} units of sugar per unit of spice across ${m.tradeVolume} trades, while ${alive} agents remain alive and the Gini coefficient sits at ${gini}.`;
    case "collapse":
      return `By turn ${m.turn} the society has all but collapsed: only ${alive} agents remain alive, with a Gini coefficient of ${gini}.`;
    case "segregation": {
      const seg = m.segregation.toFixed(2);
      return `By turn ${m.turn} the population is sorting itself in space: agents now sit beside others who share their disposition far more than chance would predict (a clustering index of ${seg}, where 0 is fully mixed and 1 is wholly separated). ${alive} agents are alive, Gini ${gini}.`;
    }
    case "motivation_shift": {
      const drive = MOTIVATION_LABEL[m.risingMotivation ?? "material"];
      const from = Math.round((m.motivationFrom ?? 0) * 100);
      const to = Math.round((m.motivationTo ?? 0) * 100);
      return `By turn ${m.turn} a single way of life is spreading: the share of agents who live for ${drive} has risen from ${from}% to ${to}% of the population. ${alive} agents are alive, Gini ${gini}.`;
    }
    case "coercion_wave": {
      const sanction =
        m.shamingCount > 0
          ? `, and ${m.shamingCount} of the aggressors were marked out and refused trade by those who saw it`
          : ", with no one moving to stop it";
      return `At turn ${m.turn} a wave of predation runs through the society: ${m.coercionCount} agents had wealth seized by stronger neighbours this turn${sanction}. ${alive} agents are alive, Gini ${gini}.`;
    }
    case "network_fracture": {
      const iso = Math.round(m.isolateShare * 100);
      return `By turn ${m.turn} the web of trade is thinning: ${iso}% of the living population now exchanges with no one as established ties dissolve faster than new ones form. ${alive} agents are alive, Gini ${gini}.`;
    }
    case "passage":
      return `Turn ${m.turn}. ${alive} agents are alive, holding a combined ${wealth} in wealth. The Gini coefficient stands at ${gini}; the wealthiest tier holds ${topPct}% of the population's standing.${m.tradePrice > 0 ? ` Trade clears at about ${price} units of sugar per unit of spice.` : " No active market this turn."} Nothing has lurched, but the society continues.`;
  }
}

function signed(n: number, digits: number): string {
  const v = n.toFixed(digits);
  return n > 0 ? `+${v}` : v;
}
