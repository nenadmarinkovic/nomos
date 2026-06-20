"use client";

import { CubeIcon, GlobeIcon, GraphIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useSimulationStore } from "@/lib/store";

/**
 * Segmented toggle that swaps between the geographic Field view and the
 * topological Network view of the same simulation. Floats over the canvas
 * top-right corner.
 */
export function CanvasViewToggle() {
  const started = useSimulationStore((s) => s.started);
  const view = useSimulationStore((s) => s.canvasView);
  const setView = useSimulationStore((s) => s.setCanvasView);

  if (!started) return null;

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 flex items-center gap-0.5 rounded-md border border-foreground/10 bg-card/85 p-0.5 shadow-sm backdrop-blur-sm">
      <Option
        active={view === "field"}
        onClick={() => setView("field")}
        Icon={GlobeIcon}
        label="Field"
      />
      <Option
        active={view === "network"}
        onClick={() => setView("network")}
        Icon={GraphIcon}
        label="Network"
      />
      <Option
        active={view === "network3d"}
        onClick={() => setView("network3d")}
        Icon={CubeIcon}
        label="3D"
      />
    </div>
  );
}

function Option({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof GlobeIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-[4px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
      )}
    >
      <Icon size={11} weight={active ? "fill" : "regular"} />
      {label}
    </button>
  );
}
