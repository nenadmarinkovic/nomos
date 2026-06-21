"use client";

import { useCallback } from "react";

import { PageWelcome } from "@/components/page-welcome";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SnapshotBadge } from "@/components/snapshot-badge";
import { MOTIVATION_INFO, type AgentMotivation } from "@/lib/config";
import { useSimulationStore } from "@/lib/store";
import { useWorldSnapshot } from "@/lib/use-world-snapshot";
import type { RenderAgent, WorldView } from "@/lib/world";

const MOTIVATION_COLOR: Record<string, string> = {
  material: "#E63946",
  symbolic: "#2E5C9E",
  normative: "#FFD23F",
  power: "#111111",
};

export function AgentsPage() {
  const started = useSimulationStore((s) => s.started);
  const snapshot = useWorldSnapshot(
    useCallback((world: WorldView) => computeData(world.agents), []),
  );
  const data = snapshot.data;

  if (!started) {
    return (
      <PageWelcome
        eyebrow="Agents · The actors"
        headline={
          <>
            Watch <em className="text-brand">surprising societies</em> grow from
            simple agents.
          </>
        }
        lead={
          <>
            Every agent in Nomos is built from the same skeleton — a body that
            harvests, eats, and ages. What makes them differ is what they
            <em> want</em> and how they <em>think</em>. Hundreds of them run
            side by side; whatever comes out is what those bodies, minds, and
            drives produced together.
          </>
        }
        steps={[
          {
            n: "01",
            title: "The body",
            body: "Each agent has a position on a sugar / spice landscape, holdings of both goods, a metabolism that burns through them every tick, and a fixed lifespan. Move, harvest, exchange, pay metabolism, age, die — or leave an heir.",
          },
          {
            n: "02",
            title: "The mind",
            body: "Sophistication decides how an agent picks where to move. <em>Minimal</em> agents optimise greedily over their whole field of view. <em>Bounded</em> ones satisfice over a short horizon (Herbert Simon, 1956). <em>Adaptive</em> ones learn how far to range. <em>Social</em> ones imitate the wealthiest neighbour they can see.",
          },
          {
            n: "03",
            title: "The drive",
            body: "Motivation is what they're after. <em>Material</em> chase resources (Marx). <em>Symbolic</em> chase status (Bourdieu). <em>Normative</em> chase belonging (Durkheim). <em>Power</em> chase domination over others. Set the mix on the setup screen and the engine takes that as the seed.",
          },
          {
            n: "04",
            title: "What you'll see here",
            body: "Once a run is alive, this page becomes a population atlas — the motivation mix, the ranked hoarders and strugglers, ages and territories. None of it is scripted; it's whoever the conditions produced.",
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
              turn={snapshot.turn}
              stale={snapshot.stale}
              onRefresh={snapshot.refresh}
            />
          }
        />

        {!data || data.aliveCount === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-8 space-y-10">
            <section>
              <SectionTitle
                title="Motivation mix"
                hint={`${data.aliveCount.toLocaleString()} alive · share of each drive in the population.`}
              />
              <Legend mix={data.motivationMix} />
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

function Header({ badge }: { badge?: React.ReactNode }) {
  return (
    <header className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Agents · Population atlas
        </p>
        {badge}
      </div>
      <h1 className="font-serif text-3xl leading-tight tracking-tight text-foreground">
        Who is alive, and how are they doing?
      </h1>
      <p className="font-serif text-[15px] leading-relaxed text-foreground/70">
        A snapshot of the population: the mix of drives, the spread of ages,
        wealth against age, and a ranked list of the hoarders and the
        strugglers. The simulation keeps running in the corner — hit Refresh
        to grab a fresh sample.
      </p>
    </header>
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
        No sample yet.
      </p>
      <p className="mt-2 font-sans text-[13px] text-muted-foreground">
        Press Refresh once a few ticks have passed, or let the run warm up.
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
  aliveCount: number;
  motivationMix: { label: string; count: number; color: string }[];
  ranked: RankedRow[];
}

const TOP_N = 50;

/**
 * Single O(N) pass: count alive, count per motivation, and keep a small
 * top-N heap of richest agents. Cheap even at 3000 agents.
 */
function computeData(agents: readonly RenderAgent[]): AgentsData {
  let aliveCount = 0;
  const mix: Record<AgentMotivation, number> = {
    material: 0,
    symbolic: 0,
    normative: 0,
    power: 0,
  };

  // Top-N tracker: a sorted array of <= TOP_N rows. Cheaper than sorting all.
  const top: RankedRow[] = [];

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (!a.alive) continue;
    aliveCount++;
    mix[a.motivation]++;

    const wealth = a.sugar + a.spice;
    if (top.length < TOP_N) {
      insertSortedDesc(top, {
        id: a.id,
        m: a.motivation,
        wealth,
        age: a.age,
        maxAge: a.maxAge,
        vision: a.vision,
        x: a.x,
        y: a.y,
      });
    } else if (wealth > top[top.length - 1].wealth) {
      top.pop();
      insertSortedDesc(top, {
        id: a.id,
        m: a.motivation,
        wealth,
        age: a.age,
        maxAge: a.maxAge,
        vision: a.vision,
        x: a.x,
        y: a.y,
      });
    }
  }

  const motivationMix = (Object.keys(MOTIVATION_INFO) as AgentMotivation[])
    .filter((k) => mix[k] > 0)
    .map((k) => ({
      label: MOTIVATION_INFO[k].label,
      count: mix[k],
      color: MOTIVATION_COLOR[k],
    }));

  return { aliveCount, motivationMix, ranked: top };
}

function insertSortedDesc(arr: RankedRow[], row: RankedRow) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].wealth < row.wealth) hi = mid;
    else lo = mid + 1;
  }
  arr.splice(lo, 0, row);
}
