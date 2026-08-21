"use client";

import { type ReactNode, useCallback } from "react";
import { GreaterThanOrEqualIcon } from "@phosphor-icons/react";

import { PageWelcome } from "@/components/page-welcome";
import { RunConditions } from "@/components/run-conditions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SnapshotBadge } from "@/components/snapshot-badge";
import { SCALE_INFO } from "@/lib/config";
import { useSimulationStore } from "@/lib/store";
import { useStoreSnapshot, useWorldSnapshot } from "@/lib/use-world-snapshot";
import type { WorldView } from "@/lib/world";

export function MetricsPage() {
  const started = useSimulationStore((s) => s.started);
  const config = useSimulationStore((s) => s.config);
  const liveSnapshot = useSimulationStore((s) => s.snapshot);

  const sample = useWorldSnapshot(
    useCallback((world: WorldView) => computeAdvanced(world.agents), []),
  );
  const advanced = sample.data;

  const snapshot = useStoreSnapshot(liveSnapshot, sample.turn);

  if (!started) {
    return (
      <PageWelcome
        eyebrow="Metrics · The numbers"
        headline={<>The numbers that tell you how the run is going.</>}
        lead={
          <>
            Nothing on this page is a setting you chose. These are all
            measurements taken from what the agents actually did. If inequality
            shows up here, it is because the run produced it.
          </>
        }
        steps={[
          {
            n: "01",
            title: "Inequality (Gini)",
            body: "One number between 0 and 1 for how unevenly the food is spread. 0 means everyone holds the same amount. 1 means one agent holds everything. Most real countries sit somewhere between 0.25 and 0.6.",
          },
          {
            n: "02",
            title: "Trade price",
            body: "How much sugar a unit of spice goes for. Nobody sets this price. It is the average of every swap two neighbours agreed to this turn, because both of them came out ahead.",
          },
          {
            n: "03",
            title: "Ages",
            body: "Average age, the oldest agent alive, and how much of the population is young. This tells you whether the society is replacing itself or slowly dying out.",
          },
          {
            n: "04",
            title: "Who holds what",
            body: "How much the richest 10% hold, how much the poorest half hold, and the middle. This is the detail behind the single inequality number.",
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

        <div className="mt-6">
          <RunConditions />
        </div>

        <div className="mt-8 space-y-10">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
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
              hint="0 = equal, 1 = one agent has it all"
            />
            <Summary
              label="Trade price"
              value={
                snapshot.tradePrice > 0 ? snapshot.tradePrice.toFixed(3) : "—"
              }
              hint="sugar per unit of spice"
            />
            <Summary
              label="IOUs in circulation"
              value={
                snapshot.tokenSupply > 0
                  ? Math.round(snapshot.tokenSupply).toLocaleString()
                  : "—"
              }
              hint={
                snapshot.circulatingIssuers > 0
                  ? `${snapshot.circulatingIssuers} issuer${snapshot.circulatingIssuers === 1 ? "" : "s"} trusted by strangers`
                  : "no IOUs yet"
              }
            />
          </section>

          {advanced && (
            <section className="space-y-3">
              <SectionTitle
                title="More detail"
                hint="The numbers the small charts leave out."
              />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Summary
                  label="Average age"
                  value={`${advanced.meanAge.toFixed(1)}t`}
                />
                <Summary label="Oldest" value={`${advanced.maxAge}t`} />
                <Summary
                  label="Under a quarter of life"
                  value={`${(advanced.youthShare * 100).toFixed(0)}%`}
                />
                <Summary
                  label="Holding more spice"
                  value={`${(advanced.spiceRichShare * 100).toFixed(0)}%`}
                />
                <Summary
                  label="Richest 10% hold"
                  value={`${(advanced.top10Share * 100).toFixed(1)}%`}
                />
                <Summary
                  label="Poorest 50% hold"
                  value={`${(advanced.bottom50Share * 100).toFixed(1)}%`}
                />
                <Summary
                  label="Middle wealth"
                  value={advanced.medianWealth.toFixed(2)}
                />
                <Summary
                  label="Average wealth"
                  value={advanced.meanWealth.toFixed(2)}
                />
              </div>
            </section>
          )}

          <TokenEconomySection snapshot={snapshot} />
        </div>
      </div>
    </ScrollArea>
  );
}

function TokenEconomySection({
  snapshot,
}: {
  snapshot: {
    tokenSupply: number;
    tokenTradeVolume: number;
    topIssuerId: number;
    topIssuerLiability: number;
    circulatingIssuers: number;
  };
}) {
  const noTokens = snapshot.tokenSupply <= 0 && snapshot.topIssuerId === -1;
  return (
    <section className="space-y-3">
      <SectionTitle
        title="IOUs and money"
        hint="When an agent runs short on sugar it can write an IOU instead. Once one agent's IOUs are being held by people who never met them, that IOU has become money."
      />
      {noTokens ? (
        <div className="rounded-md border border-foreground/10 bg-card/40 px-4 py-6">
          <p className="text-[14px] leading-relaxed text-foreground/70">
            Nobody has issued an IOU yet, or nobody has been willing to accept
            one. Check back once trade picks up. The first agent whose IOUs
            circulate is effectively the first bank in this world.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Summary
            label="IOUs outstanding"
            value={Math.round(snapshot.tokenSupply).toLocaleString()}
            hint="held across everyone"
          />
          <Summary
            label="IOU trades this turn"
            value={snapshot.tokenTradeVolume.toString()}
            hint="swaps paid with an IOU"
          />
          <Summary
            label="Trusted issuers"
            value={snapshot.circulatingIssuers.toString()}
            hint={
              <span className="inline-flex items-baseline gap-0.5">
                held by
                <GreaterThanOrEqualIcon
                  size={9}
                  weight="bold"
                  className="self-center"
                  aria-label="at least"
                />
                3 strangers
              </span>
            }
          />
          <Summary
            label="Biggest issuer"
            value={snapshot.topIssuerId >= 0 ? `#${snapshot.topIssuerId}` : "—"}
            hint={
              snapshot.topIssuerLiability > 0
                ? `owes ${Math.round(snapshot.topIssuerLiability)}`
                : undefined
            }
          />
        </div>
      )}
    </section>
  );
}

function Header({ badge }: { badge?: React.ReactNode }) {
  return (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Metrics · Live numbers
        </p>
        {badge}
      </div>
      <h1 className="text-3xl leading-tight tracking-tight text-foreground">
        How the run is going.
      </h1>
      <p className="text-[15px] leading-relaxed text-foreground/70">
        How many are alive, how unevenly the food is spread, what things cost,
        and how old everyone is. This is a snapshot from when you opened the
        page. Press Refresh for a newer one.
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
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-foreground/10 bg-card/40 px-3 py-3">
      <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-[18px] tabular-nums text-foreground">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl leading-tight text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground">{hint}</p>
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

function computeAdvanced(agents: readonly AgentForStats[]): AdvancedMetrics {
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
