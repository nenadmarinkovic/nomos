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
  tradePrice: 0,
  tradeVolume: 0,
  motivationCounts: { material: 0, symbolic: 0, normative: 0, power: 0 },
  segregation: 0,
  coercionCount: 0,
  shamingCount: 0,
  tieCount: 0,
  isolateShare: 0,
  blightActive: false,
  blightStartedTurn: -9999,
  plagueDeathsThisTurn: 0,
  landDegradation: 0,
  tokenSupply: 0,
  tokenTradeVolume: 0,
  topIssuerId: -1,
  topIssuerLiability: 0,
  circulatingIssuers: 0,
  topInfluencerId: -1,
  topInfluencerCentrality: 0,
  topIssuerMistrust: 0,
  bankRunActive: false,
  bankRunStartedTurn: -9999,
};

export interface HistoryPoint {
  turn: number;
  alive: number;
  gini: number;
  tradePrice: number;
  tokenSupply: number;
  circulatingIssuers: number;
  topInfluencerCentrality: number;
  topIssuerMistrust: number;
  motivationCounts: {
    material: number;
    symbolic: number;
    normative: number;
    power: number;
  };
}

const HISTORY_LIMIT = 240;
const CHRONICLE_LIMIT = 80;

export type ViewKey =
  | "gini"
  | "alive"
  | "wealth"
  | "price"
  | "stream"
  | "narrator"
  | "money"
  | "trust"
  | "network";

export type WindowAnchor = "tl" | "tr" | "bl" | "br";

export interface WindowPosition {
  anchor: WindowAnchor;
  offsetX: number;
  offsetY: number;
}

export const WIN_WIDTH = 288;

export const WIN_HEIGHTS: Record<ViewKey, number> = {
  gini: 182,
  alive: 182,
  wealth: 182,
  price: 182,
  stream: 202,
  narrator: 182,
  money: 182,
  trust: 182,
  network: 380,
};

export const DEFAULT_WINDOW_POSITIONS: Record<ViewKey, WindowPosition> = {
  gini: { anchor: "tr", offsetX: 10, offsetY: 10 },
  narrator: { anchor: "tr", offsetX: 10, offsetY: 202 },
  price: { anchor: "tr", offsetX: 10, offsetY: 394 },
  alive: { anchor: "tr", offsetX: 10, offsetY: 586 },
  wealth: { anchor: "tl", offsetX: 10, offsetY: 10 },
  stream: { anchor: "tl", offsetX: 10, offsetY: 202 },
  money: { anchor: "tl", offsetX: 10, offsetY: 394 },
  trust: { anchor: "tl", offsetX: 10, offsetY: 596 },
  network: { anchor: "tl", offsetX: 10, offsetY: 798 },
};

export function resolveWindowPosition(
  pos: WindowPosition,
  key: ViewKey,
  container: { width: number; height: number },
): { x: number; y: number } {
  const W = container.width || 800;
  const H = container.height || 600;
  const winH = WIN_HEIGHTS[key];
  const x =
    pos.anchor === "tr" || pos.anchor === "br"
      ? W - WIN_WIDTH - pos.offsetX
      : pos.offsetX;
  const y =
    pos.anchor === "bl" || pos.anchor === "br"
      ? H - winH - pos.offsetY
      : pos.offsetY;
  return {
    x: Math.max(0, Math.min(Math.max(0, W - 40), x)),
    y: Math.max(0, Math.min(Math.max(0, H - 40), y)),
  };
}

