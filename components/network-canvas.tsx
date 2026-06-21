"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { activeWorldRef } from "@/lib/active-world";
import { useSimulationStore } from "@/lib/store";
import type { RenderAgent } from "@/lib/world";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface GraphNode {
  id: number;
  motivation: string;
  wealth: number;
}

interface GraphLink {
  source: number;
  target: number;
  weight: number;
}

type GraphEvent = {
  turn: number;
  kind: "birth" | "death" | "tie";
  text: string;
};

interface RebuildDelta {
  addedNodes: number;
  removedNodes: number;
  addedLinks: number;
  removedLinks: number;
}

const EVENT_HISTORY_LIMIT = 8;
const EVENTS_PER_KIND_LIMIT = 3;

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

const REBUILD_EVERY_N_TURNS = 20;
/** Only the K heaviest trade ties of each agent survive into the rendered
 * graph. Cuts the hairball down to each agent's strongest social ego-network. */
const TOP_K_PER_AGENT = 3;

// The 3D force graph is a Three.js-backed client component — no SSR.
const ForceGraph3D = dynamic(
  async () => (await import("react-force-graph-3d")).default,
  { ssr: false },
);

/**
 * Force-directed graph view of the simulation, laid out in 3D space via
 * d3-force-3d (under react-force-graph-3d / Three.js). Nodes are alive
 * agents; edges are each agent's three strongest persistent trade-partner
 * ties (their social ego-network).
 */
