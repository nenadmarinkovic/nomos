"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSimulationStore, type ViewKey } from "@/lib/store";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "gini", label: "Gini" },
  { key: "alive", label: "Alive" },
  { key: "wealth", label: "Wealth" },
];

export function ViewsToggle() {
  const views = useSimulationStore((s) => s.views);
  const toggleView = useSimulationStore((s) => s.toggleView);

  return (
    <div className="space-y-2.5 px-3 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Views
      </div>
      <div className="flex flex-col gap-1.5">
        {VIEWS.map((v) => {
          const id = `view-${v.key}`;
          return (
            <div
              key={v.key}
              className="flex items-center justify-between gap-2"
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
  );
}
