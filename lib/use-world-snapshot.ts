"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { activeWorldRef } from "@/lib/active-world";
import { useSimulationStore } from "@/lib/store";
import type { WorldView } from "@/lib/world";

export interface WorldSnapshot<T> {
  data: T | null;
  /** Engine turn the snapshot was captured at. */
  turn: number;
  /** True while the snapshot is older than the latest live turn. */
  stale: boolean;
  /** Take a fresh sample now. */
  refresh: () => void;
}

/**
 * One-shot snapshot of the world. Samples once on mount, then never again
 * unless the user calls `refresh()`. The simulation keeps running in the
 * background — this just freezes what the page is rendering until the user
 * asks for fresh data.
 *
 * Heavy projections (table rows, chart data, derived stats) run **once per
 * page visit** instead of every tick. This is what makes secondary pages
 * snappy at Max simulation speed.
 */
export function useWorldSnapshot<T>(
  project: (world: WorldView) => T,
): WorldSnapshot<T> {
  const liveTurn = useSimulationStore((s) => s.turn);
  const started = useSimulationStore((s) => s.started);

  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const [snap, setSnap] = useState<{ data: T | null; turn: number }>(() => ({
    data: null,
    turn: 0,
  }));

  const sample = useCallback(() => {
    const world = activeWorldRef.current;
    if (!world) {
      setSnap({ data: null, turn: 0 });
      return;
    }
    setSnap({ data: projectRef.current(world), turn: world.turn });
  }, []);

  // Take exactly one sample on mount (and whenever the run identity changes).
  useEffect(() => {
    if (!started) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnap({ data: null, turn: 0 });
      return;
    }
    sample();
  }, [started, sample]);

  return {
    data: snap.data,
    turn: snap.turn,
    stale: liveTurn > snap.turn,
    refresh: sample,
  };
}

/**
 * Freeze a store-derived value at the moment a snapshot is taken. Re-binds
 * only when `tickToBindAt` changes — i.e. on a manual refresh.
 */
export function useStoreSnapshot<T>(current: T, tickToBindAt: number): T {
  const [captured, setCaptured] = useState(current);
  const lastTickRef = useRef(tickToBindAt);
  useEffect(() => {
    if (tickToBindAt === lastTickRef.current) return;
    lastTickRef.current = tickToBindAt;
    setCaptured(current);
  }, [current, tickToBindAt]);
  return captured;
}
