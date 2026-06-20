"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Scatter,
  ScatterChart,
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
import { MOTIVATION_INFO, type AgentMotivation } from "@/lib/config";
import { useSimulationStore } from "@/lib/store";
import type { RenderAgent } from "@/lib/world";

const MOTIVATION_COLOR: Record<string, string> = {
  material: "#E63946",
  symbolic: "#2E5C9E",
  normative: "#FFD23F",
  power: "#111111",
};

const motivationConfig: ChartConfig = {
  count: { label: "Agents" },
};

const ageConfig: ChartConfig = {
  count: { label: "Agents", color: "#9aa0a6" },
};

export function AgentsPage() {
  const started = useSimulationStore((s) => s.started);
  const turn = useSimulationStore((s) => s.turn);

  const data = useMemo(() => {
    void turn;
    if (!started) return null;
    const world = activeWorldRef.current;
    if (!world) return null;
    return computeData(world.agents);
  }, [turn, started]);

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <Header />

        {!data || data.alive.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-8 space-y-10">
            <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card title="Motivation mix" meta={`${data.alive.length} alive`}>
                <ChartContainer
                  config={motivationConfig}
                  className="aspect-auto h-56 w-full"
                >
                  <PieChart>
                    <Tooltip
                      content={
                        <ChartTooltipContent indicator="dot" hideLabel />
                      }
                    />
                    <Pie
                      data={data.motivationMix}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={1.5}
                      strokeWidth={0}
                      isAnimationActive={false}
                    >
                      {data.motivationMix.map((entry) => (
                        <Cell key={entry.label} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <Legend mix={data.motivationMix} />
              </Card>

              <Card title="Age distribution" meta="ten-turn bins">
                <ChartContainer
                  config={ageConfig}
                  className="aspect-auto h-56 w-full"
                >
                  <BarChart data={data.ageBins}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      fontSize={9}
                      tickMargin={4}
                    />
                    <YAxis hide />
                    <ChartTooltip
                      cursor={{ fill: "rgba(120,120,120,0.06)" }}
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          labelFormatter={(value) => `Age ${value}`}
                        />
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
              </Card>
            </section>

            <section>
              <SectionTitle
                title="Wealth × Age"
                hint="Each dot is one agent. Vertical streaks mean a cohort got rich together; horizontal spread means a generation diverged."
              />
              <Card>
                <ChartContainer
                  config={motivationConfig}
                  className="aspect-auto h-72 w-full"
                >
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      dataKey="age"
                      name="Age"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      tickMargin={4}
                    />
                    <YAxis
                      type="number"
                      dataKey="wealth"
                      name="Wealth"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      tickMargin={4}
                      width={30}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={<ScatterTooltip />}
                    />
                    {(
                      Object.keys(MOTIVATION_INFO) as AgentMotivation[]
                    ).map((m) => {
                      const points = data.scatter.filter((p) => p.m === m);
                      if (points.length === 0) return null;
                      return (
                        <Scatter
                          key={m}
                          name={MOTIVATION_INFO[m].label}
                          data={points}
                          fill={MOTIVATION_COLOR[m]}
                          fillOpacity={0.75}
                          stroke={
                            m === "power"
                              ? "rgba(245,245,245,0.6)"
                              : "rgba(20,20,20,0.4)"
                          }
                          strokeWidth={0.5}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </ScatterChart>
                </ChartContainer>
              </Card>
            </section>

            <section>
              <SectionTitle
                title="Population ranked"
                hint={`Top ${Math.min(50, data.ranked.length)} agents by wealth.`}
              />
              <RankTable rows={data.ranked.slice(0, 50)} />
            </section>
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
        Agents · Population atlas
      </p>
      <h1 className="font-serif text-3xl leading-tight tracking-tight text-foreground">
        Who is alive, and how are they doing?
      </h1>
      <p className="font-serif text-[15px] leading-relaxed text-foreground/70">
        A live read of the population: the mix of drives, the spread of ages,
        wealth against age, and a ranked list of the hoarders and the strugglers.
      </p>
    </header>
  );
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: { age: number; wealth: number; m: string } }[];
}) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-foreground/10 bg-card px-2.5 py-1.5 font-mono text-[11px] text-foreground shadow-md">
      <div>
        {MOTIVATION_INFO[p.m as AgentMotivation]?.label ?? p.m}
      </div>
      <div className="mt-0.5 text-muted-foreground">
        age {p.age} · wealth {p.wealth.toFixed(1)}
      </div>
    </div>
  );
}

function Legend({
  mix,
}: {
  mix: { label: string; count: number; color: string }[];
}) {
  const total = mix.reduce((s, m) => s + m.count, 0);
  return (
    <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {mix.map((m) => {
        const pct = total > 0 ? (m.count / total) * 100 : 0;
        return (
          <li key={m.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: m.color }}
            />
            <span className="font-sans text-[12px] text-foreground/85">
              {m.label}
            </span>
            <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
              {pct.toFixed(0)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RankTable({ rows }: { rows: RankedRow[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-foreground/10">
      <table className="w-full text-sm">
        <thead className="bg-foreground/[0.02]">
          <tr className="border-b border-foreground/10 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <th className="px-3 py-2 text-left font-normal">#</th>
            <th className="px-3 py-2 text-left font-normal">Motivation</th>
            <th className="px-3 py-2 text-right font-normal">Wealth</th>
            <th className="px-3 py-2 text-right font-normal">Age</th>
            <th className="px-3 py-2 text-right font-normal">Vision</th>
            <th className="px-3 py-2 text-right font-normal">At</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-foreground/5 last:border-b-0 transition-colors hover:bg-foreground/[0.02]"
            >
              <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                #{r.id}
              </td>
              <td className="px-3 py-1.5">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: MOTIVATION_COLOR[r.m] ?? "#888" }}
                  />
                  <span className="font-sans text-[12px] text-foreground/85">
                    {MOTIVATION_INFO[r.m as AgentMotivation]?.label ?? r.m}
                  </span>
                </span>
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums text-foreground">
                {r.wealth.toFixed(1)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                {r.age}/{r.maxAge}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                {r.vision}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground/70">
                {r.x},{r.y}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({
  title,
  meta,
  children,
}: {
  title?: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-foreground/10 bg-card/40 px-4 py-4">
      {(title || meta) && (
        <div className="mb-2 flex items-baseline justify-between">
          {title && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {title}
            </span>
          )}
          {meta && (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {meta}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3 space-y-1">
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
        No population yet.
      </p>
      <p className="mt-2 font-sans text-[13px] text-muted-foreground">
        Press Run, then come back to browse who&rsquo;s alive.
      </p>
    </div>
  );
}

interface RankedRow {
  id: number;
  m: string;
  wealth: number;
  age: number;
  maxAge: number;
  vision: number;
  x: number;
  y: number;
}

interface AgentsData {
  alive: RenderAgent[];
  motivationMix: { label: string; count: number; color: string }[];
  ageBins: { label: string; count: number }[];
  scatter: { age: number; wealth: number; m: string }[];
  ranked: RankedRow[];
}

function computeData(agents: readonly RenderAgent[]): AgentsData {
  const alive: RenderAgent[] = [];
  const mix: Record<AgentMotivation, number> = {
    material: 0,
    symbolic: 0,
    normative: 0,
    power: 0,
  };
  for (const a of agents) {
    if (!a.alive) continue;
    alive.push(a);
    mix[a.motivation]++;
  }

  const motivationMix = (Object.keys(MOTIVATION_INFO) as AgentMotivation[])
    .filter((k) => mix[k] > 0)
    .map((k) => ({
      label: MOTIVATION_INFO[k].label,
      count: mix[k],
      color: MOTIVATION_COLOR[k],
    }));

  // Age histogram in 10-turn buckets.
  const ageBuckets = new Map<number, number>();
  let maxBucket = 0;
  for (const a of alive) {
    const b = Math.floor(a.age / 10);
    ageBuckets.set(b, (ageBuckets.get(b) ?? 0) + 1);
    if (b > maxBucket) maxBucket = b;
  }
  const ageBins = Array.from({ length: maxBucket + 1 }, (_, i) => ({
    label: `${i * 10}`,
    count: ageBuckets.get(i) ?? 0,
  }));

  const scatter = alive.map((a) => ({
    age: a.age,
    wealth: a.sugar + a.spice,
    m: a.motivation,
  }));

  const ranked: RankedRow[] = alive
    .slice()
    .sort((a, b) => b.sugar + b.spice - (a.sugar + a.spice))
    .map((a) => ({
      id: a.id,
      m: a.motivation,
      wealth: a.sugar + a.spice,
      age: a.age,
      maxAge: a.maxAge,
      vision: a.vision,
      x: a.x,
      y: a.y,
    }));

  return { alive, motivationMix, ageBins, scatter, ranked };
}
