"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  activeFrameAtRef,
  activeIntervalRef,
  activeWorldRef,
} from "@/lib/active-world";
import { type RenderAgent, type WorldView } from "@/lib/world";
import { useSimulationStore } from "@/lib/store";

interface SimulationCanvasProps {
  running: boolean;
}

export function SimulationCanvas({ running }: SimulationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [inspectorPos, setInspectorPos] = useState({ x: 12, y: 12 });
  const selectedIdRef = useRef<number | null>(null);
  const hoveredIdRef = useRef<number | null>(null);

  const inspectorSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  function handleInspectorDragEnd(e: DragEndEvent) {
    setInspectorPos((p) => ({
      x: Math.max(0, p.x + e.delta.x),
      y: Math.max(0, p.y + e.delta.y),
    }));
  }
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const started = useSimulationStore((s) => s.started);
  const runId = useSimulationStore((s) => s.runId);
  const turn = useSimulationStore((s) => s.turn);
  const setCanvasSize = useSimulationStore((s) => s.setCanvasSize);

  // Draw the latest world to the canvas at a given inter-frame progress (0..1).
  function paint(progress = 1, selId = selectedIdRef.current) {
    const canvas = canvasRef.current;
    const world = activeWorldRef.current;
    if (!canvas || !world) return;
    const dpr = window.devicePixelRatio || 1;
    renderWorld(world, canvas, dpr, { selectedId: selId, progress });
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(null);
  }, [runId, started]);

  // Repaint after each fresh frame when not running (paused / idle).
  useEffect(() => {
    void turn;
    if (running) return;
    paint(1);
     
  }, [turn, running]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) {
        const next = { width: Math.round(r.width), height: Math.round(r.height) };
        setSize(next);
        setCanvasSize(next);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [setCanvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    paint(1);
  }, [size]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const world = activeWorldRef.current;
    if (!canvas || !world) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cellW = rect.width / world.width;
    const cellH = rect.height / world.height;
    const gx = Math.floor(px / cellW);
    const gy = Math.floor(py / cellH);
    if (gx < 0 || gy < 0 || gx >= world.width || gy >= world.height) {
      setSelectedId(null);
      return;
    }
    const id = world.occupants[gy * world.width + gx];
    if (id === -1) {
      setSelectedId(null);
      return;
    }
    setSelectedId(id);
    paint(1, id);
  }

  function handleCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const world = activeWorldRef.current;
    if (!canvas || !world) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cellW = rect.width / world.width;
    const cellH = rect.height / world.height;
    const gx = Math.floor(px / cellW);
    const gy = Math.floor(py / cellH);
    if (gx < 0 || gy < 0 || gx >= world.width || gy >= world.height) {
      canvas.style.cursor = "default";
      hoveredIdRef.current = null;
      return;
    }
    const id = world.occupants[gy * world.width + gx];
    if (id === -1) {
      canvas.style.cursor = "default";
      hoveredIdRef.current = null;
      return;
    }
    canvas.style.cursor = "pointer";
    hoveredIdRef.current = id;
  }

  function handleCanvasLeave() {
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = "default";
    hoveredIdRef.current = null;
  }

  // Clear the canvas when no run is active. The worker lifecycle now lives
  // in <SimulationEngine /> at the AppShell root so it survives navigation.
  useEffect(() => {
    if (!started) clearCanvas(canvasRef.current);
  }, [started]);

  // While running, drive the canvas at animation-frame rate, interpolating
  // each agent between its previous and current cell using the time since the
  // last frame arrived from the worker (published by SimulationEngine).
  useEffect(() => {
    if (!running) return;

    function loop() {
      const interval = activeIntervalRef.current;
      const progress = Math.min(
        1,
        Math.max(0, (performance.now() - activeFrameAtRef.current) / interval),
      );
      paint(progress);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
     
  }, [running]);

  return (
    <div className="relative flex h-full flex-1 flex-col">
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMove}
          onMouseLeave={handleCanvasLeave}
          style={{ width: size.width, height: size.height }}
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            started ? "opacity-100" : "opacity-0",
          )}
        />

        {started && selectedId !== null && (
          <DndContext
            sensors={inspectorSensors}
            onDragEnd={handleInspectorDragEnd}
          >
            <InspectorOverlay
              selectedId={selectedId}
              position={inspectorPos}
              onClose={() => setSelectedId(null)}
            />
          </DndContext>
        )}


        {!started && (
          <div className="pointer-events-auto absolute inset-0 overflow-y-auto bg-background">
            <div className="mx-auto flex max-w-2xl flex-col px-6 pb-16 pt-16">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                A generative society simulation
              </p>
              <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                Build a society from{" "}
                <em className="text-brand">simple rules</em> and watch what it
                becomes.
              </h1>
              <p className="mt-5 font-serif text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
                Nomos doesn&rsquo;t program societies — it grows them. You set
                a few starting conditions; agents follow simple rules; whatever
                happens next is what the conditions produced. Inequality,
                settlements, classes, conflict: never written into the engine,
                always emerging from the bottom up.
              </p>

              <ol className="mt-10 space-y-5">
                <Step
                  n="01"
                  title="Set the conditions"
                  body="How many people. How equal they start. What kind of land. What they want — resources (Marx), status (Bourdieu), belonging (Durkheim), or domination over others. What kind of minds they have — Herbert Simon&rsquo;s bounded rationality, learners, or imitators."
                />
                <Step
                  n="02"
                  title="Press Run"
                  body="Agents move, harvest, pay metabolism, age, die, and — if you turned inheritance on — leave their wealth to children. The same Sugarscape rule Joshua Epstein wrote in 1996, run in your browser."
                />
                <Step
                  n="03"
                  title="Watch what emerges"
                  body="Wealth concentrates. Clusters form on the resource peaks. The poor migrate or starve. The Gini coefficient climbs in real time. You didn&rsquo;t script any of it — it grew from what you set."
                />
                <Step
                  n="04"
                  title="Hear the theorists"
                  body="AI observers read the same run through different lenses — Marx, Polanyi, Bourdieu, Durkheim, Granovetter, Schelling, Turchin, Farmer, Epstein, Flack — and narrate what they see in their own vocabulary. Same emergence, multiple readings, side by side."
                />
              </ol>
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

      </div>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-4">
      <span className="pt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {n}
      </span>
      <div>
        <div className="font-serif text-lg leading-tight text-foreground">
          {title}
        </div>
        <p
          className="mt-1.5 font-sans text-[13px] leading-relaxed text-foreground/75 sm:text-sm"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
    </li>
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clearCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}


const MOTIVATION_COLOR: Record<string, string> = {
  material: "#E63946",
  symbolic: "#2E5C9E",
  normative: "#FFD23F",
  power: "#2A9D5C",
};

/** Paint one resource field as small dots, nudged so the two goods don't
 * sit exactly on top of each other where they overlap. */
function drawResource(
  ctx: CanvasRenderingContext2D,
  field: Float32Array,
  maxField: Float32Array,
  rgb: [number, number, number],
  nudge: number,
  cellW: number,
  cellH: number,
  dotSize: number,
  width: number,
  height: number,
) {
  const off = nudge * dotSize * 0.45;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const v = field[idx];
      const max = maxField[idx];
      if (max <= 0 || v < max * 0.5) continue;
      const intensity = Math.min(1, v / 4);
      const alpha = 0.18 + intensity * 0.35;
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
      const dx = x * cellW + cellW / 2 - dotSize / 2 + off;
      const dy = y * cellH + cellH / 2 - dotSize / 2 + off;
      ctx.fillRect(dx, dy, dotSize, dotSize);
    }
  }
}


