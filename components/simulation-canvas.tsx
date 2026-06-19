"use client";

import { useEffect, useRef, useState } from "react";
import { XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Engine } from "@/lib/engine";
import { useSimulationStore } from "@/lib/store";

interface SimulationCanvasProps {
  running: boolean;
}

const BASE_TICK_MS = 200;

export function SimulationCanvas({ running }: SimulationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const config = useSimulationStore((s) => s.config);
  const started = useSimulationStore((s) => s.started);
  const runId = useSimulationStore((s) => s.runId);
  const speed = useSimulationStore((s) => s.speed);
  const updateSnapshot = useSimulationStore((s) => s.updateSnapshot);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(null);
  }, [runId, started]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    if (engineRef.current) {
      renderEngine(engineRef.current, canvas, dpr, {
        selectedId: selectedIdRef.current,
      });
    }
  }, [size]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cellW = rect.width / engine.width;
    const cellH = rect.height / engine.height;
    const gx = Math.floor(px / cellW);
    const gy = Math.floor(py / cellH);
    if (gx < 0 || gy < 0 || gx >= engine.width || gy >= engine.height) {
      setSelectedId(null);
      return;
    }
    const id = engine.occupants[gy * engine.width + gx];
    if (id === -1) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    const dpr = window.devicePixelRatio || 1;
    renderEngine(engine, canvas, dpr, { selectedId: id });
  }

  useEffect(() => {
    if (!started) {
      engineRef.current = null;
      clearCanvas(canvasRef.current);
      return;
    }
    const engine = new Engine(config);
    engineRef.current = engine;
    updateSnapshot(engine.getSnapshot());
    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      renderEngine(engine, canvas, dpr, { selectedId: null });
    }
  }, [runId, started, config, updateSnapshot]);

  useEffect(() => {
    if (!running) return;
    lastTickRef.current = performance.now();
    const dpr = window.devicePixelRatio || 1;

    function loop(now: number) {
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || !canvas) return;
      const interval = BASE_TICK_MS / speedRef.current;
      if (now - lastTickRef.current >= interval) {
        engine.tick();
        updateSnapshot(engine.getSnapshot());
        renderEngine(engine, canvas, dpr, {
          selectedId: selectedIdRef.current,
        });
        lastTickRef.current = now;
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, updateSnapshot]);

  return (
    <div className="relative flex h-full flex-1 flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ width: size.width, height: size.height }}
          className={cn(
            "absolute inset-0 cursor-crosshair transition-opacity duration-300",
            started ? "opacity-100" : "opacity-0",
          )}
        />

        {started && selectedId !== null && (
          <InspectorOverlay
            engineRef={engineRef}
            selectedId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}

        {!started && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="max-w-sm text-center">
              <p className="font-serif text-2xl italic leading-tight text-foreground/90">
                Empty field.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Set initial conditions, press Run, and watch what emerges.
              </p>
            </div>
          </div>
        )}

        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md border border-border bg-card/80 px-2 py-1 backdrop-blur-sm">
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              running
                ? "animate-pulse bg-brand"
                : started
                  ? "bg-yellow-500/70"
                  : "bg-muted-foreground/40",
            )}
          />
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {running ? "running" : started ? "paused" : "idle"}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 font-mono text-[10px] text-muted-foreground/70">
          {size.width} × {size.height}
        </div>
      </div>
    </div>
  );
}

function clearCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

const MOTIVATION_COLOR: Record<string, string> = {
  material: "#fde47a",
  symbolic: "#cbb6ff",
  normative: "#9ad0a4",
  power: "#ef8f8f",
};

