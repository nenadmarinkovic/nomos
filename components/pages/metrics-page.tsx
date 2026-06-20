"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { activeWorldRef } from "@/lib/active-world";
import { SCALE_INFO } from "@/lib/config";
import { WEALTH_BIN_LABELS } from "@/lib/engine";
import { useSimulationStore } from "@/lib/store";

const giniConfig: ChartConfig = {
  gini: { label: "Gini", color: "#E63946" },
};
const aliveConfig: ChartConfig = {
  alive: { label: "Alive", color: "#2E5C9E" },
};
const priceConfig: ChartConfig = {
  tradePrice: { label: "Price", color: "#D69E5A" },
};
const wealthConfig: ChartConfig = {
  count: { label: "Agents", color: "#FFD23F" },
};

export function MetricsPage() {
  const started = useSimulationStore((s) => s.started);
  const turn = useSimulationStore((s) => s.turn);
  const snapshot = useSimulationStore((s) => s.snapshot);
  const history = useSimulationStore((s) => s.history);
  const config = useSimulationStore((s) => s.config);

  const advanced = useMemo(() => {
    void turn;
    if (!started) return null;
    const world = activeWorldRef.current;
    if (!world) return null;
    return computeAdvanced(world.agents);
  }, [turn, started]);

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <Header />

        {!started ? (
          <EmptyState />
        ) : (
          <div className="mt-8 space-y-10">
            {/* Summary cards */}
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
                  snapshot.tradePrice > 0
                    ? snapshot.tradePrice.toFixed(3)
                    : "—"
                }
                hint="sugar per spice"
              />
            </section>

            {/* Time series grid */}
            <section className="space-y-3">
              <SectionTitle
                title="Time series"
                hint="Every tick recorded since this run began."
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <BigChart
                  title="Gini coefficient"
                  meta={snapshot.gini.toFixed(3)}
                  hint="0 = perfect equality · 1 = total concentration"
                >
                  <ChartContainer
                    config={giniConfig}
                    className="aspect-auto h-48 w-full"
                  >
                    <AreaChart data={history}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="turn"
                        tickLine={false}
                        axisLine={false}
                        fontSize={9}
                        tickMargin={4}
                      />
                      <YAxis
                        domain={[0, 1]}
                        tickLine={false}
                        axisLine={false}
                        fontSize={9}
                        width={24}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            labelFormatter={(_v, payload) => {
                              const p = payload?.[0]?.payload as
                                | { turn?: number }
                                | undefined;
                              return `Turn ${p?.turn ?? 0}`;
                            }}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="gini"
                        stroke="var(--color-gini)"
                        fill="var(--color-gini)"
                        fillOpacity={0.18}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ChartContainer>
                </BigChart>

                <BigChart
                  title="Population"
                  meta={snapshot.alive.toLocaleString()}
                  hint="alive agents over time"
                >
                  <ChartContainer
                    config={aliveConfig}
                    className="aspect-auto h-48 w-full"
                  >
                    <LineChart data={history}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="turn"
                        tickLine={false}
                        axisLine={false}
                        fontSize={9}
                        tickMargin={4}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={9}
                        width={32}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            labelFormatter={(_v, payload) => {
                              const p = payload?.[0]?.payload as
                                | { turn?: number }
                                | undefined;
                              return `Turn ${p?.turn ?? 0}`;
                            }}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="alive"
                        stroke="var(--color-alive)"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </BigChart>

                <BigChart
                  title="Trade price"
                  meta={
                    snapshot.tradePrice > 0
                      ? snapshot.tradePrice.toFixed(3)
                      : "—"
                  }
                  hint="geometric mean of trades each turn"
                >
                  <ChartContainer
                    config={priceConfig}
                    className="aspect-auto h-48 w-full"
                  >
                    <LineChart data={history}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="turn"
                        tickLine={false}
                        axisLine={false}
                        fontSize={9}
                        tickMargin={4}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={9}
                        width={32}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            labelFormatter={(_v, payload) => {
                              const p = payload?.[0]?.payload as
                                | { turn?: number }
                                | undefined;
                              return `Turn ${p?.turn ?? 0}`;
                            }}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="tradePrice"
                        stroke="var(--color-tradePrice)"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ChartContainer>
                </BigChart>

                <BigChart
                  title="Wealth tiers"
                  meta={`${snapshot.alive.toLocaleString()} alive`}
                  hint="current distribution by wealth band"
                >
                  <ChartContainer
                    config={wealthConfig}
                    className="aspect-auto h-48 w-full"
                  >
                    <BarChart
                      data={snapshot.wealthBins.map((count, i) => ({
                        tier: WEALTH_BIN_LABELS[i] ?? "",
                        count,
                      }))}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="tier"
                        tickLine={false}
                        axisLine={false}
                        fontSize={9}
                        tickMargin={4}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={9}
                        width={32}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(120,120,120,0.06)" }}
                        content={
                          <ChartTooltipContent indicator="dot" hideLabel />
                        }
                      />
                      <Bar
                        dataKey="count"
                        fill="var(--color-count)"
                        radius={[2, 2, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ChartContainer>
                </BigChart>
              </div>
            </section>

            {/* Derived numbers */}
            {advanced && (
              <section className="space-y-3">
                <SectionTitle
                  title="Derived"
                  hint="Numbers the windows compress away — the shape underneath."
                />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Summary
                    label="Mean age"
                    value={`${advanced.meanAge.toFixed(1)}t`}
                  />
                  <Summary
                    label="Oldest agent"
                    value={`${advanced.maxAge}t`}
                  />
                  <Summary
                    label="Youth share"
                    value={`${(advanced.youthShare * 100).toFixed(0)}%`}
                    hint="first quarter of lifespan"
                  />
                  <Summary
                    label="Spice-rich"
                    value={`${(advanced.spiceRichShare * 100).toFixed(0)}%`}
                    hint="holds more spice than sugar"
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
        )}
      </div>
    </ScrollArea>
  );
}

function Header() {
  return (
    <header className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Metrics · Signals
      </p>
      <h1 className="font-serif text-3xl leading-tight tracking-tight text-foreground">
        What the numbers say.
      </h1>
      <p className="font-serif text-[15px] leading-relaxed text-foreground/70">
        Time series of the headline measures, plus the shape underneath: who
        holds what, how old they are, how the market is moving.
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

function BigChart({
  title,
  meta,
  hint,
  children,
}: {
  title: string;
  meta?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-foreground/10 bg-card/40 px-4 py-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </span>
        {meta && (
          <span className="font-mono text-[12px] tabular-nums text-foreground">
            {meta}
          </span>
        )}
      </div>
      {children}
      {hint && (
        <div className="mt-2 font-sans text-[11px] text-muted-foreground">
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

function EmptyState() {
  return (
    <div className="mt-10 rounded-lg border border-dashed border-foreground/10 px-6 py-10 text-center">
      <p className="font-serif text-lg italic text-foreground/80">
        No run yet.
      </p>
      <p className="mt-2 font-sans text-[13px] text-muted-foreground">
        Press Run to start producing data.
      </p>
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
