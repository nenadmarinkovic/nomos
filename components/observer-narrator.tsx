"use client";

import { useEffect, useRef } from "react";

import {
  equalityBucket,
  LANDSCAPE_INFO,
  SCALE_INFO,
  type ObserverKey,
  type SimulationConfig,
} from "@/lib/config";
import {
  detectEvent,
  type DetectorState,
  type SignificantEvent,
} from "@/lib/events";
import type { WorldSummary } from "@/lib/observers";
import { useSimulationStore } from "@/lib/store";

/**
 * Headless component. It watches the simulation's macro metrics, detects the
 * rare significant events worth narrating, and dispatches one Mistral request
 * per active observer per event through /api/observe. Results land in the
 * chronicle slice of the store, which the ChroniclePanel renders.
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
  });
  const seenRef = useRef<Set<string>>(new Set());
  const historyRef = useRef<
    { turn: number; alive: number; gini: number; tradePrice: number }[]
  >([]);

  // Reset everything when a new run begins.
  useEffect(() => {
    detectorRef.current = {
      peakAlive: 0,
      lastEventTurn: null,
      marketFormed: false,
    };
    seenRef.current = new Set();
    historyRef.current = [];
  }, [runId]);

  useEffect(() => {
    if (!started) return;
    const observers = config.observers;
    if (observers.length === 0) return;

    // Maintain our own lightweight history so detection is independent of the
    // store's render-time slicing.
    const hist = historyRef.current;
    if (hist.length === 0 || hist[hist.length - 1].turn !== snapshot.turn) {
      hist.push({
        turn: snapshot.turn,
        alive: snapshot.alive,
        gini: snapshot.gini,
        tradePrice: snapshot.tradePrice,
      });
      if (hist.length > 300) hist.shift();
    }

    const detector = detectorRef.current;
    detector.peakAlive = Math.max(detector.peakAlive, snapshot.alive);

    const event = detectEvent(snapshot, hist, detector);
    if (!event || seenRef.current.has(event.id)) return;

    seenRef.current.add(event.id);
    detector.lastEventTurn = event.turn;

    openNarrations(event, observers);
    const world = worldSummary(config);
    for (const observer of observers) {
      void requestNarration(observer, event, world, {
        resolve: resolveNarration,
        fail: failNarration,
      });
    }
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

async function requestNarration(
  observer: ObserverKey,
  event: SignificantEvent,
  world: WorldSummary,
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
      body: JSON.stringify({ observer, event, world }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      text?: string;
      error?: string;
    };
    if (!res.ok || !data.text) {
      handlers.fail(entryKey, data.error ?? `Request failed (${res.status})`);
      return;
    }
    handlers.resolve(entryKey, data.text);
  } catch (err) {
    handlers.fail(
      entryKey,
      err instanceof Error ? err.message : "Network error",
    );
  }
}
