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

import { useSimulationStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CanvasLegend } from "@/components/canvas-legend";
import { CanvasViewToggle } from "@/components/canvas-view-toggle";
import { MonochromeToggle } from "@/components/monochrome-toggle";
import { SidebarFooter } from "@/components/sidebar-footer";
import { SIDEBAR_TONE, SidebarSection } from "@/components/sidebar-section";
import { ViewsToggle } from "@/components/views-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

type NavGroupDef = {
  title: string;
  sections: SectionDef[];
};

/**
 * The nav, and the only place the grouping is defined. The header breadcrumb
 * reads its first crumb from here via `sectionGroupTitle`, so a section can
 * never sit under one heading in the sidebar and another in the header.
 */
const NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Simulation",
    sections: [{ key: "world", href: "/", label: "World", icon: GlobeIcon }],
  },
  {
    title: "Analysis",
    sections: [
      { key: "agents", href: "/agents", label: "Agents", icon: UsersThreeIcon },
      { key: "metrics", href: "/metrics", label: "Metrics", icon: PulseIcon },
      { key: "narrator", href: "/narrator", label: "Narrator", icon: EyeIcon },
    ],
  },
  {
    title: "Reference",
    sections: [
      { key: "docs", href: "/docs", label: "Docs", icon: BookOpenIcon },
    ],
  },
];

export function sectionLabel(key: SectionKey): string {
  for (const group of NAV_GROUPS) {
    const section = group.sections.find((s) => s.key === key);
    if (section) return section.label;
  }
  return key;
}

export function sectionGroupTitle(key: SectionKey): string {
  for (const group of NAV_GROUPS) {
    if (group.sections.some((s) => s.key === key)) return group.title;
  }
  return "";
}

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
        "group/sidebar relative hidden h-full shrink-0 flex-col border-r border-foreground/10 bg-background transition-[width] duration-200 md:flex",
        collapsed ? "w-15" : "w-56",
      )}
    >
      <SidebarBody collapsed={collapsed} active={active} />

      {onToggle && (
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="group/handle absolute -right-3 top-0 z-50 flex h-full w-6 cursor-col-resize items-center justify-center"
        >
          <div className="absolute right-2.75 top-0 h-full w-px transition-colors duration-150 group-hover/handle:bg-foreground/20" />
          <div className="relative opacity-0 transition-opacity duration-150 group-hover/handle:opacity-100">
            <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-background" />
            <div className="relative flex size-6 items-center justify-center rounded-full border border-foreground/10 bg-background text-foreground/55 transition-colors hover:text-foreground">
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

export function MobileNav({
  open,
  onOpenChange,
  restoreFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocusRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  const pathname = usePathname() ?? "/";
  const active = sectionFromPath(pathname);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="md:hidden"
        id="sidebar-nav"
        onCloseAutoFocus={(e) => {
          if (!restoreFocusRef?.current) return;
          e.preventDefault();
          restoreFocusRef.current.focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>Nomos</SheetTitle>
        </SheetHeader>
        <SidebarBody
          collapsed={false}
          active={active}
          onNavigate={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function SidebarBody({
  collapsed,
  active,
  onNavigate,
}: {
  collapsed: boolean;
  active: SectionKey;
  onNavigate?: () => void;
}) {
  const started = useSimulationStore((s) => s.started);

  return (
    <>
      <ScrollArea className="flex-1">
        <div className={cn("pb-3 pt-4", collapsed ? "px-1.5" : "px-2")}>
          {NAV_GROUPS.map((group, i) => (
            <NavGroup
              key={group.title}
              title={group.title}
              sections={group.sections}
              active={active}
              collapsed={collapsed}
              first={i === 0}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </ScrollArea>

      {!collapsed && started && (
        <div className="flex shrink-0 flex-col">
          <SidebarSection title="Canvas">
            <CanvasViewToggle />
            <MonochromeToggle />
            <CanvasLegend />
          </SidebarSection>
          <ViewsToggle />
        </div>
      )}
      <SidebarFooter collapsed={collapsed} />
    </>
  );
}

function NavGroup({
  title,
  sections,
  active,
  collapsed,
  first,
  onNavigate,
}: {
  title: string;
  sections: SectionDef[];
  active: SectionKey;
  collapsed: boolean;
  first: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label={title}
      className={cn(
        "flex flex-col gap-px",
        !first &&
          (collapsed ? "mt-2 border-t border-foreground/10 pt-2" : "mt-5"),
      )}
    >
      {!collapsed && (
        <h2
          className={cn(
            "px-2.5 pb-1.5 font-mono text-xs uppercase tracking-[0.16em]",
            SIDEBAR_TONE.faint,
          )}
        >
          {title}
        </h2>
      )}
      {sections.map(({ key, href, label: itemLabel, icon: Icon }) => {
        const isActive = active === key;
        const link = (
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex cursor-pointer items-center rounded-md text-left text-[15px] transition-colors",
              isActive
                ? "bg-foreground/6 font-semibold text-foreground"
                : "font-medium text-foreground/75 hover:bg-foreground/4 hover:text-foreground",
              collapsed
                ? "h-10 justify-center"
                : "justify-between gap-2.5 px-2.5 py-2",
            )}
          >
            <div className="flex items-center gap-2.5">
              {/* No colour of its own: currentColor keeps the glyph on exactly
                  the same tone as the label beside it, in every state. */}
              <Icon size={19} weight="regular" className="shrink-0" />
              {!collapsed && <span className="leading-tight">{itemLabel}</span>}
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
