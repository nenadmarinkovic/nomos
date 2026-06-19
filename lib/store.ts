"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_CONFIG, type SimulationConfig } from "@/lib/config";

interface SimulationState {
  config: SimulationConfig;
  running: boolean;
  turn: number;
  setConfig: (next: SimulationConfig) => void;
  patchConfig: (patch: Partial<SimulationConfig>) => void;
  resetConfig: () => void;
  startRun: (next?: SimulationConfig) => void;
  pauseRun: () => void;
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      running: false,
      turn: 0,
      setConfig: (next) => set({ config: next }),
      patchConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),
      resetConfig: () => set({ config: DEFAULT_CONFIG }),
      startRun: (next) =>
        set((s) => ({
          config: next ?? s.config,
          running: true,
          turn: 0,
        })),
      pauseRun: () => set({ running: false }),
    }),
    {
      name: "nomos-simulation",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ config: s.config }),
    },
  ),
);