function renderWorld(
  world: WorldView,
  canvas: HTMLCanvasElement,
  dpr: number,
  opts: { selectedId: number | null; progress?: number },
) {
  const progress = opts.progress ?? 1;
  const ease = easeInOutCubic(progress);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  const cellW = W / world.width;
  const cellH = H / world.height;
  const shapeSize = Math.min(cellW, cellH);

  ctx.clearRect(0, 0, W, H);

  const dotSize = Math.max(shapeSize * 0.18, 2 * dpr);
  // Sugar (green) and spice (amber) are two separate goods. Where one is dense
  // the other is usually sparse — that gradient is what makes trade pay.
  drawResource(ctx, world.cells, world.maxCells, [120, 200, 130], -1, cellW, cellH, dotSize, world.width, world.height);
  drawResource(ctx, world.spice, world.maxSpice, [214, 158, 90], 1, cellW, cellH, dotSize, world.width, world.height);

  const agentSize = Math.max(shapeSize * 0.72, 5 * dpr);
  const outlineWidth = Math.max(0.6, 0.7 * dpr);

  for (const a of world.agents) {
    if (!a.alive) continue;
    const ix = a.prevX + (a.x - a.prevX) * ease;
    const iy = a.prevY + (a.y - a.prevY) * ease;
    const cx = ix * cellW + cellW / 2;
    const cy = iy * cellH + cellH / 2;
    const color = MOTIVATION_COLOR[a.motivation] ?? "#E63946";
    const w = a.sugar + a.spice;
    const wealthDim = w > 30 ? 1 : w > 12 ? 0.88 : w > 4 ? 0.7 : 0.5;

    ctx.fillStyle = applyAlpha(color, wealthDim);
    ctx.strokeStyle = `rgba(20, 20, 20, ${0.6 * wealthDim})`;
    ctx.lineWidth = outlineWidth;
    drawShape(ctx, a.motivation, cx, cy, agentSize, /* withStroke */ true);
  }

  if (opts.selectedId !== null) {
    const a = world.agents[opts.selectedId];
    if (a && a.alive) {
      const ax = a.prevX + (a.x - a.prevX) * ease;
      const ay = a.prevY + (a.y - a.prevY) * ease;
      const cx = ax * cellW + cellW / 2;
      const cy = ay * cellH + cellH / 2;

      const isDark =
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark");
      const lineColor = isDark
        ? "rgba(255,255,255,0.55)"
        : "rgba(20,20,20,0.55)";
      const ringColor = isDark
        ? "rgba(255,255,255,0.95)"
        : "rgba(20,20,20,0.85)";
      const ringHaloColor = isDark
        ? "rgba(0,0,0,0.45)"
        : "rgba(255,255,255,0.9)";

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = Math.max(0.8, 0.9 * dpr);
      for (const id of neighborsInVision(world, a)) {
        const n = world.agents[id];
        if (!n || !n.alive) continue;
        const nix = n.prevX + (n.x - n.prevX) * ease;
        const niy = n.prevY + (n.y - n.prevY) * ease;
        const nx = nix * cellW + cellW / 2;
        const ny = niy * cellH + cellH / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }

      const r = Math.max(shapeSize * 0.9, 7 * dpr);
      // Two-pass ring: a slightly wider halo behind the main stroke. Keeps the
      // selection visible whether the underlying agent shape is pale (light
      // theme + yellow triangle) or dark (dark theme + black diamond).
      ctx.strokeStyle = ringHaloColor;
      ctx.lineWidth = Math.max(2.6, 3.2 * dpr);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = ringColor;
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
  withStroke = false,
) {
  const half = size / 2;
  if (motivation === "material") {
    ctx.fillRect(cx - half, cy - half, size, size);
    if (withStroke) ctx.strokeRect(cx - half, cy - half, size, size);
    return;
  }
  if (motivation === "symbolic") {
    ctx.beginPath();
    ctx.arc(cx, cy, half, 0, Math.PI * 2);
    ctx.fill();
    if (withStroke) ctx.stroke();
    return;
  }
  if (motivation === "normative") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - half);
    ctx.lineTo(cx + half, cy + half);
    ctx.lineTo(cx - half, cy + half);
    ctx.closePath();
    ctx.fill();
    if (withStroke) ctx.stroke();
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
    if (withStroke) ctx.stroke();
    return;
  }
  ctx.fillRect(cx - half, cy - half, size, size);
  if (withStroke) ctx.strokeRect(cx - half, cy - half, size, size);
}

