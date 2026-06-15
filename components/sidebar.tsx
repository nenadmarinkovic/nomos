"use client";

import { Eye, Globe, Pulse, Scroll, UsersThree } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type SectionKey = "world" | "agents" | "observers" | "metrics" | "log";

interface SidebarProps {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  agentCount: number;
  observerCount: number;
}

type SectionDef = {
  key: SectionKey;
  label: string;
  icon: typeof Globe;
};

const SETUP: SectionDef[] = [
  { key: "world", label: "World", icon: Globe },
  { key: "agents", label: "Agents", icon: UsersThree },
  { key: "observers", label: "Observers", icon: Eye },
];

const RUN: SectionDef[] = [
  { key: "metrics", label: "Metrics", icon: Pulse },
  { key: "log", label: "Chronicle", icon: Scroll },
];

export function Sidebar({
  active,
  onSelect,
  agentCount,
  observerCount,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-foreground/10 bg-card/40 font-sans">
      <ScrollArea className="flex-1">
        <div className="space-y-5 px-2 pt-4 pb-3">
          <NavGroup
            label="Setup"
            sections={SETUP}
            active={active}
            onSelect={onSelect}
          />
          <NavGroup
            label="Run"
            sections={RUN}
            active={active}
            onSelect={onSelect}
          />
        </div>
      </ScrollArea>

      <div className="border-t border-foreground/10 px-3 py-3 text-[11px]">
        <Stat label="Agents" value={agentCount.toLocaleString()} />
        <Stat label="Observers" value={observerCount.toString()} />
      </div>
    </aside>
  );
}

function NavGroup({
  label,
  sections,
  active,
  onSelect,
}: {
  label: string;
  sections: SectionDef[];
  active: SectionKey;
  onSelect: (k: SectionKey) => void;
}) {
  return (
    <div>
      <div className="px-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </div>
      <nav className="flex flex-col gap-px">
        {sections.map(({ key, label: itemLabel, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
                isActive
                  ? "bg-foreground/[0.06] text-foreground"
                  : "text-foreground/65 hover:bg-foreground/[0.03] hover:text-foreground",
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -left-2 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-brand"
                />
              )}
              <Icon
                size={14}
                weight="regular"
                className={cn(
                  "shrink-0 transition-colors",
                  isActive ? "text-foreground" : "text-foreground/40",
                )}
              />
              <span className="leading-tight">{itemLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-foreground/90">{value}</span>
    </div>
  );
}

export type { SectionKey };
