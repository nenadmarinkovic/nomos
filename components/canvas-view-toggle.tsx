"use client";

import { CheckIcon, GlobeIcon, GraphIcon } from "@phosphor-icons/react";

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
 * force-graph Network view of the same simulation, and hosts the
 * monochrome (B&W) toggle. Hidden until the user has started a run.
 */
export function CanvasViewToggle() {
  const started = useSimulationStore((s) => s.started);
  const view = useSimulationStore((s) => s.canvasView);
  const setView = useSimulationStore((s) => s.setCanvasView);
  const monochrome = useSimulationStore((s) => s.monochrome);
  const toggleMonochrome = useSimulationStore((s) => s.toggleMonochrome);

  if (!started) return null;

  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];
  const CurrentIcon = current.Icon;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
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
                <span className="text-xs">{label}</span>
              </MenubarItem>
            ))}
            <div className="my-1 h-px bg-foreground/10" />
            <MenubarItem
              onSelect={(e) => {
                e.preventDefault();
                toggleMonochrome();
              }}
            >
              <CheckIcon
                size={12}
                weight="bold"
                className={
                  monochrome ? "text-foreground" : "text-transparent"
                }
              />
              <span className="text-xs">Black &amp; white</span>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}
