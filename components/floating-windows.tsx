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
import { cn } from "@/lib/utils";
import { OBSERVER_INFO } from "@/lib/config";
import { WEALTH_BIN_LABELS } from "@/lib/engine";
import {
  resolveWindowPosition,
  useSimulationStore,
  WIN_HEIGHTS,
  WIN_WIDTH,
  type ViewKey,
  type WindowAnchor,
} from "@/lib/store";

const giniConfig: ChartConfig = {
  gini: { label: "Gini", color: "#E63946" },
};
const aliveConfig: ChartConfig = {
  alive: { label: "Alive", color: "#2E5C9E" },
};
const histogramConfig: ChartConfig = {
  count: { label: "Agents", color: "#FFD23F" },
};
const priceConfig: ChartConfig = {
  tradePrice: { label: "Price", color: "#D69E5A" },
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
    const state = useSimulationStore.getState();
    const current = state.windowPositions[key];
    const canvas = state.canvasSize;
    const W = canvas.width || 800;
    const H = canvas.height || 600;
    const winH = WIN_HEIGHTS[key];

    // Where the window actually ended up, in absolute container coords.
    const start = resolveWindowPosition(current, key, canvas);
    const nextX = start.x + e.delta.x;
    const nextY = start.y + e.delta.y;

    // Anchor follows the corner closest to the window's center, so a drag
    // toward the top-right ends with a top-right anchor — and that anchor
    // is what keeps it pinned through later container reflows.
    const centerX = nextX + WIN_WIDTH / 2;
    const centerY = nextY + winH / 2;
    const anchor: WindowAnchor =
      centerX < W / 2
        ? centerY < H / 2
          ? "tl"
          : "bl"
        : centerY < H / 2
          ? "tr"
          : "br";

    const offsetX =
      anchor === "tl" || anchor === "bl"
        ? Math.max(0, nextX)
        : Math.max(0, W - WIN_WIDTH - nextX);
    const offsetY =
      anchor === "tl" || anchor === "tr"
        ? Math.max(0, nextY)
        : Math.max(0, H - winH - nextY);

    moveWindow(key, { anchor, offsetX, offsetY });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <GiniWindow />
        <AliveWindow />
        <WealthWindow />
        <PriceWindow />
        <StreamWindow />
        <NarratorWindow />
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
  const canvasSize = useSimulationStore((s) => s.canvasSize);
  const toggleView = useSimulationStore((s) => s.toggleView);

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: windowKey });

  if (!visible) return null;

  // Resolve on every render: container size changes (sidebar collapse,
  // viewport resize) re-derive x/y from the same anchor + offset.
  const resolved = resolveWindowPosition(position, windowKey, canvasSize);
  const x = resolved.x + (transform?.x ?? 0);
  const y = resolved.y + (transform?.y ?? 0);

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

function PriceWindow() {
  const history = useSimulationStore((s) => s.history);
  const snapshot = useSimulationStore((s) => s.snapshot);

  // Gaps (turns with no trade) become nulls so the line connects across them
  // instead of plunging to zero.
  const data = useMemo(
    () =>
      history.map((p) => ({
        turn: p.turn,
        tradePrice: p.tradePrice > 0 ? p.tradePrice : null,
      })),
    [history],
  );

  const meta =
    snapshot.tradePrice > 0
      ? `${snapshot.tradePrice.toFixed(2)} · ${snapshot.tradeVolume}↔`
      : "no trade";

  return (
    <FloatingWindow windowKey="price" title="Price" meta={meta}>
      <ChartContainer config={priceConfig} className="aspect-auto h-24 w-full">
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="turn" hide />
          <YAxis hide domain={["auto", "auto"]} />
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
            dataKey="tradePrice"
            stroke="var(--color-tradePrice)"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <p className="mt-2 font-sans text-[11px] text-muted-foreground">
        Sugar per spice, found by trade
      </p>
    </FloatingWindow>
  );
}

const MOTIVATION_ORDER = ["material", "symbolic", "normative", "power"] as const;
const MOTIVATION_COLORS: Record<(typeof MOTIVATION_ORDER)[number], string> = {
  material: "#E63946",
  symbolic: "#2E5C9E",
  normative: "#FFD23F",
  power: "#2A9D5C",
};
const MOTIVATION_LABELS: Record<(typeof MOTIVATION_ORDER)[number], string> = {
  material: "Material",
  symbolic: "Symbolic",
  normative: "Normative",
  power: "Power",
};

