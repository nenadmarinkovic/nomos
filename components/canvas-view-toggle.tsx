"use client";

import { GlobeIcon, GraphIcon } from "@phosphor-icons/react";

import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { SidebarRow } from "@/components/sidebar-section";
import { useSimulationStore } from "@/lib/store";

type CanvasView = "field" | "network";

const VIEWS: { key: CanvasView; label: string; Icon: typeof GlobeIcon }[] = [
  { key: "field", label: "Field", Icon: GlobeIcon },
  { key: "network", label: "Network", Icon: GraphIcon },
];

export function CanvasViewToggle() {
  const started = useSimulationStore((s) => s.started);
  const view = useSimulationStore((s) => s.canvasView);
  const setView = useSimulationStore((s) => s.setCanvasView);

  if (!started) return null;

  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];
  const CurrentIcon = current.Icon;

  return (
    <SidebarRow label="View">
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger className="text-foreground/55 hover:text-foreground">
            <CurrentIcon size={11} weight="bold" />
            {current.label}
          </MenubarTrigger>
          <MenubarContent align="end">
            {VIEWS.map(({ key, label, Icon }) => (
              <MenubarItem key={key} onSelect={() => setView(key)}>
                <Icon size={12} weight="bold" className="text-foreground/55" />
                <span className="text-xs">{label}</span>
              </MenubarItem>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </SidebarRow>
  );
}
