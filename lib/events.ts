import type { AgentMotivation } from "@/lib/config";
import type { EngineSnapshot } from "@/lib/engine";

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
  | "cooperation_thickens"
  | "network_fracture"
  | "extreme_inequality"
  | "oligarchy"
  | "shock_blight"
  | "shock_plague"
  | "leadership_emerges"
  | "bank_run"
  | "passage";

export interface MetricPoint {
  turn: number;
  alive: number;
  gini: number;
  tradePrice: number;
  segregation: number;
  isolateShare: number;
  motivationShares: Record<AgentMotivation, number>;
}

export interface EventMetrics {
  turn: number;
  alive: number;
  gini: number;
  totalWealth: number;
  deltaAlive: number;
  deltaGini: number;
  topWealthShare: number;
  tradePrice: number;
  tradeVolume: number;
  segregation: number;
  coercionCount: number;
  shamingCount: number;
  isolateShare: number;
  risingMotivation?: AgentMotivation;
  motivationFrom?: number;
  motivationTo?: number;
  tokenSupply: number;
  circulatingIssuers: number;
  tokenTradeVolume: number;
  topInfluencerCentrality?: number;
  topIssuerMistrust?: number;
}

export interface SignificantEvent {
  id: string;
  turn: number;
  kind: EventKind;
  title: string;
  summary: string;
  severity: "minor" | "major";
  metrics: EventMetrics;
}

export interface DetectorState {
  peakAlive: number;
  lastEventTurn: number | null;
  marketFormed: boolean;
  segregationArmed: boolean;
  giniHighSince: number | null;
  topShareHighSince: number | null;
  extremeInequalityArmed: boolean;
  oligarchyArmed: boolean;
  consecutivePassages: number;
  lastFireByKind: Partial<Record<EventKind, number>>;
  leadershipArmed: boolean;
}

const WINDOW = 8;
const COOLDOWN = 12;
const KIND_COOLDOWN: Partial<Record<EventKind, number>> = {
  coercion_wave: 60,
  cooperation_thickens: 60,
};

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
  cooperation_thickens: "Cooperation takes hold",
  network_fracture: "The web of trade frays",
  extreme_inequality: "Inequality calcifies",
  oligarchy: "An oligarchy consolidates",
  shock_blight: "Blight on the land",
  shock_plague: "Plague sweeps through",
  leadership_emerges: "An anchor of trust appears",
  bank_run: "The token loses its footing",
  passage: "The chronicle continues",
};

const MOTIVATION_LABEL: Record<AgentMotivation, string> = {
  material: "material gain",
  symbolic: "status and display",
  normative: "shared norms and fair dealing",
  power: "domination over others",
};

const PASSAGE_INTERVAL = 30;
const MAX_CONSECUTIVE_PASSAGES = 3;

const MARKET_THRESHOLD = 12;

const COERCION_FLOOR = 3;
const COERCION_RATE = 0.004;

const SEGREGATION_LINE = 0.18;
const SEGREGATION_REARM = 0.12;

const MOTIVATION_SURGE = 0.05;

const EXTREME_INEQUALITY_LEVEL = 0.6;
const EXTREME_INEQUALITY_REARM = 0.5;
const OLIGARCHY_LEVEL = 0.8;
const OLIGARCHY_REARM = 0.6;
const SUSTAINED_HIGH_DURATION = 80;
const MOTIVATION_DOMINANCE = 0.4;

const ISOLATE_SURGE = 0.15;
const ISOLATE_LEVEL = 0.4;

/** Leadership signal: absolute tie-weight (engine TIE_CAP = 8). Bench
 *  shows the anchor sits between 60 and 130 in normal runs, so 80 makes
 *  the event register a genuinely dominant node, not a routine graph. */
const LEADERSHIP_LEVEL = 80;
const LEADERSHIP_REARM = 45;

