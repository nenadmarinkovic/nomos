"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CaretRightIcon,
  PauseIcon,
  PlayIcon,
  SidebarSimpleIcon,
  StopIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RunLibrary } from "@/components/run-library";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SectionKey } from "@/components/sidebar";
import { useSimulationStore } from "@/lib/store";

const SPEEDS: { label: string; value: number }[] = [
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "4×", value: 4 },
  { label: "Max", value: 8 },
];

interface SiteHeaderProps {
  running: boolean;
  paused: boolean;
  sidebarCollapsed: boolean;
  activeSection: SectionKey;
  onToggleSidebar?: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const SECTION_LABELS: Record<SectionKey, { group: string; label: string }> = {
  world: { group: "Run", label: "World" },
  agents: { group: "Run", label: "Agents" },
  metrics: { group: "Run", label: "Metrics" },
  narrator: { group: "Run", label: "Narrator" },
};

export function SiteHeader({
  running,
  paused,
  sidebarCollapsed,
  activeSection,
  onToggleSidebar,
  onPause,
  onResume,
  onStop,
}: SiteHeaderProps) {
  const router = useRouter();
  const breadcrumb = SECTION_LABELS[activeSection];
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const speed = useSimulationStore((s) => s.speed);
  const setSpeed = useSimulationStore((s) => s.setSpeed);

  const action: "pause" | "resume" | "run" = running
    ? "pause"
    : paused
      ? "resume"
      : "run";

  const showStop = running || paused;
  const showSpeed = running || paused;

  function handleClick() {
    if (action === "pause") onPause();
    else if (action === "resume") onResume();
    else router.push("/setup");
  }

  function confirmStop() {
    onStop();
    setStopConfirmOpen(false);
  }

  return (
    <header className="flex h-14 shrink-0 items-stretch border-b border-foreground/10 bg-background">
      <div
        className={cn(
          "hidden shrink-0 items-center border-foreground/10 px-4 transition-[width] duration-200 md:flex md:border-r",
          sidebarCollapsed ? "md:w-[60px]" : "md:w-56",
        )}
      >
        <Link href="/" aria-label="Nomos" className="flex items-center gap-2">
          <Image
            src="/logo.svg"
            alt="Nomos"
            width={38}
            height={35}
            priority
            className="h-10 w-auto dark:invert"
          />
          {!sidebarCollapsed && (
            <span className="flex flex-col font-sans text-[10px] leading-[1.2] font-medium text-foreground/75">
              <span>Nomos, a generative</span>
              <span>society simulation.</span>
            </span>
          )}
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
          {showSpeed && (
            <div
              role="radiogroup"
              aria-label="Simulation speed"
              className="hidden items-center gap-0.5 rounded-md border border-foreground/10 bg-card p-0.5 sm:flex"
            >
              {SPEEDS.map((s) => {
                const active = s.value === speed;
                return (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSpeed(s.value)}
                    className={cn(
                      "cursor-pointer rounded-[4px] px-2 py-1 font-mono text-[11px] tabular-nums transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}
          <RunLibrary />
          {showStop && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStopConfirmOpen(true)}
            >
              <StopIcon weight="fill" />
              Stop
            </Button>
          )}
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

        <Dialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Stop this simulation?</DialogTitle>
              <DialogDescription>
                The current run will end and the turn counter will reset to
                zero. Your settings are kept — you can begin a new run any time.
                If you only want to step away for a moment, use Pause instead.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="border-t-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStopConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={confirmStop}>
                <StopIcon weight="fill" />
                Stop simulation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
