"use client";

import {
  ArrowDownLeftIcon,
  ArrowDownRightIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
  CornersOutIcon,
} from "@phosphor-icons/react";

import { Label } from "@/components/ui/label";
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
  { key: "gini", label: "Gini" },
  { key: "alive", label: "Alive" },
  { key: "wealth", label: "Wealth" },
  { key: "price", label: "Price" },
  { key: "narrator", label: "Narrator" },
  { key: "network", label: "Network" },
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
    <div className="space-y-2 px-3 py-2.5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Windows
          </span>
          <button
            type="button"
            onClick={() => setAllViews(!anyVisible)}
            className="cursor-pointer font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {anyVisible ? "Hide all" : "Show all"}
          </button>
        </div>
        <div className="flex flex-col">
          {VIEWS.map((v) => {
            const id = `view-${v.key}`;
            return (
              <div
                key={v.key}
                className="flex items-center justify-between gap-2 py-0.5"
              >
                <Label
                  htmlFor={id}
                  className="cursor-pointer font-sans text-[12px] text-foreground/85"
                >
                  {v.label}
                </Label>
                <Switch
                  id={id}
                  size="sm"
                  checked={views[v.key]}
                  onCheckedChange={() => toggleView(v.key)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-foreground/10 pt-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Align
        </span>
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>
              <CornersOutIcon size={11} weight="bold" />
              Corner
            </MenubarTrigger>
            <MenubarContent align="end">
              {CORNERS.map(({ key, label, Icon }) => (
                <MenubarItem key={key} onSelect={() => alignWindows(key)}>
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
    </div>
  );
}
