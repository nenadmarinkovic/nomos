"use client";

import { SidebarRow } from "@/components/sidebar-section";
import { Switch } from "@/components/ui/switch";
import { useSimulationStore } from "@/lib/store";

export function MonochromeToggle() {
  const started = useSimulationStore((s) => s.started);
  const monochrome = useSimulationStore((s) => s.monochrome);
  const toggle = useSimulationStore((s) => s.toggleMonochrome);

  if (!started) return null;

  return (
    <SidebarRow label="Black &amp; white" htmlFor="monochrome-toggle">
      <Switch
        id="monochrome-toggle"
        size="sm"
        checked={monochrome}
        onCheckedChange={toggle}
      />
    </SidebarRow>
  );
}
