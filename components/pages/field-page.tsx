"use client";

import { FloatingWindows } from "@/components/floating-windows";
import { SimulationCanvas } from "@/components/simulation-canvas";
import { useSimulationStore } from "@/lib/store";

export function FieldPage() {
  const running = useSimulationStore((s) => s.running);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="relative flex flex-1 overflow-hidden">
        <SimulationCanvas running={running} />
        <FloatingWindows />
      </div>
    </div>
  );
}
