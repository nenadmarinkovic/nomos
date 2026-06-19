"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_CONFIG,
  newSeed,
  type SimulationConfig,
} from "@/lib/config";
import type { EngineSnapshot } from "@/lib/engine";

const EMPTY_SNAPSHOT: EngineSnapshot = {
  turn: 0,
  alive: 0,
  gini: 0,
  totalWealth: 0,
  wealthBins: [0, 0, 0, 0, 0, 0],
};

export interface HistoryPoint {
  turn: number;
  alive: number;
  gini: number;
}

const HISTORY_LIMIT = 240;

export type ViewKey = "gini" | "alive" | "wealth";

interface SimulationState {
  config: SimulationConfig;
  running: boolean;
  started: boolean;
  turn: number;
  runId: number;
  snapshot: EngineSnapshot;
  history: HistoryPoint[];
  speed: number;
  canvasSize: { width: number; height: number };
  views: Record<ViewKey, boolean>;
  startRun: (next?: SimulationConfig) => void;
  resumeRun: () => void;
  pauseRun: () => void;
  stopRun: () => void;
  setSpeed: (speed: number) => void;
  updateSnapshot: (snapshot: EngineSnapshot) => void;
  setCanvasSize: (s: { width: number; height: number }) => void;
  toggleView: (key: ViewKey) => void;
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      running: false,
      started: false,
      turn: 0,
      runId: 0,
      snapshot: EMPTY_SNAPSHOT,
      history: [],
      speed: 1,
      canvasSize: { width: 0, height: 0 },
      views: { gini: true, alive: true, wealth: true },
      startRun: (next) =>
        set((s) => ({
          config: { ...(next ?? s.config), seed: newSeed() },
          running: true,
          started: true,
          turn: 0,
          runId: s.runId + 1,
          snapshot: EMPTY_SNAPSHOT,
          history: [],
        })),
      resumeRun: () => set({ running: true }),
      pauseRun: () => set({ running: false }),
      stopRun: () =>
        set({
          running: false,
          started: false,
          turn: 0,
          snapshot: EMPTY_SNAPSHOT,
          history: [],
        }),
      setSpeed: (speed) => set({ speed }),
      setCanvasSize: (canvasSize) => set({ canvasSize }),
      toggleView: (key) =>
        set((s) => ({ views: { ...s.views, [key]: !s.views[key] } })),
      updateSnapshot: (snapshot) =>
        set((s) => {
          const next = s.history.slice(
            Math.max(0, s.history.length - HISTORY_LIMIT + 1),
          );
          next.push({
            turn: snapshot.turn,
            alive: snapshot.alive,
            gini: snapshot.gini,
          });
          return { snapshot, turn: snapshot.turn, history: next };
        }),
    }),
    {
      name: "nomos-simulation",
      version: 7,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ config: s.config, views: s.views }),
      migrate: () => ({
        config: DEFAULT_CONFIG,
        views: { gini: true, alive: true, wealth: true },
      }),
    },
  ),
);
