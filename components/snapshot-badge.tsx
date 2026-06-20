"use client";

import { ArrowsClockwiseIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

interface SnapshotBadgeProps {
  turn: number;
  stale: boolean;
  onRefresh: () => void;
}

export function SnapshotBadge({
  turn,
  stale,
  onRefresh,
}: SnapshotBadgeProps) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="group flex cursor-pointer items-center gap-2 rounded-md border border-foreground/10 bg-card/60 px-2.5 py-1.5 transition-colors hover:bg-foreground/[0.03]"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        As of
      </span>
      <span className="font-mono text-[12px] tabular-nums text-foreground">
        T{turn.toString().padStart(5, "0")}
      </span>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full transition-colors",
          stale ? "bg-amber-500/80" : "bg-emerald-500/80",
        )}
        title={stale ? "Older than the live turn" : "Up to date"}
      />
      <span className="mx-1 h-3 w-px bg-foreground/10" aria-hidden />
      <ArrowsClockwiseIcon
        size={12}
        weight="bold"
        className="text-muted-foreground transition-colors group-hover:text-foreground"
      />
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:text-foreground">
        Refresh
      </span>
    </button>
  );
}
