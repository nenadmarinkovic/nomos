"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowSquareUpRightIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  activeFrameAtRef,
  activeIntervalRef,
  activeWorldRef,
} from "@/lib/active-world";
import { useSimulationStore } from "@/lib/store";
import type { WorldView } from "@/lib/world";

const W = 256;
const H = 184;

const MOTIVATION_COLOR: Record<string, string> = {
  material: "#E63946",
  symbolic: "#2E5C9E",
  normative: "#FFD23F",
  power: "#111111",
};

export function MiniSimWindow() {
  const started = useSimulationStore((s) => s.started);
  const running = useSimulationStore((s) => s.running);
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Default position = bottom-right of the canvas area with footer clearance.
  useEffect(() => {
    if (position.x === -1 || position.y === -1) {
      const r = document.querySelector("main")?.getBoundingClientRect();
      if (!r) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosition({
        x: Math.max(12, r.width - W - 24),
        y: Math.max(12, r.height - H - 80),
      });
    }
  }, [position.x, position.y]);

  function handleDragEnd(e: DragEndEvent) {
    setPosition((p) => ({
      x: Math.max(0, p.x + e.delta.x),
      y: Math.max(0, p.y + e.delta.y),
    }));
  }

  if (!started) return null;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden={false}
      >
        <MiniSimBody position={position} running={running} />
      </div>
    </DndContext>
  );
}

function MiniSimBody({
  position,
  running,
}: {
  position: { x: number; y: number };
  running: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: "mini-sim" });
  const turn = useSimulationStore((s) => s.turn);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  // Animated mini-canvas while running — same interpolation curve as the main
  // Field canvas, just rendered smaller and cheaper.
  useEffect(() => {
    if (!running) return;
    function loop() {
      const canvas = canvasRef.current;
      const world = activeWorldRef.current;
      if (canvas && world) {
        const dpr = window.devicePixelRatio || 1;
        if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
          canvas.width = W * dpr;
          canvas.height = H * dpr;
        }
        const interval = activeIntervalRef.current;
        const progress = Math.min(
          1,
          Math.max(
            0,
            (performance.now() - activeFrameAtRef.current) / interval,
          ),
        );
        drawMini(world, canvas, dpr, progress);
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running]);

  // While paused, repaint once per turn change.
  useEffect(() => {
    if (running) return;
    void turn;
    const canvas = canvasRef.current;
    const world = activeWorldRef.current;
    if (!canvas || !world) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    drawMini(world, canvas, dpr, 1);
  }, [turn, running]);

  const x = position.x + (transform?.x ?? 0);
  const y = position.y + (transform?.y ?? 0);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: `translate3d(${x}px, ${y}px, 0)`, width: W }}
      className={cn(
        "pointer-events-auto absolute left-0 top-0 rounded-md border border-foreground/15 bg-card/95 font-sans text-foreground shadow-xl backdrop-blur-md",
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
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              running ? "animate-pulse bg-emerald-500" : "bg-amber-500",
            )}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Field
          </span>
          <span className="font-mono text-[11px] tabular-nums text-foreground">
            T{turn}
          </span>
        </div>
        <Link
          href="/"
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Open Field"
          className="cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <ArrowSquareUpRightIcon size={12} weight="bold" />
        </Link>
      </div>
      <Link
        href="/"
        onPointerDown={(e) => e.stopPropagation()}
        className="block cursor-pointer"
        title="Open Field"
      >
        <canvas
          ref={canvasRef}
          style={{ width: W, height: H }}
          className="block"
        />
      </Link>
    </div>
  );
}

function drawMini(
  world: WorldView,
  canvas: HTMLCanvasElement,
  dpr: number,
  progress: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cw = canvas.width / world.width;
  const ch = canvas.height / world.height;
  const cellSize = Math.min(cw, ch);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Resource hint
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const idx = y * world.width + x;
      const max = world.maxCells[idx] + world.maxSpice[idx];
      if (max < 1) continue;
      const v = world.cells[idx] + world.spice[idx];
      const intensity = Math.min(1, v / 6);
      if (intensity < 0.2) continue;
      ctx.fillStyle = `rgba(140, 170, 130, ${0.18 * intensity})`;
      ctx.fillRect(x * cw, y * ch, cw, ch);
    }
  }

  // Agents interpolated between previous and current cell.
  const ease =
    progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  const r = Math.max(1.4 * dpr, cellSize * 0.5);
  for (const a of world.agents) {
    if (!a.alive) continue;
    const ix = a.prevX + (a.x - a.prevX) * ease;
    const iy = a.prevY + (a.y - a.prevY) * ease;
    const cx = ix * cw + cw / 2;
    const cy = iy * ch + ch / 2;
    ctx.fillStyle = MOTIVATION_COLOR[a.motivation] ?? "#E63946";
    ctx.fillRect(cx - r / 2, cy - r / 2, r, r);
  }
}
