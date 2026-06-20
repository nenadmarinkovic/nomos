"use client";

import { FloatingWindows } from "@/components/floating-windows";
import { NetworkCanvas } from "@/components/network-canvas";
import { SimulationCanvas } from "@/components/simulation-canvas";
import { useSimulationStore } from "@/lib/store";

export function FieldPage() {
  const running = useSimulationStore((s) => s.running);
  const view = useSimulationStore((s) => s.canvasView);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="relative flex flex-1 overflow-hidden">
        {view === "field" ? (
          <SimulationCanvas running={running} />
        ) : (
          <NetworkCanvas />
        )}
        <FloatingWindows />
      </div>
    </div>
  );
}
