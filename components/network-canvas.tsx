"use client";

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { XIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { activeWorldRef } from "@/lib/active-world";
import { useSimulationStore } from "@/lib/store";
import type { RenderAgent } from "@/lib/world";

interface NetworkNode extends SimulationNodeDatum {
  id: number;
  motivation: string;
  wealth: number;
}

interface NetworkLink extends SimulationLinkDatum<NetworkNode> {
  source: number | NetworkNode;
  target: number | NetworkNode;
  weight: number;
}

const MOTIVATION_COLOR: Record<string, string> = {
  material: "#E63946",
  symbolic: "#2E5C9E",
  normative: "#FFD23F",
  power: "#111111",
};

const MOTIVATION_LABEL: Record<string, string> = {
  material: "Material",
  symbolic: "Symbolic",
  normative: "Normative",
  power: "Power",
};

const REBUILD_EVERY_N_TURNS = 20;

/**
 * Full-canvas force-directed graph view of the simulation. Edges are
 * persistent *trade-partner* ties (accumulated weight per successful trade,
 * multiplicatively decayed each tick). Nodes are the agents currently
 * embedded in those ties — i.e. the agents that have actually traded with
 * someone recently.
 *
 * Layout philosophy: the simulation is one long-lived d3-force run. Each
 * rebuild *re-uses* surviving nodes' positions so the graph evolves smoothly
 * instead of exploding from the centre on every cadence. Mouse hover lives
 * in a ref so it doesn't trigger React re-renders mid-tick.
 */
export function NetworkCanvas() {
  const turn = useSimulationStore((s) => s.turn);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastBuiltTurn = useRef<number>(-9999);

  const simRef = useRef<Simulation<NetworkNode, NetworkLink> | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  /** Persistent position cache keyed by agent id; survives rebuilds. */
  const positionsRef = useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );

  const [stats, setStats] = useState({ nodes: 0, edges: 0, alive: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Track container size for responsive force-center.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Recenter force when size changes (without rebuilding nodes).
  useEffect(() => {
    if (simRef.current && size.w > 0 && size.h > 0) {
      simRef.current.force(
        "center",
        forceCenter(size.w / 2, size.h / 2),
      );
      simRef.current.alpha(0.2).restart();
    }
  }, [size.w, size.h]);

  // Wire d3-zoom once. The pan/zoom transform is applied to the viewport <g>
  // so the underlying simulation coordinates stay untouched.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const sel = select(svg);
    let viewport = sel.select<SVGGElement>("g.viewport");
    if (viewport.empty()) {
      viewport = sel.append("g").attr("class", "viewport");
    }

    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 6])
      .filter((event: Event) => {
        // Allow wheel zoom + drag-pan on background, but never start a pan
        // when the gesture starts on a node (so clicks register cleanly).
        if (event.type === "wheel") return true;
        const t = event.target as Element | null;
        return !t?.closest("g.node");
      })
      .on("zoom", (event) => {
        viewport.attr("transform", event.transform.toString());
        setZoomLevel(event.transform.k);
      });

    zoomRef.current = z;
    sel.call(z).on("dblclick.zoom", null);

    // Click on empty canvas clears the selection.
    sel.on("click.deselect", (event: MouseEvent) => {
      const t = event.target as Element | null;
      if (!t?.closest("g.node")) setSelectedId(null);
    });

    return () => {
      sel.on(".zoom", null).on("click.deselect", null);
      zoomRef.current = null;
    };
  }, []);

  // Build/refresh the graph. We keep one Simulation across rebuilds and only
  // refresh its data — surviving node positions persist.
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    const shouldRebuild =
      lastBuiltTurn.current < 0 ||
      turn - lastBuiltTurn.current >= REBUILD_EVERY_N_TURNS;
    if (!shouldRebuild) return;
    lastBuiltTurn.current = turn;

    const svg = svgRef.current;
    const world = activeWorldRef.current;
    if (!svg || !world) return;

    const aliveAgents = world.agents.filter((a) => a.alive);
    const { nodes: sampled, links } = buildTieGraph(aliveAgents, world.ties);

    // Reuse the prior position for surviving nodes; spawn newcomers near the
    // centre with a small jitter so they don't pile.
    const cx = size.w / 2;
    const cy = size.h / 2;
    const nextPositions = new Map<number, { x: number; y: number }>();
    const nodes: NetworkNode[] = sampled.map((a) => {
      const prev = positionsRef.current.get(a.id);
      const x = prev?.x ?? cx + (Math.random() - 0.5) * 60;
      const y = prev?.y ?? cy + (Math.random() - 0.5) * 60;
      nextPositions.set(a.id, { x, y });
      return {
        id: a.id,
        motivation: a.motivation,
        wealth: a.sugar + a.spice,
        x,
        y,
      };
    });
    positionsRef.current = nextPositions;

    setStats({
      nodes: nodes.length,
      edges: links.length,
      alive: aliveAgents.length,
    });

    const sel = select(svg);
    let viewport = sel.select<SVGGElement>("g.viewport");
    if (viewport.empty()) {
      viewport = sel.append("g").attr("class", "viewport");
    }

    if (nodes.length === 0) {
      viewport.selectAll("*").remove();
      simRef.current?.stop();
      simRef.current = null;
      return;
    }

    // Lazily create the structural groups once, inside the viewport.
    let linkLayer = viewport.select<SVGGElement>("g.links");
    if (linkLayer.empty()) {
      linkLayer = viewport
        .append("g")
        .attr("class", "links")
        .attr("stroke", "currentColor");
    }
    let nodeLayer = viewport.select<SVGGElement>("g.nodes");
    if (nodeLayer.empty()) {
      nodeLayer = viewport.append("g").attr("class", "nodes");
    }

    const maxWeight = links.reduce((m, l) => (l.weight > m ? l.weight : m), 1);

    // Data-join the links — d3 handles enter/update/exit.
    const linkSel = linkLayer
      .selectAll<SVGLineElement, NetworkLink>("line")
      .data(links, (d) => {
        const s = typeof d.source === "object" ? d.source.id : d.source;
        const t = typeof d.target === "object" ? d.target.id : d.target;
        return `${s}:${t}`;
      })
      .join(
        (enter) => enter.append("line"),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr("stroke-opacity", (d) => 0.18 + 0.62 * (d.weight / maxWeight))
      .attr("stroke-width", (d) => 0.5 + 1.6 * (d.weight / maxWeight));

    // Data-join nodes by id so existing DOM is preserved and surviving
    // nodes don't flash.
    const nodeSel = nodeLayer
      .selectAll<SVGGElement, NetworkNode>("g.node")
      .data(nodes, (d) => d.id)
      .join(
        (enter) => {
          const g = enter
            .append("g")
            .attr("class", "node")
            .style("cursor", "pointer");
          g.append("path");
          return g;
        },
        (update) => update,
        (exit) => {
          exit.remove();
          return exit;
        },
      );

    nodeSel
      .select<SVGPathElement>("path")
      .attr("d", (d) => shapePath(d.motivation));
    nodeSel.attr("fill", (d) => MOTIVATION_COLOR[d.motivation] ?? "#E63946");

    // Hover lives in a ref so it doesn't trigger React re-renders.
    nodeSel
      .on("mouseenter", function (event: MouseEvent, d) {
        renderTooltip(tooltipRef.current, containerRef.current, event, d);
      })
      .on("mousemove", function (event: MouseEvent, d) {
        renderTooltip(tooltipRef.current, containerRef.current, event, d);
      })
      .on("mouseleave", function () {
        hideTooltip(tooltipRef.current);
      })
      .on("click", function (event: MouseEvent, d) {
        event.stopPropagation();
        setSelectedId(d.id);
        hideTooltip(tooltipRef.current);
      });

    const coord = (end: number | NetworkNode | undefined, axis: "x" | "y") => {
      if (!end || typeof end === "number") return 0;
      return end[axis] ?? 0;
    };
    const tick = () => {
      linkSel
        .attr("x1", (d) => coord(d.source, "x"))
        .attr("y1", (d) => coord(d.source, "y"))
        .attr("x2", (d) => coord(d.target, "x"))
        .attr("y2", (d) => coord(d.target, "y"));
      nodeSel.attr("transform", (d) => {
        if (!d) return "translate(0,0)";
        // Cache positions back so the next rebuild picks them up.
        const pos = positionsRef.current.get(d.id);
        if (pos) {
          pos.x = d.x ?? pos.x;
          pos.y = d.y ?? pos.y;
        }
        return `translate(${d.x ?? 0}, ${d.y ?? 0})`;
      });
    };

    if (simRef.current) {
      // Reuse the running simulation: swap in new nodes/links, then nudge
      // softly. Surviving nodes already have positions so they barely move.
      const sim = simRef.current;
      sim.nodes(nodes);
      (sim.force("link") as ReturnType<typeof forceLink> | undefined)?.links(
        links,
      );
      sim.force("center", forceCenter(size.w / 2, size.h / 2));
      sim.on("tick", tick);
      sim.alpha(0.35).alphaTarget(0).restart();
    } else {
      const sim = forceSimulation<NetworkNode>(nodes)
        .force(
          "link",
          forceLink<NetworkNode, NetworkLink>(links)
            .id((d) => d.id)
            .distance((d) => 60 - 30 * (d.weight / maxWeight))
            .strength((d) => 0.25 + 0.4 * (d.weight / maxWeight)),
        )
        .force("charge", forceManyBody().strength(-45))
        .force("center", forceCenter(size.w / 2, size.h / 2))
        .force("collision", forceCollide(11))
        .alphaDecay(0.05)
        .velocityDecay(0.55);
      sim.on("tick", tick);
      sim.alpha(0.9).restart();
      simRef.current = sim;
    }

    // Auto-cool after a while so the sim quiets when nothing's changing.
    const cool = setTimeout(() => {
      simRef.current?.alphaTarget(0);
    }, 2500);

    return () => clearTimeout(cool);
  }, [turn, size.w, size.h]);

  // Stop the long-lived simulation when the component unmounts.
  useEffect(() => {
    return () => {
      simRef.current?.stop();
      simRef.current = null;
      positionsRef.current.clear();
    };
  }, []);

  // Repaint the selected-node highlight without rebuilding the graph.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    select(svg)
      .selectAll<SVGGElement, NetworkNode>("g.node")
      .attr("stroke", (d) => {
        if (!d) return "rgba(20,20,20,0.75)";
        if (d.id === selectedId) return "var(--foreground)";
        return d.motivation === "power"
          ? "rgba(245,245,245,0.9)"
          : "rgba(20,20,20,0.75)";
      })
      .attr("stroke-width", (d) => (d && d.id === selectedId ? 2.5 : 1));
  }, [selectedId, turn]);

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    z.scaleBy(select(svg), factor);
  };

  const resetView = () => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (!svg || !z) return;
    z.transform(select(svg), zoomIdentity);
  };

  return (
    <div ref={containerRef} className="relative flex h-full flex-1">
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full cursor-grab text-foreground active:cursor-grabbing"
        preserveAspectRatio="xMidYMid meet"
      />

      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-1 rounded-md border border-foreground/10 bg-card/90 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span>
            <span className="text-foreground">{stats.nodes}</span> nodes
          </span>
          <span>
            <span className="text-foreground">{stats.edges}</span> ties
          </span>
          <span>
            <span className="text-foreground tabular-nums">
              {zoomLevel.toFixed(1)}×
            </span>{" "}
            zoom
          </span>
        </div>
        <span className="text-muted-foreground/70">
          all alive agents
        </span>
      </div>

      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-md border border-foreground/15 bg-card/90 font-mono text-[12px] text-foreground shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => zoomBy(1.4)}
          className="cursor-pointer border-b border-foreground/10 px-2 py-1 transition-colors hover:bg-foreground/[0.06]"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={resetView}
          className="cursor-pointer border-b border-foreground/10 px-2 py-1 text-[9px] uppercase tracking-[0.16em] transition-colors hover:bg-foreground/[0.06]"
          aria-label="Reset zoom"
        >
          1×
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.4)}
          className="cursor-pointer px-2 py-1 transition-colors hover:bg-foreground/[0.06]"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {selectedId === null && (
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-md rounded-md border border-foreground/10 bg-card/90 px-3 py-2 font-serif text-[12px] italic leading-snug text-foreground/80 backdrop-blur-sm">
          Each shape is one agent — all of them. Lines are trade-partner ties
          that accumulate with each successful exchange and fade when partners
          stop meeting. Isolates drift to the edge; trading circles cluster.
          Scroll to zoom, drag to pan, click an agent to inspect.
        </div>
      )}

      {selectedId !== null && (
        <AgentInspector
          agentId={selectedId}
          turn={turn}
          onClose={() => setSelectedId(null)}
        />
      )}

      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-foreground/15 bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground shadow-md"
      />
    </div>
  );
}

