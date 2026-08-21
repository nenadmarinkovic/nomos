"use client";

import { useMemo, useState } from "react";

import { PageWelcome } from "@/components/page-welcome";
import { RunConditions } from "@/components/run-conditions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OBSERVER_INFO, type ObserverKey } from "@/lib/config";
import { useSimulationStore, type ChronicleEntry } from "@/lib/store";
import { cn } from "@/lib/utils";

interface EventGroup {
  eventId: string;
  turn: number;
  title: string;
  kind: string;
  entries: ChronicleEntry[];
}

export function NarratorPage() {
  const started = useSimulationStore((s) => s.started);
  const chronicle = useSimulationStore((s) => s.chronicle);
  const observers = useSimulationStore((s) => s.config.observers);

  const [filter, setFilter] = useState<ObserverKey | null>(null);

  const groups = useMemo(
    () => groupByEvent(chronicle, filter),
    [chronicle, filter],
  );

  const counts = useMemo(() => {
    const c = new Map<ObserverKey, number>();
    for (const e of chronicle) {
      if (e.status !== "done") continue;
      c.set(e.observer, (c.get(e.observer) ?? 0) + 1);
    }
    return c;
  }, [chronicle]);

  if (!started) {
    return (
      <PageWelcome
        eyebrow="Narrator · The observers"
        headline={<>Ten people watching the same run, seeing ten things.</>}
        lead={
          <>
            When something notable happens in the run, it gets handed to one of
            the observers, who writes a short paragraph about it. They all see
            exactly the same events. They rarely say the same thing about them,
            and that is the point.
          </>
        }
        steps={[
          {
            n: "01",
            title: "Marx, Bourdieu, Polanyi",
            body: "Marx watches who owns things and who keeps ending up on top. Bourdieu watches status, and whether taste follows money around. Polanyi watches the moment trading between neighbours turns into a market with a life of its own.",
          },
          {
            n: "02",
            title: "Granovetter, Flack",
            body: "Granovetter reads the map of who trades with whom, and looks for the people connecting groups that would otherwise never meet. Flack looks for the quiet things holding the society together, and what breaks when they go.",
          },
          {
            n: "03",
            title: "Schelling, Turchin",
            body: "Schelling watches for tipping points, where a small preference nobody thinks much about ends up sorting the whole map. Turchin takes the long view, across generations, and looks for the build-up before a crisis.",
          },
          {
            n: "04",
            title: "Farmer, Epstein, Axelrod",
            body: "Farmer reads the prices and the money. Epstein built the original model this one is based on and asks whether the thing you claim to explain actually grew here. Axelrod watches who cooperates, who cheats, and what happens to them next.",
          },
        ]}
      />
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-8">
          <Header />

          <div className="mt-6">
            <RunConditions />
          </div>

          {groups.length === 0 ? (
            <EmptyState
              title={
                filter
                  ? "This observer hasn't written anything yet"
                  : "Nothing to report yet"
              }
              hint={
                filter
                  ? "Pick someone else on the right, or wait for the next thing to happen."
                  : "Writing shows up when something changes: inequality jumps, food runs out, trade picks up."
              }
            />
          ) : (
            <div className="mt-10 space-y-14">
              {groups.map((g) => (
                <EventSection key={g.eventId} group={g} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <aside className="hidden w-64 shrink-0 flex-col border-l border-foreground/10 bg-card/40 lg:flex">
        <div className="border-b border-foreground/10 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Observers
          </p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Click a name to see only their writing.
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-px p-2">
            <FilterRow
              label="Everyone"
              count={chronicle.filter((e) => e.status === "done").length}
              active={filter === null}
              onClick={() => setFilter(null)}
            />
            {observers.map((key) => {
              const info = OBSERVER_INFO[key];
              if (!info) return null;
              return (
                <FilterRow
                  key={key}
                  label={info.name}
                  hint={info.lens}
                  count={counts.get(key) ?? 0}
                  active={filter === key}
                  onClick={() => setFilter(filter === key ? null : key)}
                />
              );
            })}
          </div>
        </ScrollArea>
      </aside>
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-2">
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Narrator · Observers
      </p>
      <h1 className="text-3xl leading-tight tracking-tight text-foreground">
        What the observers made of it.
      </h1>
      <p className="text-[15px] leading-relaxed text-foreground/70">
        Whenever something notable happens, an observer writes about it here.
        Newest first.
      </p>
    </header>
  );
}

function FilterRow({
  label,
  hint,
  count,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors",
        active
          ? "bg-foreground/6 text-foreground"
          : "text-foreground/70 hover:bg-foreground/3 hover:text-foreground",
      )}
    >
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {hint && (
        <span className="text-xs leading-snug text-muted-foreground">
          {hint}
        </span>
      )}
    </button>
  );
}

function EventSection({ group }: { group: EventGroup }) {
  return (
    <section className="space-y-6">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl leading-tight tracking-tight text-foreground">
          {group.title}
        </h2>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          Turn {group.turn}
        </span>
      </header>
      <div className="space-y-7">
        {group.entries.map((entry, i) => (
          <NarrationCard key={`${entry.key}:${i}`} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function NarrationCard({ entry }: { entry: ChronicleEntry }) {
  const info = OBSERVER_INFO[entry.observer];
  return (
    <article className="space-y-2">
      {entry.status === "pending" && <PendingLines />}
      {entry.status === "done" && entry.text && (
        <p className="text-[16px] leading-relaxed text-foreground">
          {entry.text}
        </p>
      )}
      {entry.status === "error" && (
        <p className="text-sm leading-snug text-muted-foreground">
          {entry.error ?? "Couldn\u2019t reach this observer."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        — {info?.name ?? entry.observer}
      </p>
    </article>
  );
}

function PendingLines() {
  return (
    <div className="space-y-1.5" aria-label="Loading narration">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "h-2.5 animate-pulse rounded bg-foreground/8",
            i === 0 ? "w-full" : i === 1 ? "w-[92%]" : "w-2/3",
          )}
        />
      ))}
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-12 space-y-2 text-center">
      <p className="text-xl text-foreground/85">{title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

function groupByEvent(
  chronicle: ChronicleEntry[],
  filter: ObserverKey | null,
): EventGroup[] {
  const map = new Map<string, EventGroup>();
  // De-duplicate entries by their composite key. The chronicle store can hold
  // multiple entries with the same `key` if a narration is re-opened (e.g.
  // after a replay), and React keys must be unique.
  const seen = new Set<string>();
  for (const entry of chronicle) {
    if (filter && entry.observer !== filter) continue;
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    let group = map.get(entry.eventId);
    if (!group) {
      group = {
        eventId: entry.eventId,
        turn: entry.turn,
        title: entry.eventTitle,
        kind: entry.eventKind,
        entries: [],
      };
      map.set(entry.eventId, group);
    }
    group.entries.push(entry);
  }
  return Array.from(map.values()).sort((a, b) => b.turn - a.turn);
}