export function detectEvent(
  snapshot: EngineSnapshot,
  history: MetricPoint[],
  state: DetectorState,
): SignificantEvent | null {
  const { turn, alive, gini, wealthBins, tradePrice, tradeVolume } = snapshot;
  const total = wealthBins.reduce((s, n) => s + n, 0);
  const topWealthShare =
    total > 0 ? wealthBins[wealthBins.length - 1] / total : 0;

  if (turn === 0) {
    return makeEvent("founding", "major", snapshot, {
      deltaAlive: 0,
      deltaGini: 0,
      topWealthShare,
    });
  }

  const ref = referencePoint(history, turn);
  if (!ref) return null;

  if (state.lastEventTurn !== null && turn - state.lastEventTurn < COOLDOWN) {
    return null;
  }

  const respectsKindCooldown = (kind: EventKind): boolean => {
    const limit = KIND_COOLDOWN[kind];
    if (limit === undefined) return true;
    const last = state.lastFireByKind[kind];
    return last === undefined || turn - last >= limit;
  };

  const deltaAlive = alive - ref.alive;
  const deltaGini = gini - ref.gini;
  const alivePct = ref.alive > 0 ? deltaAlive / ref.alive : 0;
  const shared = { deltaAlive, deltaGini, topWealthShare };

  // Shocks first — the seenRef dedup in the caller handles same-turn repeats.
  if ((snapshot.plagueDeathsThisTurn ?? 0) > 0) {
    return makeEvent("shock_plague", "major", snapshot, {
      ...shared,
      deltaAlive: -(snapshot.plagueDeathsThisTurn ?? 0),
    });
  }
  if (snapshot.blightActive && snapshot.blightStartedTurn === turn) {
    return makeEvent("shock_blight", "major", snapshot, shared);
  }

  if (!state.marketFormed && tradeVolume >= MARKET_THRESHOLD) {
    state.marketFormed = true;
    return makeEvent("market_forming", "major", snapshot, shared);
  }

  if (state.peakAlive > 20 && alive <= state.peakAlive * 0.18) {
    return makeEvent("collapse", "major", snapshot, shared);
  }

  if (alivePct <= -0.25) {
    return makeEvent("population_crash", "major", snapshot, shared);
  }

  if (deltaGini >= 0.05) {
    return makeEvent("inequality_surge", "major", snapshot, shared);
  }

  if (ref.gini < 0.5 && gini >= 0.5) {
    return makeEvent("stratification", "major", snapshot, shared);
  }

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

  // Cooperation thickening: money circulating, or most predation sanctioned.
  // Per-kind cooldown only — a hysteresis latch here would go silent under
  // sustained cooperation, exactly when it should be firing.
  const circulating = snapshot.circulatingIssuers ?? 0;
  const sanctioned =
    (snapshot.coercionCount ?? 0) >= 3 &&
    (snapshot.shamingCount ?? 0) >= (snapshot.coercionCount ?? 0) * 0.5;
  if (
    (circulating >= 1 || sanctioned) &&
    respectsKindCooldown("cooperation_thickens")
  ) {
    return makeEvent("cooperation_thickens", "major", snapshot, shared);
  }

  const coercionFloor = Math.max(
    COERCION_FLOOR,
    Math.round(alive * COERCION_RATE),
  );
  if (
    (snapshot.coercionCount ?? 0) >= coercionFloor &&
    respectsKindCooldown("coercion_wave")
  ) {
    return makeEvent(
      "coercion_wave",
      (snapshot.shamingCount ?? 0) > 0 ? "major" : "minor",
      snapshot,
      shared,
    );
  }

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

  const shift = detectMotivationShift(snapshot, ref);
  if (shift) {
    return makeEvent("motivation_shift", "minor", snapshot, {
      ...shared,
      ...shift,
    });
  }

  const refIso = ref.isolateShare ?? snapshot.isolateShare ?? 0;
  if (
    (snapshot.isolateShare ?? 0) - refIso >= ISOLATE_SURGE &&
    (snapshot.isolateShare ?? 0) >= ISOLATE_LEVEL
  ) {
    return makeEvent("network_fracture", "minor", snapshot, shared);
  }

  if (snapshot.bankRunActive && snapshot.bankRunStartedTurn === turn) {
    return makeEvent("bank_run", "major", snapshot, shared);
  }

  const centrality = snapshot.topInfluencerCentrality ?? 0;
  if (centrality < LEADERSHIP_REARM) state.leadershipArmed = true;
  if (state.leadershipArmed && centrality >= LEADERSHIP_LEVEL) {
    state.leadershipArmed = false;
    return makeEvent("leadership_emerges", "minor", snapshot, shared);
  }

  if (gini >= EXTREME_INEQUALITY_LEVEL) {
    if (state.giniHighSince === null) state.giniHighSince = turn;
    if (
      state.extremeInequalityArmed &&
      state.giniHighSince !== null &&
      turn - state.giniHighSince >= SUSTAINED_HIGH_DURATION
    ) {
      state.extremeInequalityArmed = false;
      return makeEvent("extreme_inequality", "major", snapshot, shared);
    }
  } else {
    state.giniHighSince = null;
    if (gini <= EXTREME_INEQUALITY_REARM) state.extremeInequalityArmed = true;
  }

  if (topWealthShare >= OLIGARCHY_LEVEL) {
    if (state.topShareHighSince === null) state.topShareHighSince = turn;
    if (
      state.oligarchyArmed &&
      state.topShareHighSince !== null &&
      turn - state.topShareHighSince >= SUSTAINED_HIGH_DURATION
    ) {
      state.oligarchyArmed = false;
      return makeEvent("oligarchy", "major", snapshot, shared);
    }
  } else {
    state.topShareHighSince = null;
    if (topWealthShare <= OLIGARCHY_REARM) state.oligarchyArmed = true;
  }

  if (
    state.lastEventTurn !== null &&
    turn - state.lastEventTurn >= PASSAGE_INTERVAL &&
    state.consecutivePassages < MAX_CONSECUTIVE_PASSAGES
  ) {
    return makeEvent("passage", "minor", snapshot, shared);
  }

  return null;
}

function detectMotivationShift(
  snapshot: EngineSnapshot,
  ref: MetricPoint,
): Pick<
  EventMetrics,
  "risingMotivation" | "motivationFrom" | "motivationTo"
