"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CaretRightIcon,
  PauseIcon,
  PlayIcon,
  SidebarSimpleIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SectionKey } from "@/components/sidebar";

interface SiteHeaderProps {
  running: boolean;
  paused: boolean;
  sidebarCollapsed: boolean;
  activeSection: SectionKey;
  onToggleSidebar?: () => void;
  onPause: () => void;
  onResume: () => void;
}

const SECTION_LABELS: Record<SectionKey, { group: string; label: string }> = {
  world: { group: "Setup", label: "World" },
  agents: { group: "Setup", label: "Agents" },
  observers: { group: "Setup", label: "Observers" },
  metrics: { group: "Run", label: "Metrics" },
  log: { group: "Run", label: "Chronicle" },
};

export function SiteHeader({
  running,
  paused,
  sidebarCollapsed,
  activeSection,
  onToggleSidebar,
  onPause,
  onResume,
}: SiteHeaderProps) {
  const router = useRouter();
  const breadcrumb = SECTION_LABELS[activeSection];

  const action: "pause" | "resume" | "run" = running
    ? "pause"
    : paused
      ? "resume"
      : "run";

  function handleClick() {
    if (action === "pause") onPause();
    else if (action === "resume") onResume();
    else router.push("/setup");
  }

  return (
    <header className="flex h-14 shrink-0 items-stretch border-b border-foreground/10 bg-background">
      <div
        className={cn(
          "hidden shrink-0 items-center border-foreground/10 px-4 transition-[width] duration-200 md:flex md:border-r",
          sidebarCollapsed ? "md:w-[60px]" : "md:w-56",
        )}
      >
        <Link href="/" aria-label="Nomos" className="flex items-center">
          <Image
            src="/logo.svg"
            alt="Nomos"
            width={38}
            height={35}
            priority
            className="h-12 w-auto dark:invert"
          />
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-between gap-4 px-3 md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            aria-label="Nomos"
            className="flex items-center md:hidden"
          >
            <Image
              src="/logo.svg"
              alt="Nomos"
              width={38}
              height={35}
              priority
              className="h-8 w-auto dark:invert"
            />
          </Link>

          {onToggleSidebar && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onToggleSidebar}
                    aria-label={
                      sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                    }
                    className="flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    <SidebarSimpleIcon size={18} weight="regular" />
                  </button>
                }
              />
              <TooltipContent side="bottom" sideOffset={6}>
                {sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          )}

          <nav
            aria-label="breadcrumb"
            className="flex min-w-0 items-center gap-2 font-sans text-xs"
          >
            <span className="text-muted-foreground">{breadcrumb.group}</span>
            <CaretRightIcon
              size={12}
              weight="bold"
              className="shrink-0 text-muted-foreground/50"
            />
            <span className="truncate text-foreground">{breadcrumb.label}</span>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Button
            variant={action === "pause" ? "secondary" : "default"}
            size="sm"
            onClick={handleClick}
          >
            {action === "pause" ? (
              <PauseIcon weight="fill" />
            ) : (
              <PlayIcon weight="fill" />
            )}
            {action === "pause"
              ? "Pause"
              : action === "resume"
                ? "Resume"
                : "Run"}
          </Button>
        </div>
      </div>
    </header>
  );
}