interface PartnerInfo {
  id: number;
  weight: number;
  motivation: string;
}

function AgentInspector({
  agentId,
  turn,
  onClose,
}: {
  agentId: number;
  turn: number;
  onClose: () => void;
}) {
  // `turn` in deps keeps the inspector live as the agent's state changes.
  const { agent, partners, embeddedness } = useMemo(() => {
    const world = activeWorldRef.current;
    if (!world)
      return {
        agent: null as RenderAgent | null,
        partners: [] as PartnerInfo[],
        embeddedness: 0,
      };
    const a = world.agents[agentId];
    const collected: PartnerInfo[] = [];
    let total = 0;
    const t = world.ties;
    for (let i = 0; i < t.length; i += 3) {
      const idA = t[i] | 0;
      const idB = t[i + 1] | 0;
      const w = t[i + 2];
      if (idA !== agentId && idB !== agentId) continue;
      const otherId = idA === agentId ? idB : idA;
      const other = world.agents[otherId];
      if (!other) continue;
      collected.push({ id: otherId, weight: w, motivation: other.motivation });
      total += w;
    }
    collected.sort((p, q) => q.weight - p.weight);
    return { agent: a ?? null, partners: collected.slice(0, 6), embeddedness: total };
    // We want this to recompute every turn even if agentId is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, turn]);

  if (!agent || !agent.alive) {
    return (
      <div className="absolute bottom-4 right-4 w-72 rounded-md border border-foreground/15 bg-card/95 p-3 font-sans text-[12px] text-foreground shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Agent #{agentId}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-sm p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <XIcon size={12} weight="bold" />
          </button>
        </div>
        <p className="mt-2 font-serif italic text-muted-foreground">
          Gone — this agent has died.
        </p>
      </div>
    );
  }

  const wealth = agent.sugar + agent.spice;

  return (
    <div className="absolute bottom-4 right-4 w-80 rounded-md border border-foreground/15 bg-card/95 font-sans text-[12px] text-foreground shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="block size-3 rounded-[2px]"
            style={{ background: MOTIVATION_COLOR[agent.motivation] ?? "#E63946" }}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Agent #{agent.id}
          </span>
          <span className="font-mono text-[11px] text-foreground">
            {MOTIVATION_LABEL[agent.motivation] ?? agent.motivation}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer rounded-sm p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <XIcon size={12} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3 py-3">
        <Stat label="Wealth" value={wealth.toFixed(1)} />
        <Stat
          label="Sugar / Spice"
          value={`${agent.sugar.toFixed(1)} / ${agent.spice.toFixed(1)}`}
        />
        <Stat label="Age" value={`${agent.age} / ${agent.maxAge}`} />
        <Stat label="Vision" value={agent.vision.toString()} />
        <Stat
          label="Metab"
          value={`${agent.sugarMetab.toFixed(1)} / ${agent.spiceMetab.toFixed(1)}`}
        />
        <Stat label="Embedded" value={embeddedness.toFixed(1)} />
      </div>

      <div className="border-t border-foreground/10 px-3 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Top trade partners
        </span>
        {partners.length === 0 ? (
          <p className="mt-1.5 font-serif text-[12px] italic text-muted-foreground">
            No partners yet — this agent hasn&apos;t traded.
          </p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1">
            {partners.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 font-mono text-[11px]"
              >
                <span
                  aria-hidden
                  className="block size-2 rounded-[1px]"
                  style={{ background: MOTIVATION_COLOR[p.motivation] ?? "#E63946" }}
                />
                <span className="text-foreground">#{p.id}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {p.weight.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-[12px] tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

/* ----------------------------- helpers ----------------------------- */

function renderTooltip(
  el: HTMLDivElement | null,
  container: HTMLDivElement | null,
  event: MouseEvent,
  d: NetworkNode,
): void {
  if (!el || !container) return;
  const rect = container.getBoundingClientRect();
  el.style.display = "block";
  el.style.left = `${event.clientX - rect.left}px`;
  el.style.top = `${event.clientY - rect.top - 12}px`;
  const label = MOTIVATION_LABEL[d.motivation] ?? d.motivation;
  el.innerHTML = `<span class="text-muted-foreground">#${d.id}</span><span class="mx-1.5 text-muted-foreground/50">·</span><span>${label}</span><span class="mx-1.5 text-muted-foreground/50">·</span><span class="tabular-nums">w ${d.wealth.toFixed(1)}</span>`;
}

function hideTooltip(el: HTMLDivElement | null): void {
  if (!el) return;
  el.style.display = "none";
}

function shapePath(motivation: string): string {
  const r = 6;
  switch (motivation) {
    case "symbolic":
      return `M ${-r},0 a ${r},${r} 0 1,0 ${2 * r},0 a ${r},${r} 0 1,0 ${-2 * r},0 Z`;
    case "normative":
      return `M 0,${-r} L ${r},${r} L ${-r},${r} Z`;
    case "power":
      return `M 0,${-r} L ${r},0 L 0,${r} L ${-r},0 Z`;
    default:
      return `M ${-r},${-r} h ${2 * r} v ${2 * r} h ${-2 * r} Z`;
  }
}

/**
 * Build a graph from the engine's trade-tie array. Every alive agent is a
 * node (isolates included — solitude is visible by absence of connections).
 * Edges are ties between any two alive agents.
 */
function buildTieGraph(
  alive: readonly RenderAgent[],
  ties: Float32Array,
): { nodes: RenderAgent[]; links: NetworkLink[] } {
  const aliveById = new Map<number, RenderAgent>();
  for (const a of alive) aliveById.set(a.id, a);

  const links: NetworkLink[] = [];
  for (let i = 0; i < ties.length; i += 3) {
    const a = ties[i] | 0;
    const b = ties[i + 1] | 0;
    if (!aliveById.has(a) || !aliveById.has(b)) continue;
    links.push({ source: a, target: b, weight: ties[i + 2] });
  }
  return { nodes: [...alive], links };
}
