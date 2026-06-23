"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightIcon,
  BookOpenIcon,
  CaretLeftIcon,
  CaretRightIcon,
  EyeIcon,
  GlobeIcon,
  PulseIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { CanvasLegend } from "@/components/canvas-legend";
import { CanvasViewToggle } from "@/components/canvas-view-toggle";
import { SidebarFooter } from "@/components/sidebar-footer";
import { ViewsToggle } from "@/components/views-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type SectionKey = "world" | "agents" | "metrics" | "narrator" | "docs";

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
}

type SectionDef = {
  key: SectionKey;
  href: string;
  label: string;
  icon: typeof GlobeIcon;
};

const SECTIONS: SectionDef[] = [
  { key: "world", href: "/", label: "World", icon: GlobeIcon },
  { key: "agents", href: "/agents", label: "Agents", icon: UsersThreeIcon },
  { key: "metrics", href: "/metrics", label: "Metrics", icon: PulseIcon },
  { key: "narrator", href: "/narrator", label: "Narrator", icon: EyeIcon },
  { key: "docs", href: "/docs", label: "Docs", icon: BookOpenIcon },
];

export function sectionFromPath(pathname: string): SectionKey {
  if (pathname.startsWith("/agents")) return "agents";
  if (pathname.startsWith("/metrics")) return "metrics";
  if (pathname.startsWith("/narrator")) return "narrator";
  if (pathname.startsWith("/docs")) return "docs";
  return "world";
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname() ?? "/";
  const active = sectionFromPath(pathname);

  return (
    <aside
      className={cn(
        "group/sidebar relative hidden h-full shrink-0 flex-col border-r border-foreground/10 bg-background font-sans transition-[width] duration-200 md:flex",
        collapsed ? "w-[60px]" : "w-56",
      )}
    >
      <ScrollArea className="flex-1">
        <div
          className={cn(
            "pb-3 pt-4",
            collapsed ? "px-1.5" : "px-2",
          )}
        >
          <NavGroup
            sections={SECTIONS}
            active={active}
            collapsed={collapsed}
          />
        </div>
      </ScrollArea>

      {!collapsed && (
        <div className="flex shrink-0 flex-col empty:hidden">
          <div className="border-t border-foreground/10 empty:hidden">
            <CanvasViewToggle />
          </div>
          <div className="border-t border-foreground/10 empty:hidden">
            <ViewsToggle />
          </div>
          <div className="border-t border-foreground/10 empty:hidden">
            <CanvasLegend />
          </div>
        </div>
      )}
      <SidebarFooter collapsed={collapsed} />

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
  sections,
  active,
  collapsed,
}: {
  sections: SectionDef[];
  active: SectionKey;
  collapsed: boolean;
}) {
  return (
    <nav className="flex flex-col gap-px">
      {sections.map(({ key, href, label: itemLabel, icon: Icon }) => {
        const isActive = active === key;
        const link = (
          <Link
            href={href}
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
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={key}>
              <TooltipTrigger render={link} />
              <TooltipContent side="right" sideOffset={8}>
                {itemLabel}
              </TooltipContent>
            </Tooltip>
          );
        }

        return <React.Fragment key={key}>{link}</React.Fragment>;
      })}
    </nav>
  );
}
