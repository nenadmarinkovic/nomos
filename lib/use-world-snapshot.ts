"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { activeWorldRef } from "@/lib/active-world";
import { useSimulationStore } from "@/lib/store";
import type { WorldView } from "@/lib/world";

export interface WorldSnapshot<T> {
  data: T | null;
  turn: number;
  stale: boolean;
  refresh: () => void;
}

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
