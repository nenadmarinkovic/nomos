"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { XIcon } from "@phosphor-icons/react";

import type {
  ForceGraphMethods,
  LinkObject,
  NodeObject,
} from "react-force-graph-3d";

import { activeWorldRef } from "@/lib/active-world";
import { useSimulationStore } from "@/lib/store";
import type { RenderAgent } from "@/lib/world";

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

// react-force-graph-3d hands its accessor callbacks the internal node/link
// objects — our GraphNode/GraphLink augmented in place with the x/y/z
// coordinates d3-force-3d assigns during layout. NodeObject/LinkObject carry
// an index signature, so field access is untyped without an explicit `any`.
type SimNode = NodeObject;
type SimLink = LinkObject;
type SimGraphMethods = ForceGraphMethods<SimNode, SimLink>;

const EVENT_HISTORY_LIMIT = 8;
const EVENTS_PER_KIND_LIMIT = 3;

const MOTIVATION_COLOR: Record<string, string> = {
  material: "#E63946",
  symbolic: "#2E5C9E",
  normative: "#FFD23F",
  power: "#2A9D5C",
};

const MOTIVATION_COLOR_MONO_LIGHT: Record<string, string> = {
  normative: "#4A4A4A",
  material: "#2E2E2E",
  power: "#1A1A1A",
  symbolic: "#000000",
};
const MOTIVATION_COLOR_MONO_DARK: Record<string, string> = {
  normative: "#FFFFFF",
  material: "#E0E0E0",
  power: "#C2C2C2",
  symbolic: "#A4A4A4",
};

function motivationColor(
  motivation: string,
  mono: boolean,
  isDark: boolean,
): string {
  const palette = mono
    ? isDark
      ? MOTIVATION_COLOR_MONO_DARK
      : MOTIVATION_COLOR_MONO_LIGHT
    : MOTIVATION_COLOR;
  return palette[motivation] ?? palette.material;
}

const MOTIVATION_LABEL: Record<string, string> = {
  material: "Material",
  symbolic: "Symbolic",
  normative: "Normative",
  power: "Power",
};

const REBUILD_EVERY_N_TURNS = 20;
const TOP_K_PER_AGENT = 3;
const MAX_RENDERED_NODES = 1200;

let hasFitCamera = false;

const ForceGraph3D = dynamic(
  async () => (await import("react-force-graph-3d")).default,
  { ssr: false },
);

const NODE_RADIUS = 6;

// Shared GPU resources — per-node construction leaked VRAM at town scale.
const MOTIVATION_GEOMETRY: Record<string, THREE.BufferGeometry> = {
  symbolic: new THREE.SphereGeometry(NODE_RADIUS, 16, 16),
  normative: new THREE.ConeGeometry(NODE_RADIUS, NODE_RADIUS * 1.8, 4),
  power: new THREE.OctahedronGeometry(NODE_RADIUS, 0),
  material: new THREE.BoxGeometry(
    NODE_RADIUS * 1.6,
    NODE_RADIUS * 1.6,
    NODE_RADIUS * 1.6,
  ),
};

const nodeMaterialCache = new Map<string, THREE.MeshLambertMaterial>();
function getNodeMaterial(
  motivation: string,
  isSelected: boolean,
  mono: boolean,
  isDark: boolean,
): THREE.MeshLambertMaterial {
  const key = `${motivation}:${isSelected ? "s" : "n"}:${mono ? "m" : "c"}:${
    isDark ? "d" : "l"
  }`;
  const cached = nodeMaterialCache.get(key);
  if (cached) return cached;
  const color = motivationColor(motivation, mono, isDark);
  const mat = new THREE.MeshLambertMaterial({
    color,
    emissive: isSelected ? color : 0x000000,
    emissiveIntensity: isSelected ? 0.6 : 0,
  });
  nodeMaterialCache.set(key, mat);
  return mat;
}

