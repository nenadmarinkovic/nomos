"use client";

import { useEffect, useRef } from "react";

import {
  equalityBucket,
  LANDSCAPE_INFO,
  SCALE_INFO,
  type ObserverKey,
  type SimulationConfig,
} from "@/lib/config";
import { activeWorldRef } from "@/lib/active-world";
import {
  detectEvent,
  type DetectorState,
  type MetricPoint,
  type SignificantEvent,
} from "@/lib/events";
import type { SimContext, WorldSummary } from "@/lib/observers";
import {
  pickObserver,
  resetObserverRotation,
} from "@/lib/observer-routing";
import { useSimulationStore } from "@/lib/store";

/**
 * Headless component. Watches the simulation's macro metrics, detects the
 * rare significant events worth narrating, picks the single best-fit
 * observer for each event (via `pickObserver`), and dispatches one Mistral
 * request through /api/observe. Across the run the user still hears every
 * voice — different events route to different theorists — but no moment
 * gets buried under N parallel paragraphs.
 *
 * Renders nothing.
 */
export function ObserverNarrator() {
  const started = useSimulationStore((s) => s.started);
  const runId = useSimulationStore((s) => s.runId);
  const snapshot = useSimulationStore((s) => s.snapshot);
  const config = useSimulationStore((s) => s.config);
  const openNarrations = useSimulationStore((s) => s.openNarrations);
  const resolveNarration = useSimulationStore((s) => s.resolveNarration);
  const failNarration = useSimulationStore((s) => s.failNarration);

  // Per-run detection state and the set of events already dispatched.
  const detectorRef = useRef<DetectorState>({
    peakAlive: 0,
    lastEventTurn: null,
    marketFormed: false,
    segregationArmed: true,
    giniHighSince: null,
    topShareHighSince: null,
    extremeInequalityArmed: true,
    oligarchyArmed: true,
    consecutivePassages: 0,
  });
  const seenRef = useRef<Set<string>>(new Set());
  const historyRef = useRef<MetricPoint[]>([]);
  /** Recent events, kept here (not in the chronicle store) so the observer
   *  prompt sees them even when narration is still pending. Capped at 5. */
  const recentEventsRef = useRef<
    { turn: number; kind: string; title: string }[]
  >([]);

  // Reset everything when a new run begins.
  useEffect(() => {
    detectorRef.current = {
      peakAlive: 0,
      lastEventTurn: null,
      marketFormed: false,
      segregationArmed: true,
      giniHighSince: null,
      topShareHighSince: null,
      extremeInequalityArmed: true,
      oligarchyArmed: true,
      consecutivePassages: 0,
    };
    seenRef.current = new Set();
    historyRef.current = [];
    recentEventsRef.current = [];
    resetObserverRotation();
  }, [runId]);

  useEffect(() => {
    if (!started) return;
    const observers = config.observers;
    if (observers.length === 0) return;

    // Maintain our own lightweight history so detection is independent of the
    // store's render-time slicing.
    const hist = historyRef.current;
    if (hist.length === 0 || hist[hist.length - 1].turn !== snapshot.turn) {
      const counts = snapshot.motivationCounts;
      const total = snapshot.alive > 0 ? snapshot.alive : 1;
      hist.push({
        turn: snapshot.turn,
        alive: snapshot.alive,
        gini: snapshot.gini,
        tradePrice: snapshot.tradePrice,
        segregation: snapshot.segregation,
        isolateShare: snapshot.isolateShare,
        motivationShares: {
          material: counts.material / total,
          symbolic: counts.symbolic / total,
          normative: counts.normative / total,
          power: counts.power / total,
        },
      });
      if (hist.length > 300) hist.shift();
    }

    const detector = detectorRef.current;
    detector.peakAlive = Math.max(detector.peakAlive, snapshot.alive);

    const event = detectEvent(snapshot, hist, detector);
    if (!event || seenRef.current.has(event.id)) return;

    seenRef.current.add(event.id);
    detector.lastEventTurn = event.turn;
    // Track consecutive passages so the detector can throttle the heartbeat
    // when the world has truly settled. Any non-passage event resets it.
    if (event.kind === "passage") {
      detector.consecutivePassages += 1;
    } else {
      detector.consecutivePassages = 0;
    }

    const picked = pickObserver(event.kind, observers);
    if (!picked) return;

    // Open a single chronicle entry for the chosen observer, then dispatch.
    openNarrations(event, [picked]);
    const world = worldSummary(config);
    const context = buildSimContext(snapshot, recentEventsRef.current);
    // Push this event to the rolling list *after* the prompt is built so
    // "earlier this run" actually means earlier — the current event is the
    // one being narrated, not part of the past.
    recentEventsRef.current = [
      ...recentEventsRef.current,
      { turn: event.turn, kind: event.kind, title: event.title },
    ].slice(-5);
    void requestNarration(picked, event, world, context, {
      resolve: resolveNarration,
      fail: failNarration,
    });
  }, [
    started,
    snapshot,
    config,
    openNarrations,
    resolveNarration,
    failNarration,
  ]);

  return null;
}

