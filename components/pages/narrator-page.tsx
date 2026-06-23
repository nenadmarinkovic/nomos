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
        eyebrow="Narrator · The voices"
        headline={
          <>
            Watch <em className="text-brand">different vocabularies</em> read
            the same emergence.
          </>
        }
        lead={
          <>
            Nomos grows societies from the bottom up. The Narrator hands the
            same run to a panel of theorists and lets each read it through
            their own lens. The events are identical; the readings won&rsquo;t
            be. That asymmetry is the whole intellectual move.
          </>
        }
        steps={[
          {
            n: "01",
            title: "Marx, Bourdieu & Polanyi",
            body: "<em>Capital, distinction, the great transformation.</em> Who owns what and who reproduces their advantage (Marx); whose taste tracks whose holdings (Bourdieu); when the trade loop disembeds from kinship and locality into a self-regulating market (Polanyi).",
          },
          {
            n: "02",
            title: "Durkheim & Granovetter",
            body: "<em>Solidarity and embeddedness.</em> Durkheim reads ritual and anomie — when shared norms bind the group, when they fray. Granovetter reads the trade-tie graph directly: who brokers between clusters, which weak ties carry the information that strong ones can&rsquo;t.",
          },
          {
            n: "03",
            title: "Schelling & Turchin",
            body: "<em>Cascades and secular cycles.</em> The persistent structures behind the daily motion — small preference shifts compounding into tipping points; multi-generation elite overproduction tipping into crisis.",
          },
          {
            n: "04",
            title: "Farmer, Epstein & Flack",
            body: "<em>The methodological mirrors.</em> Doyne Farmer reads the emergent price as complexity economics. Joshua Epstein reads it as a Sugarscape modeller — &lsquo;if you didn&rsquo;t grow it, you didn&rsquo;t explain it.&rsquo; Jessica Flack reads it as a complexity ethologist: hierarchy as a computation, slow variables as a society&rsquo;s memory.",
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
              title={filter ? "No readings from this observer yet" : "The observers are watching"}
              hint={
                filter
                  ? "Try another voice from the right panel, or wait for the next significant moment."
                  : "Readings appear when the society shifts — a surge in inequality, a famine, a market in motion."
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
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Voices
          </p>
          <p className="mt-1 font-sans text-[11px] leading-snug text-muted-foreground">
            Click a theorist to filter to their readings.
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-px p-2">
            <FilterRow
              label="All voices"
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
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Narrator · Voices
      </p>
      <h1 className="font-serif text-3xl leading-tight tracking-tight text-foreground">
        How the theorists read what just happened.
      </h1>
      <p className="font-serif text-[15px] leading-relaxed text-foreground/70">
        Each observer narrates significant moments through their own
        vocabulary. Same event, different vocabularies — that&rsquo;s the
        intellectual move.
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
          ? "bg-foreground/[0.06] text-foreground"
          : "text-foreground/70 hover:bg-foreground/[0.03] hover:text-foreground",
      )}
    >
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="font-sans text-[13px] font-medium">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {hint && (
        <span className="font-serif text-[11px] italic leading-snug text-muted-foreground">
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
        <h2 className="font-serif text-2xl leading-tight tracking-tight text-foreground">
          {group.title}
        </h2>
        <span className="shrink-0 font-sans text-[12px] tabular-nums text-muted-foreground">
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
        <p className="font-serif text-[16px] leading-relaxed text-foreground">
          {entry.text}
        </p>
      )}
      {entry.status === "error" && (
        <p className="font-sans text-[13px] leading-snug text-muted-foreground">
          {entry.error ?? "The observer could not be reached."}
        </p>
      )}
      <p className="font-sans text-[12px] text-muted-foreground">
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
            "h-2.5 animate-pulse rounded bg-foreground/[0.08]",
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
      <p className="font-serif text-xl text-foreground/85">{title}</p>
      <p className="font-sans text-[13px] leading-relaxed text-muted-foreground">
        {hint}
      </p>
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
