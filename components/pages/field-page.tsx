"use client";

import { FloatingWindows } from "@/components/floating-windows";
import { NetworkCanvas } from "@/components/network-canvas";
import { SimulationCanvas } from "@/components/simulation-canvas";
import { SimulationCanvasPixi } from "@/components/simulation-canvas-pixi";
import { cn } from "@/lib/utils";
import { useSimulationStore } from "@/lib/store";

export function FieldPage() {
  const running = useSimulationStore((s) => s.running);
  const view = useSimulationStore((s) => s.canvasView);
  const renderer = useSimulationStore((s) => s.fieldRenderer);
  const setRenderer = useSimulationStore((s) => s.setFieldRenderer);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="relative flex flex-1 overflow-hidden">
        {view === "field" ? (
          renderer === "pixi" ? (
            <SimulationCanvasPixi running={running} />
          ) : (
            <SimulationCanvas running={running} />
          )
        ) : (
          <NetworkCanvas />
        )}
        {view === "field" && (
          <div className="pointer-events-auto absolute left-3 top-3 z-10 flex items-center gap-0.5 rounded-md border border-border bg-card/80 p-0.5 backdrop-blur-sm">
            <RendererButton
              active={renderer === "canvas2d"}
              onClick={() => setRenderer("canvas2d")}
              label="C2D"
              title="Canvas2D — original renderer, includes resources and selection"
            />
            <RendererButton
              active={renderer === "pixi"}
              onClick={() => setRenderer("pixi")}
              label="Pixi"
              title="Pixi WebGL — agents only in this pass"
            />
          </div>
        )}
        <FloatingWindows />
      </div>
    </div>
  );
}

function RendererButton({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "cursor-pointer rounded-[4px] px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
