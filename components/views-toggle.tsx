"use client";

import {
  ArrowDownLeftIcon,
  ArrowDownRightIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
} from "@phosphor-icons/react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSimulationStore, type ViewKey } from "@/lib/store";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "gini", label: "Gini" },
  { key: "alive", label: "Alive" },
  { key: "wealth", label: "Wealth" },
  { key: "narrator", label: "Narrator" },
  { key: "network", label: "Network" },
];

type CornerKey = "tl" | "tr" | "bl" | "br";

const CORNERS: { key: CornerKey; Icon: typeof ArrowUpLeftIcon }[] = [
  { key: "tl", Icon: ArrowUpLeftIcon },
  { key: "tr", Icon: ArrowUpRightIcon },
  { key: "bl", Icon: ArrowDownLeftIcon },
  { key: "br", Icon: ArrowDownRightIcon },
];

export function ViewsToggle() {
  const started = useSimulationStore((s) => s.started);
  const views = useSimulationStore((s) => s.views);
  const toggleView = useSimulationStore((s) => s.toggleView);
  const resetWindows = useSimulationStore((s) => s.resetWindows);
  const alignWindows = useSimulationStore((s) => s.alignWindows);

  if (!started) return null;

  return (
    <div className="space-y-2 px-3 py-2.5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Windows
          </span>
          <button
            type="button"
            onClick={resetWindows}
            className="cursor-pointer font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Reset
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
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-foreground/15">
          {CORNERS.map(({ key, Icon }, i) => {
            const isLeft = i % 2 === 0;
            const isTop = i < 2;
            return (
              <button
                key={key}
                type="button"
                onClick={() => alignWindows(key)}
                aria-label={`Align windows ${key}`}
                title={key.toUpperCase()}
                className={[
                  "flex size-7 cursor-pointer items-center justify-center bg-card transition-colors hover:bg-foreground/[0.06]",
                  !isLeft && "border-l border-foreground/15",
                  !isTop && "border-t border-foreground/15",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Icon
                  size={12}
                  weight="bold"
                  className="text-muted-foreground"
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
