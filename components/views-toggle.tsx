"use client";

import {
  ArrowDownLeftIcon,
  ArrowDownRightIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
  CornersOutIcon,
} from "@phosphor-icons/react";

import {
  SidebarRow,
  SidebarSection,
  SidebarSectionAction,
} from "@/components/sidebar-section";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Switch } from "@/components/ui/switch";
import { useSimulationStore, type ViewKey } from "@/lib/store";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "gini", label: "Inequality" },
  { key: "alive", label: "Alive" },
  { key: "wealth", label: "Wealth" },
  { key: "price", label: "Price" },
  { key: "stream", label: "Motivations" },
  { key: "money", label: "IOUs" },
  { key: "trust", label: "Trust" },
  { key: "narrator", label: "Narrator" },
];

type CornerKey = "tl" | "tr" | "bl" | "br";

const CORNERS: {
  key: CornerKey;
  label: string;
  Icon: typeof ArrowUpLeftIcon;
}[] = [
  { key: "tl", label: "Top-left", Icon: ArrowUpLeftIcon },
  { key: "tr", label: "Top-right", Icon: ArrowUpRightIcon },
  { key: "bl", label: "Bottom-left", Icon: ArrowDownLeftIcon },
  { key: "br", label: "Bottom-right", Icon: ArrowDownRightIcon },
];

export function ViewsToggle() {
  const started = useSimulationStore((s) => s.started);
  const views = useSimulationStore((s) => s.views);
  const toggleView = useSimulationStore((s) => s.toggleView);
  const setAllViews = useSimulationStore((s) => s.setAllViews);
  const alignWindows = useSimulationStore((s) => s.alignWindows);

  if (!started) return null;

  const anyVisible = Object.values(views).some(Boolean);

  return (
    <SidebarSection
      title="Windows"
      action={
        <SidebarSectionAction onClick={() => setAllViews(!anyVisible)}>
          {anyVisible ? "Hide all" : "Show all"}
        </SidebarSectionAction>
      }
    >
      {VIEWS.map((v) => {
        const id = `view-${v.key}`;
        return (
          <SidebarRow key={v.key} label={v.label} htmlFor={id}>
            <Switch
              id={id}
              size="sm"
              checked={views[v.key]}
              onCheckedChange={() => toggleView(v.key)}
            />
          </SidebarRow>
        );
      })}

      <SidebarRow
        label="Align to"
        className="mt-1.5 border-t border-foreground/10 pt-1.5"
      >
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger className="text-foreground/55 hover:text-foreground">
              <CornersOutIcon size={11} weight="bold" />
              Corner
            </MenubarTrigger>
            <MenubarContent align="end">
              {CORNERS.map(({ key, label, Icon }) => (
                <MenubarItem key={key} onSelect={() => alignWindows(key)}>
                  <Icon
                    size={12}
                    weight="bold"
                    className="text-foreground/55"
                  />
                  <span className="text-xs">{label}</span>
                </MenubarItem>
              ))}
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </SidebarRow>
    </SidebarSection>
  );
}
