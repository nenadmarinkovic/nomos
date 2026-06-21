"use client";

import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";

import type { RenderAgent, WorldView } from "@/lib/world";
import { useSimulationStore } from "@/lib/store";

interface NetworkNode extends d3.SimulationNodeDatum {
  id: number;
  motivation: string;
  wealth: number;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: number | NetworkNode;
  target: number | NetworkNode;
}

const MOTIVATION_COLOR: Record<string, string> = {
  material: "#E63946",
  symbolic: "#2E5C9E",
  normative: "#FFD23F",
  power: "#2A9D5C",
};

const MOTIVATION_LABEL: Record<string, string> = {
  material: "Material",
  symbolic: "Symbolic",
  normative: "Normative",
  power: "Power",
};

const MAX_NODES = 100;
const REBUILD_EVERY_N_TURNS = 6;
const NEIGHBOR_RADIUS = 4;

interface NetworkWindowBodyProps {
  worldRef: React.RefObject<WorldView | null>;
}

interface HoverInfo {
  motivation: string;
  wealth: number;
  id: number;
  cx: number;
  cy: number;
}

export function NetworkWindowBody({ worldRef }: NetworkWindowBodyProps) {
  const turn = useSimulationStore((s) => s.turn);
  const svgRef = useRef<SVGSVGElement>(null);
  const lastBuiltTurn = useRef<number>(-9999);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [hover, setHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    const shouldRebuild =
      lastBuiltTurn.current < 0 ||
      turn - lastBuiltTurn.current >= REBUILD_EVERY_N_TURNS;
    if (!shouldRebuild) return;
    lastBuiltTurn.current = turn;

    const svg = svgRef.current;
    const world = worldRef.current;
    if (!svg || !world) return;

    const W = svg.clientWidth || 280;
    const H = svg.clientHeight || 220;

    const aliveAgents = world.agents.filter((a) => a.alive);
    const sampled = sampleAgents(aliveAgents, MAX_NODES);

    const nodes: NetworkNode[] = sampled.map((a) => ({
      id: a.id,
      motivation: a.motivation,
      wealth: a.sugar + a.spice,
    }));

    const links: NetworkLink[] = buildLinks(sampled, world);

    setStats({ nodes: nodes.length, edges: links.length });

    if (nodes.length === 0) {
      d3.select(svg).selectAll("*").remove();
      return;
    }

    const sim = d3
      .forceSimulation<NetworkNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<NetworkNode, NetworkLink>(links)
          .id((d) => d.id)
          .distance(28)
          .strength(0.6),
      )
      .force("charge", d3.forceManyBody().strength(-40))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(9));

    const sel = d3.select(svg);
    sel.selectAll("*").remove();

    const linkSel = sel
      .append("g")
      .attr("stroke", "currentColor")
      .attr("stroke-opacity", 0.35)
      .attr("stroke-width", 0.8)
      .selectAll<SVGLineElement, NetworkLink>("line")
      .data(links)
      .join("line");

    const nodeSel = sel
      .append("g")
      .selectAll<SVGGElement, NetworkNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer");

    nodeSel.append("path").attr("d", (d) => shapePath(d.motivation));
    nodeSel
      .attr("fill", (d) => MOTIVATION_COLOR[d.motivation] ?? "#E63946")
      .attr("stroke", "rgba(20,20,20,0.75)")
      .attr("stroke-width", 0.9);

    nodeSel
      .on("mouseenter", function (_event, d) {
        setHover({
          motivation: d.motivation,
          wealth: d.wealth,
          id: d.id,
          cx: d.x ?? 0,
          cy: d.y ?? 0,
        });
      })
      .on("mousemove", function (_event, d) {
        setHover((h) =>
          h && h.id === d.id ? { ...h, cx: d.x ?? 0, cy: d.y ?? 0 } : h,
        );
      })
      .on("mouseleave", function () {
        setHover(null);
      });

    sim.on("tick", () => {
      linkSel
        .attr("x1", (d) => (d.source as NetworkNode).x ?? 0)
        .attr("y1", (d) => (d.source as NetworkNode).y ?? 0)
        .attr("x2", (d) => (d.target as NetworkNode).x ?? 0)
        .attr("y2", (d) => (d.target as NetworkNode).y ?? 0);
      nodeSel.attr("transform", (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    sim.alpha(0.9).restart();
    const stopTimer = setTimeout(() => sim.stop(), 1800);

    return () => {
      clearTimeout(stopTimer);
      sim.stop();
    };
  }, [turn, worldRef]);

  return (
    <div className="space-y-2">
      <p className="font-sans text-[11px] leading-snug text-muted-foreground">
        Every alive agent within four cells of another forms a tie. Force-laid:
        clusters mean tight neighbourhoods; loners drift to the edge.
      </p>

      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span>
          <span className="text-foreground">{stats.nodes}</span> agents
        </span>
        <span>
          <span className="text-foreground">{stats.edges}</span> ties
        </span>
      </div>

      <div className="relative h-52 w-full overflow-hidden rounded-sm border border-foreground/10 bg-foreground/[0.02]">
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full text-foreground"
          preserveAspectRatio="xMidYMid meet"
        />

        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-foreground/15 bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground"
            style={{
              left: hover.cx,
              top: hover.cy - 8,
            }}
          >
            <span className="text-muted-foreground">#{hover.id}</span>
            <span className="mx-1.5 text-muted-foreground/50">·</span>
            <span>{MOTIVATION_LABEL[hover.motivation] ?? hover.motivation}</span>
            <span className="mx-1.5 text-muted-foreground/50">·</span>
            <span className="tabular-nums">w {hover.wealth.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function shapePath(motivation: string): string {
  const r = 5;
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

function sampleAgents(agents: RenderAgent[], n: number): RenderAgent[] {
  if (agents.length <= n) return agents;
  const step = agents.length / n;
  const out: RenderAgent[] = [];
  for (let i = 0; i < n; i++) {
    out.push(agents[Math.floor(i * step)]);
  }
  return out;
}

function buildLinks(agents: RenderAgent[], world: WorldView): NetworkLink[] {
  const links: NetworkLink[] = [];
  const ids = new Set(agents.map((a) => a.id));

  for (const a of agents) {
    const v = Math.min(a.vision, NEIGHBOR_RADIUS);
    for (let dy = -v; dy <= v; dy++) {
      const ny = a.y + dy;
      if (ny < 0 || ny >= world.height) continue;
      for (let dx = -v; dx <= v; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = a.x + dx;
        if (nx < 0 || nx >= world.width) continue;
        const occ = world.occupants[ny * world.width + nx];
        if (occ === -1 || occ === a.id) continue;
        if (!ids.has(occ)) continue;
        if (occ < a.id) continue;
        links.push({ source: a.id, target: occ });
      }
    }
  }
  return links;
}
