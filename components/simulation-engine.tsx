"use client";

import { useEffect, useRef } from "react";

import {
  activeFrameAtRef,
  activeIntervalRef,
  activeWorldRef,
} from "@/lib/active-world";
import type { FrameMessage, WorkerInbound } from "@/lib/sim-worker-core";
import { useSimulationStore } from "@/lib/store";
import { deserializeWorld } from "@/lib/world";

const BASE_TICK_MS = 200;

/**
 * Owns the long-lived simulation worker. Mounted once at the AppShell root so
 * the engine continues ticking regardless of which page is currently shown.
 * Writes the latest world snapshot into `activeWorldRef`; pushes engine
 * metrics into the store via `updateSnapshot`. Renders nothing.
 */
export function SimulationEngine() {
  const config = useSimulationStore((s) => s.config);
  const started = useSimulationStore((s) => s.started);
  const running = useSimulationStore((s) => s.running);
  const runId = useSimulationStore((s) => s.runId);
  const speed = useSimulationStore((s) => s.speed);
  const updateSnapshot = useSimulationStore((s) => s.updateSnapshot);

  const workerRef = useRef<Worker | null>(null);
  const runningRef = useRef(running);
  const speedRef = useRef(speed);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    speedRef.current = speed;
    activeIntervalRef.current = BASE_TICK_MS / Math.max(0.01, speed);
    workerRef.current?.postMessage({
      type: "setSpeed",
      speed,
    } satisfies WorkerInbound);
  }, [speed]);

  useEffect(() => {
    if (!started) {
      workerRef.current?.terminate();
      workerRef.current = null;
      activeWorldRef.current = null;
      return;
    }

    const worker = new Worker(
      new URL("../lib/sim.worker.ts", import.meta.url),
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<FrameMessage>) => {
      const msg = e.data;
      if (msg.type !== "frame") return;
      activeWorldRef.current = deserializeWorld(msg.frame);
      activeFrameAtRef.current = performance.now();
      updateSnapshot(msg.snapshot);
    };

    worker.postMessage({
      type: "init",
      config,
      speed: speedRef.current,
    } satisfies WorkerInbound);
    if (runningRef.current) {
      worker.postMessage({ type: "resume" } satisfies WorkerInbound);
    }

    return () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [runId, started, config, updateSnapshot]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({
      type: running ? "resume" : "pause",
    } satisfies WorkerInbound);
    if (running) activeFrameAtRef.current = performance.now();
  }, [running]);

  return null;
}
