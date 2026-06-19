"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  DEFAULT_CONFIG,
  newSeed,
  type ObserverKey,
  type SimulationConfig,
} from "@/lib/config";
import type { EngineSnapshot } from "@/lib/engine";
import type { EventKind, SignificantEvent } from "@/lib/events";

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
const CHRONICLE_LIMIT = 80;

export type ViewKey = "gini" | "alive" | "wealth";

export type NarrationStatus = "pending" | "done" | "error";

/** One observer's reading of one significant event. */
export interface ChronicleEntry {
  key: string;
  eventId: string;
  turn: number;
  observer: ObserverKey;
  eventKind: EventKind;
  eventTitle: string;
  status: NarrationStatus;
  text: string | null;
  error: string | null;
  createdAt: number;
}

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
  chronicle: ChronicleEntry[];
  startRun: (next?: SimulationConfig) => void;
  resumeRun: () => void;
  pauseRun: () => void;
  stopRun: () => void;
  setSpeed: (speed: number) => void;
  updateSnapshot: (snapshot: EngineSnapshot) => void;
  setCanvasSize: (s: { width: number; height: number }) => void;
  toggleView: (key: ViewKey) => void;
  openNarrations: (event: SignificantEvent, observers: ObserverKey[]) => void;
  resolveNarration: (key: string, text: string) => void;
  failNarration: (key: string, error: string) => void;
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
      chronicle: [],
      startRun: (next) =>
        set((s) => ({
          config: { ...(next ?? s.config), seed: newSeed() },
          running: true,
          started: true,
          turn: 0,
          runId: s.runId + 1,
          snapshot: EMPTY_SNAPSHOT,
          history: [],
          chronicle: [],
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
          chronicle: [],
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
      openNarrations: (event, observers) =>
        set((s) => {
          const now = Date.now();
          const pending: ChronicleEntry[] = observers.map((observer) => ({
            key: `${event.id}:${observer}`,
            eventId: event.id,
            turn: event.turn,
            observer,
            eventKind: event.kind,
            eventTitle: event.title,
            status: "pending",
            text: null,
            error: null,
            createdAt: now,
          }));
          const merged = [...s.chronicle, ...pending];
          return {
            chronicle:
              merged.length > CHRONICLE_LIMIT
                ? merged.slice(merged.length - CHRONICLE_LIMIT)
                : merged,
          };
        }),
      resolveNarration: (key, text) =>
        set((s) => ({
          chronicle: s.chronicle.map((e) =>
            e.key === key ? { ...e, status: "done", text, error: null } : e,
          ),
        })),
      failNarration: (key, error) =>
        set((s) => ({
          chronicle: s.chronicle.map((e) =>
            e.key === key ? { ...e, status: "error", error } : e,
          ),
        })),
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
