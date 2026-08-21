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
  material: "#0076E7",
  symbolic: "#E93013",
  normative: "#F29320",
  power: "#249375",
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
        eyebrow="Agents · Who lives here"
        headline={<>Everyone in the world, and how they are doing.</>}
        lead={
          <>
            Every agent works the same way. It stands somewhere on the map,
            holds some food, burns a bit of it each turn, and eventually dies of
            old age. What makes them different is how far they can see, how they
            decide where to go, and what they are chasing. This page shows you
            who is currently alive.
          </>
        }
        steps={[
          {
            n: "01",
            title: "The body",
            body: "There are two goods on the map, sugar and spice. Each agent holds some of both, spends a little every turn just to stay alive, and dies when it runs out or gets too old. If inheritance is on, its wealth goes to a child.",
          },
          {
            n: "02",
            title: "How it decides where to go",
            body: "Some agents scan everything they can see and go for the best patch. Some stop at the first patch that is good enough. Some learn over time how far it is worth walking. Some just follow the richest neighbour they can see.",
          },
          {
            n: "03",
            title: "What it is chasing",
            body: "Some agents mainly want food and wealth. Some want status. Some want to fit in with the people around them. Some want to be in charge. You set the starting mix, and it shifts on its own as agents copy each other.",
          },
          {
            n: "04",
            title: "What you get on this page",
            body: "Once a run is going, you get the split between those four drives, the richest and the poorest agents ranked, and how old everyone is. It is a snapshot, so use Refresh to pull a fresh one.",
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
                title="What they want"
                hint={`${data.aliveCount.toLocaleString()} agents alive. Here is what they are each after.`}
              />
              <Legend mix={data.motivationMix} />
            </section>

            <section>
              <SectionTitle
                title="Richest agents"
                hint={`The top ${Math.min(50, data.ranked.length)} by how much food they are holding.`}
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
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Agents · Population
        </p>
        {badge}
      </div>
      <h1 className="text-3xl leading-tight tracking-tight text-foreground">
        Who is alive right now?
      </h1>
      <p className="text-[15px] leading-relaxed text-foreground/70">
        The split between the four drives, and every agent ranked by wealth.
        This is a snapshot taken when you opened the page. The run keeps going
        in the background, so press Refresh for a newer one.
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
            <span className="text-xs text-foreground/85">{m.label}</span>
            <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
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
        <thead className="bg-foreground/2">
          <tr className="border-b border-foreground/10 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
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
              className="border-b border-foreground/5 last:border-b-0 transition-colors hover:bg-foreground/2"
            >
              <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">
                #{r.id}
              </td>
              <td className="px-3 py-1.5">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: MOTIVATION_COLOR[r.m] ?? "#888" }}
                  />
                  <span className="text-xs text-foreground/85">
                    {MOTIVATION_INFO[r.m as AgentMotivation]?.label ?? r.m}
                  </span>
                </span>
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-foreground">
                {r.wealth.toFixed(1)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {r.age}/{r.maxAge}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {r.vision}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground/70">
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
      <h2 className="text-xl leading-tight text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 rounded-lg border border-dashed border-foreground/10 px-6 py-10 text-center">
      <p className="text-lg text-foreground/80">Nothing to show yet.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Give the run a few turns, then press Refresh.
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

function computeData(agents: readonly RenderAgent[]): AgentsData {
  let aliveCount = 0;
  const mix: Record<AgentMotivation, number> = {
    material: 0,
    symbolic: 0,
    normative: 0,
    power: 0,
  };

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
