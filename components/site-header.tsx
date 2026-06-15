"use client";

import Link from "next/link";
import { Pause, Play, SlidersHorizontal } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

interface SiteHeaderProps {
  running: boolean;
  tick: number;
  onRunToggle: () => void;
  onOpenSettings: () => void;
}

export function SiteHeader({
  running,
  tick,
  onRunToggle,
  onOpenSettings,
}: SiteHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-foreground/10 bg-background px-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <span aria-label="Nomos" className="size-3 rounded-full bg-brand" />
          <span className="relative top-px font-serif text-lg italic leading-none tracking-tight text-foreground">
            Nomos
          </span>
        </Link>
        <Separator orientation="vertical" className="!h-4" />
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          tick {tick.toString().padStart(5, "0")}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          aria-label="Initial conditions"
        >
          <SlidersHorizontal weight="regular" />
          Conditions
        </Button>
        <Button
          variant={running ? "secondary" : "default"}
          size="sm"
          onClick={onRunToggle}
        >
          {running ? (
            <Pause weight="fill" />
          ) : (
            <Play weight="fill" />
          )}
          {running ? "Pause" : "Run"}
        </Button>
      </div>
    </header>
  );
}