export function NetworkCanvas() {
  const turn = useSimulationStore((s) => s.turn);
  const monochrome = useSimulationStore((s) => s.monochrome);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<SimGraphMethods | undefined>(undefined);
  const lastBuiltTurn = useRef<number>(-9999);
  const prevNodeIdsRef = useRef<Set<number>>(new Set());
  const prevLinkKeysRef = useRef<Set<string>>(new Set());
  const nodeCacheRef = useRef<Map<number, GraphNode>>(new Map());

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

  useEffect(() => {
    if (turn === 0 && lastBuiltTurn.current > 0) {
      prevNodeIdsRef.current = new Set();
      prevLinkKeysRef.current = new Set();
      nodeCacheRef.current = new Map();
      lastBuiltTurn.current = -9999;
      hasFitCamera = false;
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
    const { nodes, links } = buildTieGraph(
      aliveAgents,
      world.ties,
      nodeCacheRef.current,
    );
    setData({ nodes, links });
    setStats({
      nodes: nodes.length,
      edges: links.length,
      alive: aliveAgents.length,
    });

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

  const handleNodeClick = (n: SimNode) => {
    setSelectedId(n.id as number);
    const g = graphRef.current;
    if (!g || typeof g.cameraPosition !== "function") return;
    // Skip if d3-force-3d hasn't placed the node — cameraPosition crashes
    // on undefined coords.
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
            nodeVal={() => 1}
            nodeColor={(n: SimNode) =>
              motivationColor(n.motivation, monochrome, isDark)
            }
            nodeOpacity={0.95}
            nodeLabel={(n: SimNode) => {
              const label = MOTIVATION_LABEL[n.motivation] ?? n.motivation;
              const wRaw = Number(n.wealth);
              const w = Number.isFinite(wRaw) ? wRaw : 0;
              return `#${n.id} · ${label} · w ${w.toFixed(1)}`;
            }}
            linkColor={() => "rgba(180,180,180,0.85)"}
            linkOpacity={0.9}
            linkWidth={(l: SimLink) => 0.4 + 1.6 * (l.weight / maxWeight)}
            linkDirectionalParticles={0}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => setSelectedId(null)}
            cooldownTicks={40}
            warmupTicks={5}
            d3AlphaDecay={0.06}
            d3VelocityDecay={0.5}
            onEngineStop={() => {
              if (hasFitCamera || data.nodes.length === 0) return;
              const g = graphRef.current;
              if (g && typeof g.zoomToFit === "function") {
                hasFitCamera = true;
                g.zoomToFit(500, 40);
              }
            }}
            enableNodeDrag={false}
            controlType="orbit"
            showNavInfo={false}
            nodeThreeObject={(n: SimNode) => {
              const motivation = n.motivation;
              const geom =
                MOTIVATION_GEOMETRY[motivation] ?? MOTIVATION_GEOMETRY.material;
              const mat = getNodeMaterial(
                motivation,
                n.id === selectedId,
                monochrome,
                isDark,
              );
              return new THREE.Mesh(geom, mat);
            }}
          />
        ) : null}
      </div>

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-1 rounded-md border border-foreground/10 bg-card/90 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span>
            T:<span className="tabular-nums text-foreground">{turn}</span>
          </span>
          <span>
            <span className="text-foreground">{stats.nodes}</span>
            {stats.alive > stats.nodes ? (
              <span className="text-muted-foreground/70">/{stats.alive}</span>
            ) : null}{" "}
            nodes
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
            <p className="text-xs italic leading-snug text-foreground/80">
              Each shape is one agent; lines show each agent&apos;s three
              strongest trade partners. Drag to orbit, scroll to zoom, click an
              agent to inspect.
            </p>
          ) : (
            <>
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Recent changes
              </div>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs tabular-nums">
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
  const monochrome = useSimulationStore((s) => s.monochrome);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
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
      <div className="absolute bottom-4 right-4 z-10 w-72 rounded-md border border-foreground/15 bg-card/95 p-3 text-xs text-foreground backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Agent #{agentId}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <XIcon size={12} weight="bold" />
          </button>
        </div>
        <p className="mt-2 italic text-muted-foreground">
          Gone — this agent has died.
        </p>
      </div>
    );
  }

  const wealth = agent.sugar + agent.spice;

  return (
    <div className="absolute bottom-4 right-4 z-10 w-80 rounded-md border border-foreground/15 bg-card/95 text-xs text-foreground backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="block size-3 rounded-[2px]"
            style={{
              background: motivationColor(agent.motivation, monochrome, isDark),
            }}
          />
          <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Agent #{agent.id}
          </span>
          <span className="font-mono text-xs text-foreground">
            {MOTIVATION_LABEL[agent.motivation] ?? agent.motivation}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
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
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Top trade partners
        </span>
        {partners.length === 0 ? (
          <p className="mt-1.5 text-xs italic text-muted-foreground">
            No partners yet — this agent hasn&apos;t traded.
          </p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1">
            {partners.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 font-mono text-xs"
              >
                <span
                  aria-hidden
                  className="block size-2 rounded-[1px]"
                  style={{
                    background: motivationColor(
                      p.motivation,
                      monochrome,
                      isDark,
                    ),
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
      <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-xs tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}

function buildTieGraph(
  alive: readonly RenderAgent[],
  ties: Float32Array,
  cache: Map<number, GraphNode>,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const aliveById = new Map<number, RenderAgent>();
  for (const a of alive) aliveById.set(a.id, a);

  // Tie-weight sum per agent — caps the rendered set and scores top-K edges.
  const embeddedness = new Map<number, number>();
  for (let i = 0; i < ties.length; i += 3) {
    const a = ties[i] | 0;
    const b = ties[i + 1] | 0;
    if (!aliveById.has(a) || !aliveById.has(b)) continue;
    const w = ties[i + 2];
    embeddedness.set(a, (embeddedness.get(a) ?? 0) + w);
    embeddedness.set(b, (embeddedness.get(b) ?? 0) + w);
  }

  // Render only the most-embedded agents at city scale; the rest is hairball.
  let rendered: RenderAgent[];
  if (alive.length > MAX_RENDERED_NODES) {
    const sorted = [...alive].sort(
      (p, q) => (embeddedness.get(q.id) ?? 0) - (embeddedness.get(p.id) ?? 0),
    );
    rendered = sorted.slice(0, MAX_RENDERED_NODES);
  } else {
    rendered = [...alive];
  }
  const renderedIds = new Set<number>();
  for (const a of rendered) renderedIds.add(a.id);

  // Reuse cached nodes so force-graph's layout state (x/y/z/vx/vy/vz) survives.
  for (const id of cache.keys()) {
    if (!renderedIds.has(id)) cache.delete(id);
  }
  const nodes: GraphNode[] = new Array(rendered.length);
  for (let i = 0; i < rendered.length; i++) {
    const a = rendered[i];
    // Guard against NaN/Infinity/negative wealth — Three.js crashes on those.
    const w = a.sugar + a.spice;
    const safeWealth = Number.isFinite(w) && w > 0 ? w : 0;
    let node = cache.get(a.id);
    if (node) {
      node.motivation = a.motivation;
      node.wealth = safeWealth;
    } else {
      node = { id: a.id, motivation: a.motivation, wealth: safeWealth };
      cache.set(a.id, node);
    }
    nodes[i] = node;
  }

  // Build per-agent edge lists for the top-K filter.
  const raw: GraphLink[] = [];
  const byAgent = new Map<number, { idx: number; weight: number }[]>();
  for (let i = 0; i < ties.length; i += 3) {
    const a = ties[i] | 0;
    const b = ties[i + 1] | 0;
    if (!renderedIds.has(a) || !renderedIds.has(b)) continue;
    const weight = ties[i + 2];
    const idx = raw.length;
    raw.push({ source: a, target: b, weight });
    let listA = byAgent.get(a);
    if (!listA) {
      listA = [];
      byAgent.set(a, listA);
    }
    listA.push({ idx, weight });
    let listB = byAgent.get(b);
    if (!listB) {
      listB = [];
      byAgent.set(b, listB);
    }
    listB.push({ idx, weight });
  }

  // Keep an edge if it's among either endpoint's strongest ties.
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
