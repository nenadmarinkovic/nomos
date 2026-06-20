"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMemo } from "react";
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
import { XIcon } from "@phosphor-icons/react";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { NetworkWindowBody } from "@/components/network-window";
import { cn } from "@/lib/utils";
import { activeEngineRef } from "@/lib/active-engine";
import { OBSERVER_INFO } from "@/lib/config";
import { WEALTH_BIN_LABELS } from "@/lib/engine";
import { useSimulationStore, type ViewKey } from "@/lib/store";

const giniConfig: ChartConfig = {
  gini: { label: "Gini", color: "#E63946" },
};
const aliveConfig: ChartConfig = {
  alive: { label: "Alive", color: "#2E5C9E" },
};
const histogramConfig: ChartConfig = {
  count: { label: "Agents", color: "#FFD23F" },
};

export function FloatingWindows() {
  const started = useSimulationStore((s) => s.started);
  const moveWindow = useSimulationStore((s) => s.moveWindow);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  if (!started) return null;

  function handleDragEnd(e: DragEndEvent) {
    const key = e.active.id as ViewKey;
    const current = useSimulationStore.getState().windowPositions[key];
    moveWindow(key, {
      x: Math.max(0, current.x + e.delta.x),
      y: Math.max(0, current.y + e.delta.y),
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <GiniWindow />
        <AliveWindow />
        <WealthWindow />
        <NarratorWindow />
        <NetworkWindow />
      </div>
    </DndContext>
  );
}

function FloatingWindow({
  windowKey,
  title,
  meta,
  children,
}: {
  windowKey: ViewKey;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  const visible = useSimulationStore((s) => s.views[windowKey]);
  const position = useSimulationStore((s) => s.windowPositions[windowKey]);
  const toggleView = useSimulationStore((s) => s.toggleView);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: windowKey });

  if (!visible) return null;

  const x = position.x + (transform?.x ?? 0);
  const y = position.y + (transform?.y ?? 0);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
      className={cn(
        "pointer-events-auto absolute left-0 top-0 w-72 rounded-md border border-foreground/15 bg-card/95 font-sans text-foreground shadow-xl backdrop-blur-md",
        isDragging && "cursor-grabbing shadow-2xl",
      )}
    >
      <div
        {...listeners}
        {...attributes}
        className={cn(
          "flex items-center justify-between gap-2 border-b border-foreground/10 px-3 py-2",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </span>
          {meta && (
            <span className="font-mono text-[12px] tabular-nums text-foreground">
              {meta}
            </span>
          )}
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => toggleView(windowKey)}
          aria-label={`Close ${title}`}
          className="cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <XIcon size={12} weight="bold" />
        </button>
      </div>
      <div className="px-3 py-3">{children}</div>
    </div>
  );
}

function GiniWindow() {
  const history = useSimulationStore((s) => s.history);
  const snapshot = useSimulationStore((s) => s.snapshot);

  return (
    <FloatingWindow
      windowKey="gini"
      title="Gini"
      meta={snapshot.gini.toFixed(3)}
    >
      <ChartContainer
        config={giniConfig}
        className="aspect-auto h-24 w-full"
      >
        <AreaChart
          data={history}
          margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
        >
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
      <p className="mt-2 font-sans text-[11px] text-muted-foreground">
        Wealth concentration
      </p>
    </FloatingWindow>
  );
}

function AliveWindow() {
  const history = useSimulationStore((s) => s.history);
  const snapshot = useSimulationStore((s) => s.snapshot);

  return (
    <FloatingWindow
      windowKey="alive"
      title="Alive"
      meta={snapshot.alive.toLocaleString()}
    >
      <ChartContainer
        config={aliveConfig}
        className="aspect-auto h-24 w-full"
      >
        <LineChart
          data={history}
          margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
        >
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
      <p className="mt-2 font-sans text-[11px] text-muted-foreground">
        Population over time
      </p>
    </FloatingWindow>
  );
}

function WealthWindow() {
  const snapshot = useSimulationStore((s) => s.snapshot);
  const histogramData = useMemo(
    () =>
      snapshot.wealthBins.map((count, i) => ({
        tier: WEALTH_BIN_LABELS[i] ?? "",
        count,
      })),
    [snapshot.wealthBins],
  );

  return (
    <FloatingWindow
      windowKey="wealth"
      title="Wealth"
      meta={`${snapshot.alive.toLocaleString()} alive`}
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
      <p className="mt-2 font-sans text-[11px] text-muted-foreground">
        Distribution by tier
      </p>
    </FloatingWindow>
  );
}

function NetworkWindow() {
  return (
    <FloatingWindow
      windowKey="network"
      title="Network"
      meta="Society as graph"
    >
      <NetworkWindowBody engineRef={activeEngineRef} />
      <p className="mt-2 font-sans text-[11px] text-muted-foreground">
        Agents within vision, force-laid
      </p>
    </FloatingWindow>
  );
}

function NarratorWindow() {
  const chronicle = useSimulationStore((s) => s.chronicle);
  const recent = chronicle
    .filter((e) => e.status === "done" && e.text)
    .slice(-3)
    .reverse();
  const pending = chronicle.some((e) => e.status === "pending");

  return (
    <FloatingWindow
      windowKey="narrator"
      title="Narrator"
      meta={pending ? "···" : undefined}
    >
      {recent.length === 0 ? (
        <p className="font-serif text-[12px] italic leading-snug text-muted-foreground">
          {pending
            ? "Observers are watching…"
            : "Run the simulation. Observers will narrate as the society unfolds."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {recent.map((e) => (
            <div key={e.key} className="flex flex-col gap-1">
              <p className="font-serif text-[12px] italic leading-snug text-foreground/90">
                &ldquo;{e.text}&rdquo;
              </p>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  — {OBSERVER_INFO[e.observer].name}
                </span>
                <span className="font-mono text-[9px] tabular-nums text-muted-foreground/60">
                  T{e.turn}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </FloatingWindow>
  );
}
