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
import { pickObserver, resetObserverRotation } from "@/lib/observer-routing";
import { useSimulationStore } from "@/lib/store";

const MIN_NARRATION_INTERVAL_MS = 12000;

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
    lastFireByKind: {},
    leadershipArmed: true,
  });
  const seenRef = useRef<Set<string>>(new Set());
  const historyRef = useRef<MetricPoint[]>([]);
  /** Recent events for the observer prompt — kept here so pending narrations
   *  don't hide them. Capped at 5. */
  const recentEventsRef = useRef<
    { turn: number; kind: string; title: string }[]
  >([]);
  /** Last narration timestamp (ms). Detector cooldowns are per-turn, so at
   *  fast speeds they'd fire unreadably often; this gate keeps the perceived
   *  pace constant. Skipped events re-detect on the next tick. */
  const lastNarrationAtRef = useRef<number>(0);

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
      lastFireByKind: {},
      leadershipArmed: true,
    };
    seenRef.current = new Set();
    historyRef.current = [];
    recentEventsRef.current = [];
    lastNarrationAtRef.current = 0;
    resetObserverRotation();
  }, [runId]);

  useEffect(() => {
    if (!started) return;
    const observers = config.observers;
    if (observers.length === 0) return;

    // Local history keeps detection independent of the store's slicing.
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

    // Pace gate. Skip without touching latches — the event re-detects next tick.
    const now = Date.now();
    if (now - lastNarrationAtRef.current < MIN_NARRATION_INTERVAL_MS) {
      return;
    }
    lastNarrationAtRef.current = now;

    seenRef.current.add(event.id);
    detector.lastEventTurn = event.turn;
    detector.lastFireByKind[event.kind] = event.turn;
    // Reset the passage streak whenever a real event fires.
    if (event.kind === "passage") {
      detector.consecutivePassages += 1;
    } else {
      detector.consecutivePassages = 0;
    }

    const picked = pickObserver(event.kind, observers);
    if (!picked) return;

    openNarrations(event, [picked]);
    const world = worldSummary(config);
    const context = buildSimContext(snapshot, recentEventsRef.current);
    // Append *after* the prompt is built so "earlier this run" excludes the
    // event being narrated right now.
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
  };
}

function buildSimContext(
  snapshot: {
    alive: number;
    motivationCounts: {
      material: number;
      symbolic: number;
      normative: number;
      power: number;
    };
  },
  recentEvents: { turn: number; kind: string; title: string }[],
): SimContext {
  const counts = snapshot.motivationCounts;
  const total =
    counts.material + counts.symbolic + counts.normative + counts.power;
  const safeShare = (n: number) => (total > 0 ? n / total : 0);

  // Read the flat [lo, hi, weight, …] tie buffer the worker ships.
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
