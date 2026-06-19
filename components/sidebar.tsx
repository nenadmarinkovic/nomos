"use client";

import * as React from "react";
import {
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  EyeIcon,
  GlobeIcon,
  PulseIcon,
  ScrollIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SectionKey = "world" | "agents" | "observers" | "metrics" | "log";

interface SidebarProps {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  collapsed: boolean;
  onToggle?: () => void;
}

type SectionDef = {
  key: SectionKey;
  label: string;
  icon: typeof GlobeIcon;
};

const SETUP: SectionDef[] = [
  { key: "world", label: "World", icon: GlobeIcon },
  { key: "agents", label: "Agents", icon: UsersThreeIcon },
  { key: "observers", label: "Observers", icon: EyeIcon },
];

const RUN: SectionDef[] = [
  { key: "metrics", label: "Metrics", icon: PulseIcon },
  { key: "log", label: "Chronicle", icon: ScrollIcon },
];

export function Sidebar({
  active,
  onSelect,
  collapsed,
  onToggle,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "group/sidebar relative hidden h-full shrink-0 flex-col border-r border-foreground/10 bg-card/40 font-sans transition-[width] duration-200 md:flex",
        collapsed ? "w-[60px]" : "w-56",
      )}
    >
      <ScrollArea className="flex-1">
        <div
          className={cn(
            "space-y-5 pb-3 pt-4",
            collapsed ? "px-1.5" : "px-2",
          )}
        >
          <NavGroup
            label="Setup"
            sections={SETUP}
            active={active}
            onSelect={onSelect}
            collapsed={collapsed}
          />
          <NavGroup
            label="Run"
            sections={RUN}
            active={active}
            onSelect={onSelect}
            collapsed={collapsed}
          />
        </div>
      </ScrollArea>

      <div
        aria-hidden
        className="h-14 shrink-0 border-t border-foreground/10"
      />

      {onToggle && (
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="group/handle absolute -right-3 top-0 z-50 flex h-full w-6 cursor-col-resize items-center justify-center"
        >
          <div className="absolute right-[11px] top-0 h-full w-px transition-colors duration-150 group-hover/handle:bg-foreground/20" />
          <div className="relative opacity-0 transition-opacity duration-150 group-hover/handle:opacity-100">
            <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-background" />
            <div className="relative flex size-6 items-center justify-center rounded-full border border-foreground/10 bg-background text-muted-foreground hover:text-foreground">
              {collapsed ? (
                <CaretRightIcon size={12} weight="bold" />
              ) : (
                <CaretLeftIcon size={12} weight="bold" />
              )}
            </div>
          </div>
        </button>
      )}
    </aside>
  );
}

function NavGroup({
  label,
  sections,
  active,
  onSelect,
  collapsed,
}: {
  label: string;
  sections: SectionDef[];
  active: SectionKey;
  onSelect: (k: SectionKey) => void;
  collapsed: boolean;
}) {
  return (
    <div>
      {!collapsed && (
        <div className="px-2.5 pb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
          {label}
        </div>
      )}
      <nav className="flex flex-col gap-px">
        {sections.map(({ key, label: itemLabel, icon: Icon }) => {
          const isActive = active === key;
          const button = (
            <button
              type="button"
              onClick={() => onSelect(key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex cursor-pointer items-center rounded-md text-left text-[13px] transition-colors",
                isActive
                  ? "bg-foreground/[0.06] text-foreground"
                  : "text-foreground/65 hover:bg-foreground/[0.03] hover:text-foreground",
                collapsed
                  ? "h-10 justify-center"
                  : "justify-between gap-2.5 px-2.5 py-2",
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  size={18}
                  weight="regular"
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-foreground" : "text-foreground/40",
                  )}
                />
                {!collapsed && (
                  <span className="leading-tight">{itemLabel}</span>
                )}
              </div>
              {!collapsed && (
                <ArrowRightIcon
                  size={11}
                  weight="bold"
                  className={cn(
                    "shrink-0 transition-all duration-200",
                    isActive
                      ? "opacity-100"
                      : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                  )}
                />
              )}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={key}>
                <TooltipTrigger render={button} />
                <TooltipContent side="right" sideOffset={8}>
                  {itemLabel}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <React.Fragment key={key}>{button}</React.Fragment>;
        })}
      </nav>
    </div>
  );
}

export type { SectionKey };
