"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useSimulationStore } from "@/lib/store";
import { WEALTH_BIN_LABELS } from "@/lib/engine";

const giniConfig: ChartConfig = {
  gini: {
    label: "Gini",
    color: "#E63946",
  },
};

const aliveConfig: ChartConfig = {
  alive: {
    label: "Alive",
    color: "#2E5C9E",
  },
};

const histogramConfig: ChartConfig = {
  count: {
    label: "Agents",
    color: "#FFD23F",
  },
};

export function ChartsPanel() {
  const started = useSimulationStore((s) => s.started);
  const history = useSimulationStore((s) => s.history);
  const snapshot = useSimulationStore((s) => s.snapshot);

  if (!started) return null;

  const histogramData = snapshot.wealthBins.map((count, i) => ({
    tier: WEALTH_BIN_LABELS[i] ?? "",
    count,
  }));

  return (
    <aside className="hidden shrink-0 border-t border-foreground/10 bg-card/40 md:block">
      <div className="grid grid-cols-3 divide-x divide-foreground/10">
        <ChartBlock
          label="Gini"
          value={snapshot.gini.toFixed(3)}
          hint="Wealth concentration"
        >
          <ChartContainer
            config={giniConfig}
            className="aspect-auto h-24 w-full"
          >
            <AreaChart data={history} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="turn" hide />
              <YAxis domain={[0, 1]} hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(_v, payload) => {
                      const p = payload?.[0]?.payload as { turn?: number } | undefined;
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
        </ChartBlock>

        <ChartBlock
          label="Alive"
          value={snapshot.alive.toLocaleString()}
          hint="Population over time"
        >
          <ChartContainer
            config={aliveConfig}
            className="aspect-auto h-24 w-full"
          >
            <LineChart data={history} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="turn" hide />
              <YAxis hide />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(_v, payload) => {
                      const p = payload?.[0]?.payload as { turn?: number } | undefined;
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
        </ChartBlock>

        <ChartBlock
          label="Wealth"
          value={`${snapshot.alive.toLocaleString()} alive`}
          hint="Distribution by tier"
        >
          <ChartContainer
            config={histogramConfig}
            className="aspect-auto h-24 w-full"
          >
            <BarChart
              data={histogramData}
              margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="tier"
                tickLine={false}
                axisLine={false}
                fontSize={9}
                tickMargin={4}
              />
              <YAxis hide />
              <ChartTooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={<ChartTooltipContent indicator="dot" hideLabel />}
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        </ChartBlock>
      </div>
    </aside>
  );
}

function ChartBlock({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-[13px] tabular-nums text-foreground">
          {value}
        </span>
      </div>
      {children}
      <span className="font-sans text-[11px] text-muted-foreground">{hint}</span>
    </div>
  );
}