function StreamWindow() {
  const history = useSimulationStore((s) => s.history);
  const snapshot = useSimulationStore((s) => s.snapshot);

  const { paths, total } = useMemo(() => {
    if (history.length < 2) return { paths: null, total: 0 };

    const W = 264;
    const H = 96;
    const n = history.length;
    const stepX = W / Math.max(1, n - 1);

    const totals: number[] = new Array(n);
    let maxTotal = 0;
    for (let i = 0; i < n; i++) {
      const m = history[i].motivationCounts;
      const t = m.material + m.symbolic + m.normative + m.power;
      totals[i] = t;
      if (t > maxTotal) maxTotal = t;
    }
    if (maxTotal === 0) return { paths: null, total: 0 };

    const cumLow: number[] = new Array(n).fill(0);
    const layers = MOTIVATION_ORDER.map((key) => {
      const top: { x: number; y: number }[] = new Array(n);
      const bottom: { x: number; y: number }[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const count = history[i].motivationCounts[key];
        const denom = totals[i] || 1;
        const lo = cumLow[i];
        const hi = lo + count / denom;
        const x = i * stepX;
        bottom[i] = { x, y: H - lo * H };
        top[i] = { x, y: H - hi * H };
        cumLow[i] = hi;
      }
      const upper = top.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
      const lower = bottom
        .slice()
        .reverse()
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" L");
      return { key, d: `M${upper} L${lower} Z`, color: MOTIVATION_COLORS[key] };
    });

    return { paths: layers, total: totals[n - 1] };
  }, [history]);

  const live = snapshot.motivationCounts;
  const liveTotal =
    live.material + live.symbolic + live.normative + live.power || 1;

  return (
    <FloatingWindow
      windowKey="stream"
      title="Motivations"
      meta={total > 0 ? total.toLocaleString() : undefined}
    >
      <div className="h-24 w-full overflow-hidden rounded-sm bg-foreground/[0.03]">
        {paths ? (
          <svg
            viewBox="0 0 264 96"
            preserveAspectRatio="none"
            className="block h-full w-full"
          >
            {paths.map((layer) => (
              <path
                key={layer.key}
                d={layer.d}
                fill={layer.color}
                fillOpacity={0.82}
                stroke="none"
              />
            ))}
          </svg>
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            gathering…
          </div>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {MOTIVATION_ORDER.map((key) => {
          const count = live[key];
          const pct = ((count / liveTotal) * 100).toFixed(0);
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="block size-2 rounded-[1px]"
                style={{ background: MOTIVATION_COLORS[key] }}
              />
              <span className="font-sans text-[11px] text-foreground/85">
                {MOTIVATION_LABELS[key]}
              </span>
              <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </FloatingWindow>
  );
}

function NarratorWindow() {
  const chronicle = useSimulationStore((s) => s.chronicle);
  const done = chronicle.filter((e) => e.status === "done" && e.text);
  const latest = done[done.length - 1];
  const pending = chronicle.some((e) => e.status === "pending");

  return (
    <FloatingWindow
      windowKey="narrator"
      title="Narrator"
      meta={pending ? "···" : undefined}
    >
      {/* Match the chart-window body height (h-24 chart + caption ≈ 121px)
       * so the narrator doesn't shrink or grow with text length — the next
       * window below it would otherwise drift away from a uniform 10px gap. */}
      <div className="min-h-[121px]">
        {!latest ? (
          <p className="font-sans text-[13px] leading-relaxed text-muted-foreground">
            {pending
              ? "Observers are watching…"
              : "Run the simulation. Observers will narrate as the society unfolds."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="font-sans text-[14px] leading-relaxed text-foreground">
              {latest.text}
            </p>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-sans text-[12px] font-medium text-foreground/85">
                {OBSERVER_INFO[latest.observer].name}
              </span>
              <span className="font-sans text-[11px] tabular-nums text-muted-foreground">
                Turn {latest.turn}
              </span>
            </div>
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
