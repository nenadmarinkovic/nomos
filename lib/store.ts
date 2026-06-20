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

export type ViewKey =
  | "gini"
  | "alive"
  | "wealth"
  | "narrator"
  | "network";

export interface WindowPosition {
  x: number;
  y: number;
}

export const DEFAULT_WINDOW_POSITIONS: Record<ViewKey, WindowPosition> = {
  gini: { x: 20, y: 20 },
  alive: { x: 20, y: 230 },
  wealth: { x: 20, y: 440 },
  narrator: { x: 320, y: 20 },
  network: { x: 320, y: 280 },
};

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
  windowPositions: Record<ViewKey, WindowPosition>;
  chronicle: ChronicleEntry[];
  startRun: (next?: SimulationConfig) => void;
  resumeRun: () => void;
  pauseRun: () => void;
  stopRun: () => void;
  setSpeed: (speed: number) => void;
  updateSnapshot: (snapshot: EngineSnapshot) => void;
  setCanvasSize: (s: { width: number; height: number }) => void;
  toggleView: (key: ViewKey) => void;
  moveWindow: (key: ViewKey, position: WindowPosition) => void;
  resetWindows: () => void;
  alignWindows: (corner: "tl" | "tr" | "bl" | "br") => void;
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
      views: {
        gini: true,
        alive: true,
        wealth: true,
        narrator: true,
        network: false,
      },
      windowPositions: DEFAULT_WINDOW_POSITIONS,
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
      moveWindow: (key, position) =>
        set((s) => ({
          windowPositions: { ...s.windowPositions, [key]: position },
        })),
      resetWindows: () =>
        set({ windowPositions: DEFAULT_WINDOW_POSITIONS }),
      alignWindows: (corner) =>
        set((s) => {
          const order: ViewKey[] = [
            "gini",
            "alive",
            "wealth",
            "narrator",
            "network",
          ];
          const visible = order.filter((k) => s.views[k]);
          const W = s.canvasSize.width || 800;
          const H = s.canvasSize.height || 600;
          const winW = 288;
          const margin = 10;
          const gap = 10;

          /** Approximate rendered height per window. */
          const WIN_HEIGHTS: Record<ViewKey, number> = {
            gini: 180,
            alive: 180,
            wealth: 180,
            narrator: 220,
            network: 300,
          };

          const cols = visible.length <= 2 ? 1 : 2;

          // Row-major assignment: window i goes to column i % cols.
          // Then each column stacks independently using actual heights.
          const columns: ViewKey[][] = Array.from({ length: cols }, () => []);
          visible.forEach((key, i) => {
            const col = i % cols;
            columns[col].push(key);
          });

          const isRight = corner === "tr" || corner === "br";
          const isBottom = corner === "bl" || corner === "br";

          const positions = { ...s.windowPositions };

          columns.forEach((colKeys, colIdx) => {
            const x = isRight
              ? W - margin - winW - colIdx * (winW + gap)
              : margin + colIdx * (winW + gap);

            if (isBottom) {
              let yBottom = H - margin;
              for (let i = colKeys.length - 1; i >= 0; i--) {
                const key = colKeys[i];
                const h = WIN_HEIGHTS[key];
                const y = yBottom - h;
                positions[key] = { x: Math.max(0, x), y: Math.max(0, y) };
                yBottom = y - gap;
              }
            } else {
              let yTop = margin;
              for (const key of colKeys) {
                const h = WIN_HEIGHTS[key];
                positions[key] = {
                  x: Math.max(0, x),
                  y: Math.max(0, yTop),
                };
                yTop += h + gap;
              }
            }
          });

          return { windowPositions: positions };
        }),
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
      version: 9,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        config: s.config,
        views: s.views,
        windowPositions: s.windowPositions,
      }),
      migrate: () => ({
        config: DEFAULT_CONFIG,
        views: {
          gini: true,
          alive: true,
          wealth: true,
          narrator: true,
          network: false,
        },
        windowPositions: DEFAULT_WINDOW_POSITIONS,
      }),
    },
  ),
);