export function NetworkCanvas() {
  const turn = useSimulationStore((s) => s.turn);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const lastBuiltTurn = useRef<number>(-9999);
  const prevNodeIdsRef = useRef<Set<number>>(new Set());
  const prevLinkKeysRef = useRef<Set<string>>(new Set());

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [data, setData] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const [stats, setStats] = useState({ nodes: 0, edges: 0, alive: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lastRebuildTurn, setLastRebuildTurn] = useState(0);
  const [lastDelta, setLastDelta] = useState<RebuildDelta>({
    addedNodes: 0,
    removedNodes: 0,
    addedLinks: 0,
    removedLinks: 0,
  });
  const [events, setEvents] = useState<GraphEvent[]>([]);

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

  // Rebuild the graph from the live world on a slow cadence so the layout has
  // time to settle and you don't get "new graph every second" jitter. Each
  // rebuild also diffs against the previous one so the badge can name what
  // changed and the event ticker can list births / deaths / new ties.
  useEffect(() => {
    // A turn reset means a new run started; wipe diff bookkeeping so the
    // first frame is treated as a baseline instead of a mass-death event.
    if (turn === 0 && lastBuiltTurn.current > 0) {
      prevNodeIdsRef.current = new Set();
      prevLinkKeysRef.current = new Set();
      lastBuiltTurn.current = -9999;
      setEvents([]);
    }

    const shouldRebuild =
      lastBuiltTurn.current < 0 ||
      turn - lastBuiltTurn.current >= REBUILD_EVERY_N_TURNS;
    if (!shouldRebuild) return;
    lastBuiltTurn.current = turn;

    const world = activeWorldRef.current;
    if (!world) return;

    const aliveAgents = world.agents.filter((a) => a.alive);
    const { nodes, links } = buildTieGraph(aliveAgents, world.ties);
    // The graph data comes from a worker-driven mutable ref; we have to
    // sync it into React state for the third-party graph component to read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData({ nodes, links });
    setStats({
      nodes: nodes.length,
      edges: links.length,
      alive: aliveAgents.length,
    });

    // ---- Diff bookkeeping (UI-only; the graph itself is untouched) ----
    const prevIds = prevNodeIdsRef.current;
    const prevKeys = prevLinkKeysRef.current;
    const currentIds = new Set<number>();
    const currentKeys = new Set<string>();
    for (const n of nodes) currentIds.add(n.id);
    for (const l of links) currentKeys.add(linkKey(l));

    const newNodeIds: number[] = [];
    const removedNodeIds: number[] = [];
    const newLinkKeys: string[] = [];
    for (const id of currentIds) if (!prevIds.has(id)) newNodeIds.push(id);
    for (const id of prevIds) if (!currentIds.has(id)) removedNodeIds.push(id);
    for (const k of currentKeys) if (!prevKeys.has(k)) newLinkKeys.push(k);
    let removedLinkCount = 0;
    for (const k of prevKeys) if (!currentKeys.has(k)) removedLinkCount++;

    const isFirstRebuild = prevIds.size === 0;
    setLastRebuildTurn(turn);
    setLastDelta({
      addedNodes: newNodeIds.length,
      removedNodes: removedNodeIds.length,
      addedLinks: newLinkKeys.length,
      removedLinks: removedLinkCount,
    });

    if (!isFirstRebuild) {
      const burst: GraphEvent[] = [];
      for (const id of newNodeIds.slice(0, EVENTS_PER_KIND_LIMIT)) {
        burst.push({ turn, kind: "birth", text: `+ #${id}` });
      }
      for (const id of removedNodeIds.slice(0, EVENTS_PER_KIND_LIMIT)) {
        burst.push({ turn, kind: "death", text: `− #${id}` });
      }
      for (const k of newLinkKeys.slice(0, EVENTS_PER_KIND_LIMIT)) {
        const [a, b] = k.split(":");
        burst.push({ turn, kind: "tie", text: `+ #${a}↔#${b}` });
      }
      if (burst.length > 0) {
        setEvents((prev) => [...burst, ...prev].slice(0, EVENT_HISTORY_LIMIT));
      }
    }

    prevNodeIdsRef.current = currentIds;
    prevLinkKeysRef.current = currentKeys;
  }, [turn]);

  const maxWeight = useMemo(
    () => data.links.reduce((m, l) => (l.weight > m ? l.weight : m), 1),
    [data.links],
  );

  const handleNodeClick = (n: any) => {
    setSelectedId(n.id as number);
    const g = graphRef.current;
    if (!g || typeof g.cameraPosition !== "function") return;
    // Only frame the node once d3-force-3d has actually placed it. Calling
    // cameraPosition with an undefined look-at coordinate is what produced
    // the runtime "Cannot read properties of undefined (reading 'x')".
    const nx = typeof n.x === "number" ? n.x : 0;
    const ny = typeof n.y === "number" ? n.y : 0;
    const nz = typeof n.z === "number" ? n.z : 0;
    if (nx === 0 && ny === 0 && nz === 0) return;
    const dist = 80;
    const ratio = 1 + dist / Math.hypot(nx, ny, nz);
    g.cameraPosition(
      { x: nx * ratio, y: ny * ratio, z: nz * ratio },
      { x: nx, y: ny, z: nz },
      800,
    );
  };

  return (
    <div ref={containerRef} className="relative flex h-full flex-1">
      <div className="absolute inset-0">
        {size.w > 0 && size.h > 0 ? (
          <ForceGraph3D
            ref={graphRef}
            width={size.w}
            height={size.h}
            graphData={data}
            backgroundColor="rgba(0,0,0,0)"
            nodeRelSize={4}
            nodeVal={(n: any) => 1 + Math.log(1 + (n.wealth as number))}
            nodeColor={(n: any) =>
              MOTIVATION_COLOR[n.motivation as string] ?? "#E63946"
            }
            nodeOpacity={0.95}
            nodeLabel={(n: any) => {
              const label =
                MOTIVATION_LABEL[n.motivation as string] ??
                (n.motivation as string);
              return `#${n.id} · ${label} · w ${(n.wealth as number).toFixed(1)}`;
            }}
            linkColor={() => "rgba(180,180,180,0.85)"}
            linkOpacity={0.9}
            linkWidth={(l: any) => 0.4 + 1.6 * ((l.weight as number) / maxWeight)}
            linkDirectionalParticles={0}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => setSelectedId(null)}
            cooldownTicks={120}
            warmupTicks={20}
            d3AlphaDecay={0.04}
            d3VelocityDecay={0.4}
            enableNodeDrag={false}
            controlType="orbit"
            showNavInfo={false}
            nodeThreeObject={(n: any) => {
              const motivation = n.motivation as string;
              const color = MOTIVATION_COLOR[motivation] ?? "#E63946";
              const r = 3 + Math.log(1 + (n.wealth as number));
              const geom = motivationGeometry(motivation, r);
              const isSelected = n.id === selectedId;
              const mat = new THREE.MeshLambertMaterial({
                color,
                emissive: isSelected ? color : 0x000000,
                emissiveIntensity: isSelected ? 0.6 : 0,
              });
              return new THREE.Mesh(geom, mat);
            }}
          />
        ) : null}
      </div>

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-1 rounded-md border border-foreground/10 bg-card/90 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span>
            T:<span className="tabular-nums text-foreground">{turn}</span>
          </span>
          <span>
            <span className="text-foreground">{stats.nodes}</span> nodes
          </span>
          <span>
            <span className="text-foreground">{stats.edges}</span> ties
          </span>
        </div>
        <span className="text-muted-foreground/70">
          rebuilt{" "}
          <span className="tabular-nums text-foreground/80">
            {Math.max(0, turn - lastRebuildTurn)}t
          </span>{" "}
          ago · Δ {formatDelta(lastDelta)}
        </span>
      </div>

      {selectedId === null && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-[28rem] max-w-[calc(100vw-2rem)] rounded-md border border-foreground/10 bg-card/90 px-3 py-2 backdrop-blur-sm">
          {events.length === 0 ? (
            <p className="font-serif text-[12px] italic leading-snug text-foreground/80">
              Each shape is one agent; lines show each agent&apos;s three
              strongest trade partners. Drag to orbit, scroll to zoom, click an
              agent to inspect.
            </p>
          ) : (
            <>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Recent changes
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] tabular-nums">
                {events.map((e, i) => (
                  <li
                    key={`${e.turn}:${e.kind}:${e.text}:${i}`}
                    className="flex items-baseline gap-1"
                  >
                    <span className="text-muted-foreground/60">T{e.turn}</span>
                    <span className={eventColor(e.kind)}>{e.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {selectedId !== null && (
        <AgentInspector
          agentId={selectedId}
          turn={turn}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function motivationGeometry(motivation: string, r: number): THREE.BufferGeometry {
  switch (motivation) {
    case "symbolic":
      return new THREE.SphereGeometry(r, 16, 16);
    case "normative":
      return new THREE.ConeGeometry(r, r * 1.8, 4);
    case "power":
      return new THREE.OctahedronGeometry(r, 0);
    default:
      return new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6);
  }
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
    return {
      agent: a ?? null,
      partners: collected.slice(0, 6),
      embeddedness: total,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, turn]);

  if (!agent || !agent.alive) {
    return (
      <div className="absolute bottom-4 right-4 z-10 w-72 rounded-md border border-foreground/15 bg-card/95 p-3 font-sans text-[12px] text-foreground shadow-xl backdrop-blur-md">
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
            ×
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
    <div className="absolute bottom-4 right-4 z-10 w-80 rounded-md border border-foreground/15 bg-card/95 font-sans text-[12px] text-foreground shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="block size-3 rounded-[2px]"
            style={{
              background: MOTIVATION_COLOR[agent.motivation] ?? "#E63946",
            }}
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
          ×
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
                  style={{
                    background: MOTIVATION_COLOR[p.motivation] ?? "#E63946",
                  }}
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

function buildTieGraph(
  alive: readonly RenderAgent[],
  ties: Float32Array,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const aliveById = new Map<number, RenderAgent>();
  for (const a of alive) aliveById.set(a.id, a);

  const nodes: GraphNode[] = alive.map((a) => ({
    id: a.id,
    motivation: a.motivation,
    wealth: a.sugar + a.spice,
  }));

  const raw: GraphLink[] = [];
  for (let i = 0; i < ties.length; i += 3) {
    const a = ties[i] | 0;
    const b = ties[i + 1] | 0;
    if (!aliveById.has(a) || !aliveById.has(b)) continue;
    raw.push({ source: a, target: b, weight: ties[i + 2] });
  }

  // Top-K per agent: keep an edge only if it's among either endpoint's
  // strongest ties.
  const byAgent = new Map<number, { idx: number; weight: number }[]>();
  raw.forEach((l, idx) => {
    let listA = byAgent.get(l.source);
    if (!listA) {
      listA = [];
      byAgent.set(l.source, listA);
    }
    listA.push({ idx, weight: l.weight });
    let listB = byAgent.get(l.target);
    if (!listB) {
      listB = [];
      byAgent.set(l.target, listB);
    }
    listB.push({ idx, weight: l.weight });
  });

  const keep = new Set<number>();
  for (const list of byAgent.values()) {
    list.sort((p, q) => q.weight - p.weight);
    const k = Math.min(TOP_K_PER_AGENT, list.length);
    for (let i = 0; i < k; i++) keep.add(list[i].idx);
  }

  const links = raw.filter((_, idx) => keep.has(idx));
  return { nodes, links };
}

function linkKey(l: GraphLink): string {
  return `${l.source}:${l.target}`;
}

function formatDelta(d: RebuildDelta): string {
  const parts: string[] = [];
  if (d.addedNodes) parts.push(`+${d.addedNodes} born`);
  if (d.removedNodes) parts.push(`−${d.removedNodes} died`);
  if (d.addedLinks) parts.push(`+${d.addedLinks} ties`);
  if (d.removedLinks) parts.push(`−${d.removedLinks} ties`);
  return parts.length === 0 ? "no change" : parts.join(", ");
}

function eventColor(kind: GraphEvent["kind"]): string {
  switch (kind) {
    case "birth":
      return "text-[#2E5C9E]";
    case "death":
      return "text-[#E63946]";
    case "tie":
      return "text-foreground";
  }
}
