"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_CONFIG,
  newSeed,
  type SimulationConfig,
} from "@/lib/config";

interface SimulationState {
  config: SimulationConfig;
  running: boolean;
  started: boolean;
  turn: number;
  startRun: (next?: SimulationConfig) => void;
  resumeRun: () => void;
  pauseRun: () => void;
  stopRun: () => void;
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      running: false,
      started: false,
      turn: 0,
      startRun: (next) =>
        set((s) => ({
          config: { ...(next ?? s.config), seed: newSeed() },
          running: true,
          started: true,
          turn: 0,
        })),
      resumeRun: () => set({ running: true }),
      pauseRun: () => set({ running: false }),
      stopRun: () => set({ running: false, started: false, turn: 0 }),
    }),
    {
      name: "nomos-simulation",
      version: 5,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ config: s.config }),
    },
  ),
);