function worldSummary(config: SimulationConfig): WorldSummary {
  return {
    scale: SCALE_INFO[config.world.scale].label.toLowerCase(),
    landscape: LANDSCAPE_INFO[config.world.landscape].label.toLowerCase(),
    equality: equalityBucket(config.world.equality).label.toLowerCase(),
    reproduction: config.world.reproduction,
  };
}

/**
 * Assemble the macro signals the observer prompt should see in addition to
 * the triggering event: motivation mix, recent events, and a snapshot of
 * the trade-tie graph. Cheap — all data lives in already-computed snapshots
 * or refs.
 */
function buildSimContext(
  snapshot: { alive: number; motivationCounts: { material: number; symbolic: number; normative: number; power: number } },
  recentEvents: { turn: number; kind: string; title: string }[],
): SimContext {
  const counts = snapshot.motivationCounts;
  const total =
    counts.material + counts.symbolic + counts.normative + counts.power;
  const safeShare = (n: number) => (total > 0 ? n / total : 0);

  // Tie graph stats — derived from the flat triples buffer the worker ships.
  const world = activeWorldRef.current;
  let count = 0;
  let topWeight = 0;
  let isolatesShare = 0;
  if (world && world.ties.length > 0) {
    const ties = world.ties;
    count = ties.length / 3;
    const tiedIds = new Set<number>();
    for (let i = 0; i < ties.length; i += 3) {
      const w = ties[i + 2];
      if (w > topWeight) topWeight = w;
      tiedIds.add(ties[i] | 0);
      tiedIds.add(ties[i + 1] | 0);
    }
    if (snapshot.alive > 0) {
      isolatesShare = Math.max(0, 1 - tiedIds.size / snapshot.alive);
    }
  } else if (world && snapshot.alive > 0) {
    isolatesShare = 1;
  }

  return {
    motivationMix: {
      material: safeShare(counts.material),
      symbolic: safeShare(counts.symbolic),
      normative: safeShare(counts.normative),
      power: safeShare(counts.power),
    },
    recentEvents,
    ties: { count, topWeight, isolatesShare },
  };
}

/**
 * Tidy AI-generated narration text before it lands in the chronicle. Mistral
 * frequently emits em-dashes with no surrounding whitespace ("elite—just");
 * typographically that reads as a hyphen and disrupts the sentence. We force
 * the en-/em-dash convention with a single space on either side.
 */
function normalizeNarrationText(text: string): string {
  return text
    .replace(/\s*—\s*/g, " — ")
    .replace(/\s*–\s*/g, " – ")
    .trim();
}

async function requestNarration(
  observer: ObserverKey,
  event: SignificantEvent,
  world: WorldSummary,
  context: SimContext,
  handlers: {
    resolve: (key: string, text: string) => void;
    fail: (key: string, error: string) => void;
  },
): Promise<void> {
  const entryKey = `${event.id}:${observer}`;
  try {
    const res = await fetch("/api/observe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observer, event, world, context }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      text?: string;
      error?: string;
    };
    if (!res.ok || !data.text) {
      handlers.fail(entryKey, data.error ?? `Request failed (${res.status})`);
      return;
    }
    handlers.resolve(entryKey, normalizeNarrationText(data.text));
  } catch (err) {
    handlers.fail(
      entryKey,
      err instanceof Error ? err.message : "Network error",
    );
  }
}
