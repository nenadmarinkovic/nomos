"use client";

import { useCallback } from "react";

import { PageWelcome } from "@/components/page-welcome";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SnapshotBadge } from "@/components/snapshot-badge";
import { SCALE_INFO } from "@/lib/config";
import { useSimulationStore } from "@/lib/store";
import {
  useStoreSnapshot,
  useWorldSnapshot,
} from "@/lib/use-world-snapshot";
import type { WorldView } from "@/lib/world";

export function MetricsPage() {
  const started = useSimulationStore((s) => s.started);
  const config = useSimulationStore((s) => s.config);
  const liveSnapshot = useSimulationStore((s) => s.snapshot);

  const sample = useWorldSnapshot(
    useCallback((world: WorldView) => computeAdvanced(world.agents), []),
  );
  const advanced = sample.data;

  // Bind the summary numbers to the sample cadence so the page is fully
  // frozen between explicit refreshes.
  const snapshot = useStoreSnapshot(liveSnapshot, sample.turn);

  if (!started) {
    return (
      <PageWelcome
        eyebrow="Metrics · The numbers"
        headline={
          <>
            Read a society&rsquo;s{" "}
            <em className="text-brand">body language</em> in plain numbers.
          </>
        }
        lead={
          <>
            Nomos doesn&rsquo;t program inequality, classes, or markets — they
            emerge or they don&rsquo;t. The measures on this page are how that
            emergence reveals itself in aggregate. None of them are inputs.
            All of them are outputs of what the conditions produced.
          </>
        }
        steps={[
          {
            n: "01",
            title: "Gini coefficient",
            body: "Wealth concentration on a 0 → 1 scale. 0 means everyone holds the same; 1 means a single agent holds everything. Watch it rise and you&rsquo;re watching an oligarchy form bottom-up.",
          },
          {
            n: "02",
            title: "Trade price",
            body: "Sugar per spice. There is no global market rule — the price you see is the geometric mean of every local Pareto-improving exchange this tick. A market <em>emerges</em> from individual gains, then a price <em>emerges</em> from the market.",
          },
          {
            n: "03",
            title: "Demography",
            body: "Mean age, oldest, youth share. Whether the society is replacing itself, slowing into stagnation, or aging toward collapse.",
          },
          {
            n: "04",
            title: "Distribution",
            body: "Top 10% holds, bottom 50% holds, median and mean wealth — where on the Lorenz curve the run is sitting, in plain numbers. The story the Gini summarises in one digit.",
          },
        ]}
      />
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-8">
        <Header
          badge={
            <SnapshotBadge
              turn={sample.turn}
              stale={sample.stale}
              onRefresh={sample.refresh}
            />
          }
        />

        <div className="mt-8 space-y-10">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Summary
              label="Turn"
              value={snapshot.turn.toString().padStart(5, "0")}
            />
            <Summary
              label="Alive"
              value={`${snapshot.alive.toLocaleString()} / ${SCALE_INFO[
                config.world.scale
              ].agents.toLocaleString()}`}
            />
            <Summary
              label="Gini"
              value={snapshot.gini.toFixed(3)}
              hint="wealth concentration"
            />
            <Summary
              label="Trade price"
              value={
                snapshot.tradePrice > 0 ? snapshot.tradePrice.toFixed(3) : "—"
              }
              hint="sugar per spice"
            />
          </section>

          {advanced && (
            <section className="space-y-3">
              <SectionTitle
                title="Derived"
                hint="Numbers the windows compress away."
              />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Summary
                  label="Mean age"
                  value={`${advanced.meanAge.toFixed(1)}t`}
                />
                <Summary label="Oldest" value={`${advanced.maxAge}t`} />
                <Summary
                  label="Youth share"
                  value={`${(advanced.youthShare * 100).toFixed(0)}%`}
                />
                <Summary
                  label="Spice-rich"
                  value={`${(advanced.spiceRichShare * 100).toFixed(0)}%`}
                />
                <Summary
                  label="Top 10% holds"
                  value={`${(advanced.top10Share * 100).toFixed(1)}%`}
                />
                <Summary
                  label="Bottom 50% holds"
                  value={`${(advanced.bottom50Share * 100).toFixed(1)}%`}
                />
                <Summary
                  label="Median wealth"
                  value={advanced.medianWealth.toFixed(2)}
                />
                <Summary
                  label="Mean wealth"
                  value={advanced.meanWealth.toFixed(2)}
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function Header({ badge }: { badge?: React.ReactNode }) {
  return (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Metrics · Signals
        </p>
        {badge}
      </div>
      <h1 className="font-serif text-3xl leading-tight tracking-tight text-foreground">
        What the numbers say.
      </h1>
      <p className="font-serif text-[15px] leading-relaxed text-foreground/70">
        Time series of the headline measures, plus the shape underneath — who
        holds what, how old they are, how the market is moving. Snapshotted on
        arrival; press Refresh to take a fresh sample.
      </p>
    </header>
  );
}

function Summary({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-foreground/10 bg-card/40 px-3 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-[18px] tabular-nums text-foreground">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 font-sans text-[11px] text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-1">
      <h2 className="font-serif text-xl leading-tight text-foreground">
        {title}
      </h2>
      <p className="font-sans text-[12px] text-muted-foreground">{hint}</p>
    </div>
  );
}

interface AgentForStats {
  alive: boolean;
  age: number;
  maxAge: number;
  sugar: number;
  spice: number;
}

interface AdvancedMetrics {
  meanAge: number;
  maxAge: number;
  youthShare: number;
  meanWealth: number;
  medianWealth: number;
  top10Share: number;
  bottom50Share: number;
  spiceRichShare: number;
}

function computeAdvanced(
  agents: readonly AgentForStats[],
): AdvancedMetrics {
  let count = 0;
  let totalAge = 0;
  let maxAge = 0;
  let youthCount = 0;
  let spiceRich = 0;
  const wealths: number[] = [];

  for (const a of agents) {
    if (!a.alive) continue;
    count++;
    totalAge += a.age;
    if (a.age > maxAge) maxAge = a.age;
    if (a.age < a.maxAge * 0.25) youthCount++;
    if (a.spice > a.sugar) spiceRich++;
    wealths.push(a.sugar + a.spice);
  }

  if (count === 0) {
    return {
      meanAge: 0,
      maxAge: 0,
      youthShare: 0,
      meanWealth: 0,
      medianWealth: 0,
      top10Share: 0,
      bottom50Share: 0,
      spiceRichShare: 0,
    };
  }

  wealths.sort((a, b) => a - b);
  const total = wealths.reduce((s, w) => s + w, 0);
  const median =
    wealths.length % 2 === 0
      ? (wealths[wealths.length / 2 - 1] + wealths[wealths.length / 2]) / 2
      : wealths[Math.floor(wealths.length / 2)];
  const top10Idx = Math.floor(wealths.length * 0.9);
  const top10Sum = wealths.slice(top10Idx).reduce((s, w) => s + w, 0);
  const bottom50Idx = Math.floor(wealths.length * 0.5);
  const bottom50Sum = wealths.slice(0, bottom50Idx).reduce((s, w) => s + w, 0);

  return {
    meanAge: totalAge / count,
    maxAge,
    youthShare: youthCount / count,
    meanWealth: total / count,
    medianWealth: median,
    top10Share: total > 0 ? top10Sum / total : 0,
    bottom50Share: total > 0 ? bottom50Sum / total : 0,
    spiceRichShare: spiceRich / count,
  };
}
