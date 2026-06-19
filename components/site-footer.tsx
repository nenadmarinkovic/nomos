"use client";

interface SiteFooterProps {
  turn: number;
  agentCount: number;
  aliveCount: number;
  gini: number;
  observerCount: number;
  started: boolean;
}

export function SiteFooter({
  turn,
  agentCount,
  aliveCount,
  gini,
  observerCount,
  started,
}: SiteFooterProps) {
  return (
    <footer className="flex h-14 shrink-0 items-center justify-between border-t border-foreground/10 bg-background px-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs text-muted-foreground">
        <Stat label="Turn" value={turn.toString().padStart(5, "0")} />
        <Stat
          label="Alive"
          value={
            started
              ? `${aliveCount.toLocaleString()} / ${agentCount.toLocaleString()}`
              : agentCount.toLocaleString()
          }
        />
        <Stat label="Gini" value={started ? gini.toFixed(3) : "—"} />
        <Stat label="Observers" value={observerCount.toString()} />
      </div>
    </footer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </span>
      <span className="tabular-nums text-foreground/90">{value}</span>
    </span>
  );
}