function neighborsInVision(world: WorldView, a: RenderAgent): number[] {
  const out: number[] = [];
  const W = world.width;
  const H = world.height;
  const v = a.vision;
  for (let dy = -v; dy <= v; dy++) {
    const ny = a.y + dy;
    if (ny < 0 || ny >= H) continue;
    for (let dx = -v; dx <= v; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = a.x + dx;
      if (nx < 0 || nx >= W) continue;
      const occ = world.occupants[ny * W + nx];
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

interface AgentSnapshot {
  id: number;
  alive: boolean;
  x: number;
  y: number;
  sugar: number;
  spice: number;
  age: number;
  maxAge: number;
  vision: number;
  sugarMetab: number;
  spiceMetab: number;
  motivation: string;
}

function InspectorOverlay({
  selectedId,
  position,
  onClose,
}: {
  selectedId: number;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: "inspector" });
  const turn = useSimulationStore((s) => s.turn);
  const [snap, setSnap] = useState<AgentSnapshot | null>(null);

  useEffect(() => {
    const world = activeWorldRef.current;
    if (!world) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSnap(null);
      return;
    }
    const a = world.agents[selectedId];
    if (!a) {
       
      setSnap(null);
      return;
    }
     
    setSnap({
      id: a.id,
      alive: a.alive,
      x: a.x,
      y: a.y,
      sugar: a.sugar,
      spice: a.spice,
      age: a.age,
      maxAge: a.maxAge,
      vision: a.vision,
      sugarMetab: a.sugarMetab,
      spiceMetab: a.spiceMetab,
      motivation: a.motivation,
    });
  }, [turn, selectedId]);

  if (!snap) return null;

  const x = position.x + (transform?.x ?? 0);
  const y = position.y + (transform?.y ?? 0);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
      className={cn(
        "pointer-events-auto absolute left-0 top-0 w-64 rounded-md border border-foreground/15 bg-card/95 font-sans text-foreground shadow-xl backdrop-blur-md",
        isDragging && "shadow-2xl",
      )}
    >
      <div
        {...listeners}
        {...attributes}
        className={cn(
          "flex items-center justify-between gap-2 border-b border-foreground/10 px-3 py-2",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Agent #{snap.id}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          aria-label="Close inspector"
          className="cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <XIcon size={12} weight="bold" />
        </button>
      </div>
      <div className="px-3 py-3">

      {!snap.alive ? (
        <p className="font-serif text-[13px] italic text-foreground/70">
          Deceased.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
          <InspectorRow label="Motivation" value={snap.motivation} />
          <InspectorRow
            label="Wealth"
            value={(snap.sugar + snap.spice).toFixed(1)}
          />
          <InspectorRow label="Sugar" value={snap.sugar.toFixed(1)} />
          <InspectorRow label="Spice" value={snap.spice.toFixed(1)} />
          <InspectorRow label="Position" value={`${snap.x}, ${snap.y}`} />
          <InspectorRow
            label="Age"
            value={`${snap.age} / ${snap.maxAge}`}
          />
          <InspectorRow label="Vision" value={snap.vision.toString()} />
          <InspectorRow
            label="Metabolism"
            value={`${snap.sugarMetab.toFixed(1)} / ${snap.spiceMetab.toFixed(1)}`}
          />
        </dl>
      )}
      </div>
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