export type NarrationStatus = "pending" | "done" | "error";

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
  canvasView: "field" | "network";
  canvasSize: { width: number; height: number };
  monochrome: boolean;
  views: Record<ViewKey, boolean>;
  windowPositions: Record<ViewKey, WindowPosition>;
  chronicle: ChronicleEntry[];
  startRun: (next?: SimulationConfig) => void;
  replayRun: (config: SimulationConfig) => void;
  resumeRun: () => void;
  pauseRun: () => void;
  stopRun: () => void;
  setSpeed: (speed: number) => void;
  setCanvasView: (view: "field" | "network") => void;
  toggleMonochrome: () => void;
  updateSnapshot: (snapshot: EngineSnapshot) => void;
  setCanvasSize: (s: { width: number; height: number }) => void;
  toggleView: (key: ViewKey) => void;
  setAllViews: (visible: boolean) => void;
  moveWindow: (key: ViewKey, position: WindowPosition) => void;
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
      canvasView: "field",
      canvasSize: { width: 0, height: 0 },
      monochrome: false,
      views: {
        gini: true,
        alive: false,
        wealth: false,
        price: false,
        stream: false,
        narrator: true,
        money: false,
        trust: false,
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
          monochrome: false,
        })),
      replayRun: (config) =>
        set((s) => ({
          // Keep the saved seed — engine is deterministic, replay is exact.
          config,
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
      setCanvasView: (canvasView) => set({ canvasView }),
      toggleMonochrome: () => set((s) => ({ monochrome: !s.monochrome })),
      setCanvasSize: (canvasSize) => set({ canvasSize }),
      toggleView: (key) =>
        set((s) => ({ views: { ...s.views, [key]: !s.views[key] } })),
      setAllViews: (visible) =>
        set((s) => {
          const next: Record<ViewKey, boolean> = { ...s.views };
          (Object.keys(next) as ViewKey[]).forEach((k) => {
            next[k] = visible;
          });
          return { views: next };
        }),
      moveWindow: (key, position) =>
        set((s) => ({
          windowPositions: { ...s.windowPositions, [key]: position },
        })),
      alignWindows: (corner) =>
        set((s) => {
          const order: ViewKey[] = [
            "gini",
            "alive",
            "wealth",
            "price",
            "stream",
            "narrator",
            "money",
            "trust",
            "network",
          ];
          const visible = order.filter((k) => s.views[k]);
          const margin = 10;
          const gap = 10;

          const cols = visible.length <= 2 ? 1 : 2;

          const columns: ViewKey[][] = Array.from({ length: cols }, () => []);
          visible.forEach((key, i) => {
            const col = i % cols;
            columns[col].push(key);
          });

          const positions = { ...s.windowPositions };

          columns.forEach((colKeys, colIdx) => {
            const offsetX = margin + colIdx * (WIN_WIDTH + gap);
            let offsetY = margin;
            for (const key of colKeys) {
              positions[key] = { anchor: corner, offsetX, offsetY };
              offsetY += WIN_HEIGHTS[key] + gap;
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
            tradePrice: snapshot.tradePrice,
            tokenSupply: snapshot.tokenSupply,
            circulatingIssuers: snapshot.circulatingIssuers,
            topInfluencerCentrality: snapshot.topInfluencerCentrality,
            topIssuerMistrust: snapshot.topIssuerMistrust,
            motivationCounts: snapshot.motivationCounts,
          });
          return { snapshot, turn: snapshot.turn, history: next };
        }),
      openNarrations: (event, observers) =>
        set((s) => {
          const now = Date.now();
          // Idempotent on `key` — safe under strict-mode double-mount.
          const existing = new Set(s.chronicle.map((e) => e.key));
          const pending: ChronicleEntry[] = observers
            .map((observer) => ({
              key: `${event.id}:${observer}`,
              eventId: event.id,
              turn: event.turn,
              observer,
              eventKind: event.kind,
              eventTitle: event.title,
              status: "pending" as const,
              text: null,
              error: null,
              createdAt: now,
            }))
            .filter((entry) => !existing.has(entry.key));
          if (pending.length === 0) return {};
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
      version: 22,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        config: s.config,
        monochrome: s.monochrome,
        views: s.views,
        windowPositions: s.windowPositions,
      }),
      migrate: () => ({
        config: DEFAULT_CONFIG,
        monochrome: false,
        views: {
          gini: true,
          alive: false,
          wealth: false,
          price: false,
          stream: false,
          narrator: true,
          money: false,
          trust: false,
          network: false,
        },
        windowPositions: DEFAULT_WINDOW_POSITIONS,
      }),
    },
  ),
);