function renderEngine(
  engine: Engine,
  canvas: HTMLCanvasElement,
  dpr: number,
  opts: { selectedId: number | null },
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const cellW = W / engine.width;
  const cellH = H / engine.height;
  const shapeSize = Math.min(cellW, cellH);

  ctx.clearRect(0, 0, W, H);

  const agentSize = Math.max(shapeSize * 0.7, 4 * dpr);

  for (const a of engine.agents) {
    if (!a.alive) continue;
    const cx = a.x * cellW + cellW / 2;
    const cy = a.y * cellH + cellH / 2;
    const color = MOTIVATION_COLOR[a.motivation] ?? "#fde47a";
    const wealthDim =
      a.wealth > 30 ? 1 : a.wealth > 12 ? 0.85 : a.wealth > 4 ? 0.65 : 0.42;
    ctx.fillStyle = applyAlpha(color, wealthDim);
    drawShape(ctx, a.motivation, cx, cy, agentSize);
  }

  if (opts.selectedId !== null) {
    const a = engine.agents[opts.selectedId];
    if (a && a.alive) {
      const cx = a.x * cellW + cellW / 2;
      const cy = a.y * cellH + cellH / 2;

      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = Math.max(0.8, 0.9 * dpr);
      for (const id of neighborsInVision(engine, a)) {
        const n = engine.agents[id];
        if (!n || !n.alive) continue;
        const nx = n.x * cellW + cellW / 2;
        const ny = n.y * cellH + cellH / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }

      const r = Math.max(shapeSize * 0.9, 7 * dpr);
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = Math.max(1.4, 1.5 * dpr);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  motivation: string,
  cx: number,
  cy: number,
  size: number,
) {
  const half = size / 2;
  if (motivation === "material") {
    ctx.fillRect(cx - half, cy - half, size, size);
    return;
  }
  if (motivation === "symbolic") {
    ctx.beginPath();
    ctx.arc(cx, cy, half, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (motivation === "normative") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - half);
    ctx.lineTo(cx + half, cy + half);
    ctx.lineTo(cx - half, cy + half);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (motivation === "power") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - half);
    ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx, cy + half);
    ctx.lineTo(cx - half, cy);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.fillRect(cx - half, cy - half, size, size);
}

function neighborsInVision(engine: Engine, a: Agent): number[] {
  const out: number[] = [];
  const W = engine.width;
  const H = engine.height;
  const v = a.vision;
  for (let dy = -v; dy <= v; dy++) {
    const ny = a.y + dy;
    if (ny < 0 || ny >= H) continue;
    for (let dx = -v; dx <= v; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = a.x + dx;
      if (nx < 0 || nx >= W) continue;
      const occ = engine.occupants[ny * W + nx];
      if (occ !== -1 && occ !== a.id) out.push(occ);
    }
  }
  return out;
}

function applyAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    const h = color.replace("#", "");
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

type Agent = Engine["agents"][number];

interface AgentSnapshot {
  id: number;
  alive: boolean;
  x: number;
  y: number;
  wealth: number;
  age: number;
  maxAge: number;
  vision: number;
  metabolism: number;
  initialEndowment: number;
  motivation: string;
}

function InspectorOverlay({
  engineRef,
  selectedId,
  onClose,
}: {
  engineRef: React.RefObject<Engine | null>;
  selectedId: number;
  onClose: () => void;
}) {
  const turn = useSimulationStore((s) => s.turn);
  const [snap, setSnap] = useState<AgentSnapshot | null>(null);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      setSnap(null);
      return;
    }
    const a = engine.agents[selectedId];
    if (!a) {
      setSnap(null);
      return;
    }
    setSnap({
      id: a.id,
      alive: a.alive,
      x: a.x,
      y: a.y,
      wealth: a.wealth,
      age: a.age,
      maxAge: a.maxAge,
      vision: a.vision,
      metabolism: a.metabolism,
      initialEndowment: a.initialEndowment,
      motivation: a.motivation,
    });
  }, [turn, selectedId, engineRef]);

  if (!snap) return null;

  return (
    <div className="pointer-events-auto absolute left-3 top-3 w-64 rounded-md border border-foreground/15 bg-card/95 p-3 font-sans text-foreground shadow-xl backdrop-blur-md">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Agent #{snap.id}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        >
          <XIcon size={12} weight="bold" />
        </button>
      </div>

      {!snap.alive ? (
        <p className="mt-2 font-serif text-[13px] italic text-foreground/70">
          Deceased.
        </p>
      ) : (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
          <InspectorRow label="Motivation" value={snap.motivation} />
          <InspectorRow label="Wealth" value={snap.wealth.toFixed(1)} />
          <InspectorRow label="Position" value={`${snap.x}, ${snap.y}`} />
          <InspectorRow
            label="Age"
            value={`${snap.age} / ${snap.maxAge}`}
          />
          <InspectorRow label="Vision" value={snap.vision.toString()} />
          <InspectorRow
            label="Metabolism"
            value={snap.metabolism.toFixed(2)}
          />
          <InspectorRow
            label="Endowment"
            value={snap.initialEndowment.toFixed(1)}
          />
        </dl>
      )}
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right font-mono tabular-nums text-foreground">
        {value}
      </dd>
    </>
  );
}
