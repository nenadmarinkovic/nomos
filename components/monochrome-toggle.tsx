"use client";

import { Switch } from "@/components/ui/switch";
import { useSimulationStore } from "@/lib/store";

/**
 * Sidebar switch that renders the field's agents and resource background in
 * grayscale (black & white) instead of the motivation palette. Hidden until a
 * run has started, matching the other canvas controls.
 */
export function MonochromeToggle() {
  const started = useSimulationStore((s) => s.started);
  const monochrome = useSimulationStore((s) => s.monochrome);
  const toggle = useSimulationStore((s) => s.toggleMonochrome);

  if (!started) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <label
        htmlFor="monochrome-toggle"
        className="cursor-pointer font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground"
      >
        Black &amp; white
      </label>
      <Switch
        id="monochrome-toggle"
        size="sm"
        checked={monochrome}
        onCheckedChange={toggle}
      />
    </div>
  );
}
