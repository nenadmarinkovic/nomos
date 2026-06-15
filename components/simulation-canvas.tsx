"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface SimulationCanvasProps {
  running: boolean;
}

export function SimulationCanvas({ running }: SimulationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative flex h-full flex-1 flex-col bg-field">
      <div
        ref={containerRef}
        className={cn(
          "relative flex-1 overflow-hidden",
          "[background-image:radial-gradient(circle_at_center,rgba(0,0,0,0.06)_1px,transparent_1px)]",
          "dark:[background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.08)_1px,transparent_1px)]",
          "[background-size:16px_16px]",
        )}
      >
        {/* Canvas mount point — PixiJS will attach here */}
        <div id="pixi-mount" className="absolute inset-0" />

        {/* Empty-state guidance */}
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

        {/* Top-right HUD */}
        <div className="absolute top-3 right-3 flex items-center gap-2 rounded-md border border-border bg-card/80 px-2 py-1 backdrop-blur-sm">
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              running ? "bg-brand animate-pulse" : "bg-muted-foreground/40",
            )}
          />
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {running ? "running" : "idle"}
          </span>
        </div>

        {/* Bottom-left field dimensions */}
        <div className="absolute bottom-3 left-3 font-mono text-[10px] text-muted-foreground/70">
          {size.width} × {size.height}
        </div>
      </div>
    </div>
  );
}