> | null {
  if (snapshot.alive <= 0 || !ref.motivationShares) return null;
  const counts = snapshot.motivationCounts;
  const keys = Object.keys(counts) as AgentMotivation[];

  let best: AgentMotivation | null = null;
  let bestDelta = 0;
  for (const k of keys) {
    const now = counts[k] / snapshot.alive;
    const was = ref.motivationShares[k] ?? 0;
    const delta = now - was;
    if (
      now >= MOTIVATION_DOMINANCE &&
      delta >= MOTIVATION_SURGE &&
      delta > bestDelta
    ) {
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
  return ref ?? history[0];
}

function makeEvent(
  kind: EventKind,
  severity: "minor" | "major",
  snapshot: EngineSnapshot,
  partial: Pick<EventMetrics, "deltaAlive" | "deltaGini" | "topWealthShare"> &
    Partial<
      Pick<EventMetrics, "risingMotivation" | "motivationFrom" | "motivationTo">
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
    tokenSupply: snapshot.tokenSupply ?? 0,
    circulatingIssuers: snapshot.circulatingIssuers ?? 0,
    tokenTradeVolume: snapshot.tokenTradeVolume ?? 0,
    topInfluencerCentrality: snapshot.topInfluencerCentrality ?? 0,
    topIssuerMistrust: snapshot.topIssuerMistrust ?? 0,
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
    case "cooperation_thickens": {
      const parts: string[] = [];
      if (m.circulatingIssuers >= 1) {
        const noun = m.circulatingIssuers === 1 ? "agent's" : "agents'";
        parts.push(
          `${m.circulatingIssuers} ${noun} promises-to-pay are now held by three or more others, the first sign of a circulating medium of exchange`,
        );
      }
      if (m.coercionCount >= 3 && m.shamingCount >= m.coercionCount * 0.5) {
        parts.push(
          `${m.shamingCount} of the ${m.coercionCount} seizures this turn drew an immediate sanction from witnesses, who refused further trade with the aggressors`,
        );
      }
      const detail = parts.length > 0 ? parts.join("; ") + "." : "";
      const tokens =
        m.tokenSupply > 0
          ? ` Around ${Math.round(m.tokenSupply)} tokens are in circulation, with ${m.tokenTradeVolume} token-paid trades this turn.`
          : "";
      return `By turn ${m.turn} cooperation is taking hold rather than fraying. ${detail}${tokens} ${alive} agents are alive, Gini ${gini}.`;
    }
    case "network_fracture": {
      const iso = Math.round(m.isolateShare * 100);
      return `By turn ${m.turn} the web of trade is thinning: ${iso}% of the living population now exchanges with no one as established ties dissolve faster than new ones form. ${alive} agents are alive, Gini ${gini}.`;
    }
    case "passage":
      return `Turn ${m.turn}. ${alive} agents are alive, holding a combined ${wealth} in wealth. The Gini coefficient stands at ${gini}; the wealthiest tier holds ${topPct}% of the population's standing.${m.tradePrice > 0 ? ` Trade clears at about ${price} units of sugar per unit of spice.` : " No active market this turn."} Nothing has lurched, but the society continues.`;
    case "extreme_inequality":
      return `By turn ${m.turn} extreme inequality is no longer a passing phase but the settled order: the Gini coefficient has held at or above 0.60 for a long stretch, currently ${gini}, with the wealthiest tier holding ${topPct}% of the standing. ${alive} agents are alive; this is not the surge but the calcification.`;
    case "oligarchy":
      return `By turn ${m.turn} the top wealth tier has held more than 80% of the population's standing for a sustained period (now ${topPct}%). A small elite has consolidated; the rest of the ${alive} living agents share the remainder. Gini sits at ${gini}.`;
    case "shock_blight":
      return `At turn ${m.turn} a blight has fallen on the land: sugar regrowth has been cut sharply for a stretch. ${alive} agents are alive; Gini ${gini}. Its likelihood rose with how heavily the population had already worked the land — the substrate is answering the pressure.`;
    case "shock_plague":
      return `At turn ${m.turn} a wave of mortality sweeps the population: ${dAlive} agents died at random in a single turn, leaving ${alive} alive. Gini sits at ${gini}. This is not famine or starvation — it is contingency, the world reminding the society that it is not its own master.`;
    case "leadership_emerges": {
      const c = (m.topInfluencerCentrality ?? 0).toFixed(1);
      return `By turn ${m.turn} a single agent has accumulated more incoming trust than anyone else — total tie-weight ${c} — without holding any assigned office. Around this anchor, cooperation runs faster; ${alive} agents are alive, Gini ${gini}. It is a role produced by exchange, not conferred on it.`;
    }
    case "bank_run": {
      const share = Math.round((m.topIssuerMistrust ?? 0) * 100);
      return `At turn ${m.turn} confidence in the largest issuer's tokens collapses: ${share}% of the population has come to distrust them, and holders liquidate what they can. The IOUs that circulated as money moments ago cease to. ${alive} agents are alive, Gini ${gini}.`;
    }
  }
}

function signed(n: number, digits: number): string {
  const v = n.toFixed(digits);
  return n > 0 ? `+${v}` : v;
}
