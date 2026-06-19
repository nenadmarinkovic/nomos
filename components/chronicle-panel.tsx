"use client";

import { useMemo } from "react";
import { EyeIcon } from "@phosphor-icons/react";

import { OBSERVER_INFO } from "@/lib/config";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSimulationStore, type ChronicleEntry } from "@/lib/store";

interface EventGroup {
  eventId: string;
  turn: number;
  title: string;
  entries: ChronicleEntry[];
}

export function ChroniclePanel() {
  const started = useSimulationStore((s) => s.started);
  const chronicle = useSimulationStore((s) => s.chronicle);
  const observerCount = useSimulationStore((s) => s.config.observers.length);

  const groups = useMemo(() => groupByEvent(chronicle), [chronicle]);

  return (
    <aside className="hidden w-[340px] shrink-0 flex-col border-l border-foreground/10 bg-card/40 lg:flex xl:w-[380px]">
      <header className="flex shrink-0 items-center justify-between border-b border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <EyeIcon size={16} weight="regular" className="text-foreground/50" />
          <h2 className="font-sans text-[13px] font-medium text-foreground">
            Chronicle
          </h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {observerCount} {observerCount === 1 ? "observer" : "observers"}
        </span>
      </header>

      <ScrollArea className="flex-1">
        <div className="space-y-6 px-4 py-4">
          {!started ? (
            <EmptyState
              title="No run yet"
              hint="Begin a simulation and the observers will narrate the moments that matter."
            />
          ) : groups.length === 0 ? (
            <EmptyState
              title="The observers are watching"
              hint="Nothing significant has happened yet. Readings appear when the society shifts — a surge in inequality, a crash, a collapse."
            />
          ) : (
            groups.map((group) => (
              <EventBlock key={group.eventId} group={group} />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function EventBlock({ group }: { group: EventGroup }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-serif text-[15px] italic leading-tight text-foreground">
          {group.title}
        </h3>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Turn {group.turn}
        </span>
      </div>
      <div className="space-y-2.5">
        {group.entries.map((entry) => (
          <NarrationCard key={entry.key} entry={entry} />
        ))}
      </div>
    </section>
  );
}

function NarrationCard({ entry }: { entry: ChronicleEntry }) {
  const info = OBSERVER_INFO[entry.observer];
  return (
    <div className="rounded-lg border border-foreground/10 bg-card px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-sans text-[13px] font-medium text-foreground">
          {info?.name ?? entry.observer}
        </span>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
          {info?.lens ?? ""}
        </span>
      </div>

      <div className="mt-1.5">
        {entry.status === "pending" && <PendingLines />}
        {entry.status === "done" && entry.text && (
          <p className="font-serif text-[13.5px] leading-relaxed text-foreground/85">
            {entry.text}
          </p>
        )}
        {entry.status === "error" && (
          <p className="font-sans text-[12px] leading-snug text-muted-foreground">
            {entry.error ?? "The observer could not be reached."}
          </p>
        )}
      </div>
    </div>
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
    <div className="rounded-lg border border-dashed border-foreground/10 px-4 py-6 text-center">
      <p className="font-serif text-[15px] italic text-foreground/80">
        {title}
      </p>
      <p className="mt-1.5 font-sans text-[12px] leading-snug text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

function groupByEvent(chronicle: ChronicleEntry[]): EventGroup[] {
  const map = new Map<string, EventGroup>();
  for (const entry of chronicle) {
    let group = map.get(entry.eventId);
    if (!group) {
      group = {
        eventId: entry.eventId,
        turn: entry.turn,
        title: entry.eventTitle,
        entries: [],
      };
      map.set(entry.eventId, group);
    }
    group.entries.push(entry);
  }
  // Newest events first.
  return Array.from(map.values()).sort((a, b) => b.turn - a.turn);
}
