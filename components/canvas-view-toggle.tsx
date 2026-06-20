"use client";

import { GlobeIcon, GraphIcon } from "@phosphor-icons/react";

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useSimulationStore } from "@/lib/store";

type CanvasView = "field" | "network";

const VIEWS: { key: CanvasView; label: string; Icon: typeof GlobeIcon }[] = [
  { key: "field", label: "Field", Icon: GlobeIcon },
  { key: "network", label: "Network", Icon: GraphIcon },
];

/**
 * Sidebar section that swaps between the geographic Field view and the
 * force-graph Network view of the same simulation. Hidden until the user has
 * started a run.
 */
export function CanvasViewToggle() {
  const started = useSimulationStore((s) => s.started);
  const view = useSimulationStore((s) => s.canvasView);
  const setView = useSimulationStore((s) => s.setCanvasView);

  if (!started) return null;

  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];
  const CurrentIcon = current.Icon;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Canvas
      </span>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>
            <CurrentIcon size={11} weight="bold" />
            {current.label}
          </MenubarTrigger>
          <MenubarContent align="end">
            {VIEWS.map(({ key, label, Icon }) => (
              <MenubarItem key={key} onSelect={() => setView(key)}>
                <Icon
                  size={12}
                  weight="bold"
                  className="text-muted-foreground"
                />
                <span className="font-sans text-[12px]">{label}</span>
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}
