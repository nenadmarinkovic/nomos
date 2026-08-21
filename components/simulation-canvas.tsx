"use client";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Application,
  CanvasSource,
  Container,
  Graphics,
  Sprite,
  Texture,
} from "pixi.js";

import "pixi.js/unsafe-eval";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

import { AgentInspectorOverlay } from "@/components/agent-inspector";
import {
  drawResourceField,
  SPICE_RGB,
  SPICE_RGB_MONO,
  SUGAR_RGB,
  SUGAR_RGB_MONO,
} from "@/lib/render-resources";
import { cn } from "@/lib/utils";
import {
  activeFrameAtRef,
  activeIntervalRef,
  activeWorldRef,
} from "@/lib/active-world";
import { useSimulationStore } from "@/lib/store";

interface SimulationCanvasProps {
  running: boolean;
}

const MOTIVATION_COLOR_HEX: Record<string, number> = {
  material: 0x0076e7,
  symbolic: 0xe93013,
  normative: 0xf29320,
  power: 0x249375,
};

const MOTIVATION_COLOR_MONO_LIGHT: Record<string, number> = {
  normative: 0x4a4a4a,
  material: 0x2e2e2e,
  power: 0x1a1a1a,
  symbolic: 0x000000,
};
const MOTIVATION_COLOR_MONO_DARK: Record<string, number> = {
  normative: 0xffffff,
  material: 0xe0e0e0,
  power: 0xc2c2c2,
  symbolic: 0xa4a4a4,
};

const MOTIVATION_KEYS = ["material", "symbolic", "normative", "power"] as const;
type MotivationKey = (typeof MOTIVATION_KEYS)[number];

const TRAIL_TTL_MS = 480;
const MAX_TRAILS = 3000;

interface TrailSprite {
  sprite: Sprite;
  bornAt: number;
  baseScale: number;
}

export function SimulationCanvas({ running }: SimulationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stageRef = useRef<Container | null>(null);
  const agentLayerRef = useRef<Container | null>(null);
  const trailLayerRef = useRef<Container | null>(null);
  const trailsRef = useRef<TrailSprite[]>([]);
  const lastTrailTurnRef = useRef<number>(-1);
  const spritesRef = useRef<Map<number, Sprite>>(new Map());
  const texturesRef = useRef<Record<MotivationKey, Texture> | null>(null);
  const selectionLayerRef = useRef<Graphics | null>(null);

  const resourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resourceTextureRef = useRef<Texture | null>(null);
  const resourceSpriteRef = useRef<Sprite | null>(null);
  const lastResourceTurnRef = useRef<number>(-1);
  const rafRef = useRef<number | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const currentSizeRef = useRef({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  const hoveredIdRef = useRef<number | null>(null);
  const [inspectorPos, setInspectorPos] = useState({ x: 12, y: 12 });
  const inspectorSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const started = useSimulationStore((s) => s.started);
  const runId = useSimulationStore((s) => s.runId);
  const turn = useSimulationStore((s) => s.turn);
  const setCanvasSize = useSimulationStore((s) => s.setCanvasSize);

  const monochrome = useSimulationStore((s) => s.monochrome);
  const monoRef = useRef(monochrome);

  const { resolvedTheme } = useTheme();
  const themeRef = useRef<"light" | "dark">("light");
  useEffect(() => {
    themeRef.current = resolvedTheme === "dark" ? "dark" : "light";
  }, [resolvedTheme]);

  const [selectionRun, setSelectionRun] = useState({ runId, started });
  if (selectionRun.runId !== runId || selectionRun.started !== started) {
    setSelectionRun({ runId, started });
    setSelectedId(null);
  }

  function handleInspectorDragEnd(e: DragEndEvent) {
    setInspectorPos((p) => ({
      x: Math.max(0, p.x + e.delta.x),
      y: Math.max(0, p.y + e.delta.y),
    }));
  }

  function agentIdAtPointer(
    e: React.MouseEvent<HTMLDivElement>,
  ): number | null {
    const host = hostRef.current;
    const world = activeWorldRef.current;
    if (!host || !world) return null;
    const r = host.getBoundingClientRect();
    const gx = Math.floor(((e.clientX - r.left) / r.width) * world.width);
    const gy = Math.floor(((e.clientY - r.top) / r.height) * world.height);
    if (gx < 0 || gy < 0 || gx >= world.width || gy >= world.height)
      return null;
    const id = world.occupants[gy * world.width + gx];
    return id === -1 ? null : id;
  }

  function handleHostMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const id = agentIdAtPointer(e);
    if (hoveredIdRef.current !== id) {
      hoveredIdRef.current = id;
      const host = hostRef.current;
      if (host) host.style.cursor = id !== null ? "pointer" : "crosshair";

      if (!running) paint(1);
    }
  }

  function handleHostMouseLeave() {
    if (hoveredIdRef.current === null) return;
    hoveredIdRef.current = null;
    const host = hostRef.current;
    if (host) host.style.cursor = "";
    if (!running) paint(1);
  }

  function handleHostClick(e: React.MouseEvent<HTMLDivElement>) {
    setSelectedId(agentIdAtPointer(e));
  }

  const paint = useCallback((progress = 1) => {
    const app = appRef.current;
    const layer = agentLayerRef.current;
    const textures = texturesRef.current;
    const world = activeWorldRef.current;
    if (!app || !layer || !textures || !world) return;

    const W = app.renderer.width;
    const H = app.renderer.height;
    const cellW = W / world.width;
    const cellH = H / world.height;
    const shapeSize = Math.min(cellW, cellH);
    const agentSize = Math.max(shapeSize * 0.78, 6);
    const ease = easeOutBack(progress);

    const resourceCanvas = resourceCanvasRef.current;
    const resourceSprite = resourceSpriteRef.current;
    let resourceTexture = resourceTextureRef.current;
    if (resourceCanvas && resourceSprite && resourceTexture) {
      const dpr = app.renderer.resolution || 1;
      const bufW = Math.max(2, Math.round(W * dpr));
      const bufH = Math.max(2, Math.round(H * dpr));
      if (resourceCanvas.width !== bufW || resourceCanvas.height !== bufH) {
        resourceCanvas.width = bufW;
        resourceCanvas.height = bufH;

        const oldTexture = resourceTexture;
        const newTexture = new Texture({
          source: new CanvasSource({ resource: resourceCanvas }),
        });
        resourceSprite.texture = newTexture;
        resourceTextureRef.current = newTexture;
        resourceTexture = newTexture;
        oldTexture.destroy(true);
        lastResourceTurnRef.current = -1;
      }
      if (lastResourceTurnRef.current !== world.turn) {
        const rctx = resourceCanvas.getContext("2d");
        if (rctx) {
          rctx.clearRect(0, 0, resourceCanvas.width, resourceCanvas.height);
          const cellWPx = bufW / world.width;
          const cellHPx = bufH / world.height;
          const dotSize = Math.max(Math.min(cellWPx, cellHPx) * 0.18, 2 * dpr);
          const mono = monoRef.current;
          drawResourceField(
            rctx,
            world.cells,
            world.maxCells,
            mono ? SUGAR_RGB_MONO : SUGAR_RGB,
            -1,
            cellWPx,
            cellHPx,
            dotSize,
            world.width,
            world.height,
          );
          drawResourceField(
            rctx,
            world.spice,
            world.maxSpice,
            mono ? SPICE_RGB_MONO : SPICE_RGB,
            1,
            cellWPx,
            cellHPx,
            dotSize,
            world.width,
            world.height,
          );
          resourceTexture.source.update();
          lastResourceTurnRef.current = world.turn;
        }
      }
      resourceSprite.x = 0;
      resourceSprite.y = 0;
      resourceSprite.width = W;
      resourceSprite.height = H;
    }

    const liveIds = new Set<number>();
    const sprites = spritesRef.current;
    const now = performance.now();
    const baseScale = agentSize / 64;
    const trailLayer = trailLayerRef.current;

    if (trailLayer && lastTrailTurnRef.current !== world.turn) {
      const trails = trailsRef.current;
      for (const a of world.agents) {
        if (!a.alive) continue;
        const dx = a.x - a.prevX;
        const dy = a.y - a.prevY;
        if (dx === 0 && dy === 0) continue;
        if (trails.length >= MAX_TRAILS) break;
        const motivationKey = (
          a.motivation in textures ? a.motivation : "material"
        ) as MotivationKey;
        const ghost = new Sprite(textures[motivationKey]);
        ghost.anchor.set(0.5);
        ghost.x = a.prevX * cellW + cellW / 2;
        ghost.y = a.prevY * cellH + cellH / 2;
        const gScale = baseScale * 0.85;
        ghost.scale.set(gScale);
        ghost.alpha = 0.38;
        trailLayer.addChild(ghost);
        trails.push({ sprite: ghost, bornAt: now, baseScale: gScale });
      }
      lastTrailTurnRef.current = world.turn;
    }

    if (trailLayer) {
      const trails = trailsRef.current;
      for (let i = trails.length - 1; i >= 0; i--) {
        const t = trails[i];
        const age = (now - t.bornAt) / TRAIL_TTL_MS;
        if (age >= 1) {
          trailLayer.removeChild(t.sprite);
          t.sprite.destroy();
          trails.splice(i, 1);
        } else {
          const fade = 1 - age;
          t.sprite.alpha = 0.38 * fade;
          t.sprite.scale.set(t.baseScale * (0.85 + 0.15 * fade));
        }
      }
    }

    const breatheT = now / 1000;

    for (const a of world.agents) {
      if (!a.alive) continue;
      liveIds.add(a.id);
      let s = sprites.get(a.id);
      const motivationKey = (
        a.motivation in textures ? a.motivation : "material"
      ) as MotivationKey;
      if (!s) {
        s = new Sprite(textures[motivationKey]);
        s.anchor.set(0.5);
        sprites.set(a.id, s);
        layer.addChild(s);
      } else if (s.texture !== textures[motivationKey]) {
        s.texture = textures[motivationKey];
      }
      const dx = a.x - a.prevX;
      const dy = a.y - a.prevY;
      const ix = a.prevX + dx * ease;
      const iy = a.prevY + dy * ease;
      s.x = ix * cellW + cellW / 2;
      s.y = iy * cellH + cellH / 2;

      const breathe = 1 + 0.04 * Math.sin(breatheT * 1.6 + a.id * 0.7);
      s.scale.set(baseScale * breathe);
      if (dx !== 0 || dy !== 0) {
        const angle = Math.atan2(dy, dx);
        s.rotation = angle * 0.15 * (1 - ease);
      } else {
        s.rotation *= 0.9;
      }
      const wealth = a.sugar + a.spice;
      const safeWealth = Number.isFinite(wealth) && wealth > 0 ? wealth : 0;
      s.alpha = 0.45 + 0.55 * Math.min(1, Math.sqrt(safeWealth / 30));
    }

    for (const [id, s] of sprites) {
      if (liveIds.has(id)) continue;
      layer.removeChild(s);
      s.destroy();
      sprites.delete(id);
    }

    const selection = selectionLayerRef.current;
    if (selection) {
      selection.clear();
      const isDark = themeRef.current === "dark";
      const ink = isDark ? 0xffffff : 0x141414;
      const r = Math.max(shapeSize * 0.95, 9);
      const tSec = now / 1000;

      const hoverId = hoveredIdRef.current;
      const selId = selectedIdRef.current;
      if (hoverId !== null && hoverId !== selId) {
        const h = world.agents[hoverId];
        if (h && h.alive) {
          const hx = h.prevX + (h.x - h.prevX) * ease;
          const hy = h.prevY + (h.y - h.prevY) * ease;
          const hcx = hx * cellW + cellW / 2;
          const hcy = hy * cellH + cellH / 2;
          selection
            .circle(hcx, hcy, r + 2)
            .stroke({ color: ink, width: 1.2, alpha: 0.55 });
        }
      }

      if (selId !== null) {
        const a = world.agents[selId];
        if (a && a.alive) {
          const ax = a.prevX + (a.x - a.prevX) * ease;
          const ay = a.prevY + (a.y - a.prevY) * ease;
          const cx = ax * cellW + cellW / 2;
          const cy = ay * cellH + cellH / 2;

          const lineWidth = Math.max(0.6, shapeSize * 0.045);
          const visionSpan = Math.max(1, a.vision);
          for (let dy = -a.vision; dy <= a.vision; dy++) {
            const ny = a.y + dy;
            if (ny < 0 || ny >= world.height) continue;
            for (let dx = -a.vision; dx <= a.vision; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = a.x + dx;
              if (nx < 0 || nx >= world.width) continue;
              const occ = world.occupants[ny * world.width + nx];
              if (occ === -1 || occ === a.id) continue;
              const n = world.agents[occ];
              if (!n || !n.alive) continue;
              const nix = n.prevX + (n.x - n.prevX) * ease;
              const niy = n.prevY + (n.y - n.prevY) * ease;
              const nxp = nix * cellW + cellW / 2;
              const nyp = niy * cellH + cellH / 2;
              const cheb = Math.max(Math.abs(dx), Math.abs(dy));
              const falloff = 1 - (cheb - 1) / visionSpan;
              const alpha = 0.15 + 0.42 * Math.max(0, falloff);
              selection
                .moveTo(cx, cy)
                .lineTo(nxp, nyp)
                .stroke({ color: ink, width: lineWidth, alpha });
            }
          }

          const pulse = 0.5 + 0.5 * Math.sin(tSec * 2.2);
          selection
            .circle(cx, cy, r)
            .stroke({ color: ink, width: 1.7, alpha: 0.85 + 0.15 * pulse });
        }
      }
    }
  }, []);

  const rebuildAgentTextures = useCallback(() => {
    const app = appRef.current;
    const old = texturesRef.current;
    if (!app || !old) return;
    const next = buildMotivationTextures(
      app,
      monoRef.current,
      themeRef.current === "dark",
    );
    texturesRef.current = next;
    const trailLayer = trailLayerRef.current;
    for (const t of trailsRef.current) {
      trailLayer?.removeChild(t.sprite);
      t.sprite.destroy();
    }
    trailsRef.current = [];
    lastResourceTurnRef.current = -1;
    paint(1);
    for (const k of MOTIVATION_KEYS) old[k].destroy(true);
  }, [paint]);

  useEffect(() => {
    monoRef.current = monochrome;
    rebuildAgentTextures();
  }, [monochrome, rebuildAgentTextures]);

  useEffect(() => {
    if (monoRef.current) rebuildAgentTextures();
  }, [resolvedTheme, rebuildAgentTextures]);

  useEffect(() => {
    if (!containerRef.current) return;
    const apply = (w: number, h: number) => {
      currentSizeRef.current = { width: w, height: h };
      setSize({ width: w, height: h });
      setCanvasSize({ width: w, height: h });
    };
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) apply(Math.round(r.width), Math.round(r.height));
    });
    ro.observe(containerRef.current);
    const r = containerRef.current.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      apply(Math.round(r.width), Math.round(r.height));
    }
    return () => ro.disconnect();
  }, [setCanvasSize]);

  useEffect(() => {
    const host = hostRef.current;
    const container = containerRef.current;
    if (!host || !container) return;
    let cancelled = false;

    const r0 = container.getBoundingClientRect();
    const initW = Math.max(1, Math.round(r0.width));
    const initH = Math.max(1, Math.round(r0.height));
    if (r0.width > 0 && r0.height > 0) {
      currentSizeRef.current = { width: initW, height: initH };
    }

    const app = new Application();
    void app
      .init({
        width: initW,
        height: initH,
        antialias: true,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
      })
      .then(() => {
        if (cancelled) {
          app.destroy(true, { children: true });
          return;
        }
        app.canvas.style.cssText = `position: absolute; left: 0; top: 0; display: block; width: ${initW}px; height: ${initH}px;`;
        host.appendChild(app.canvas);
        const stage = new Container();

        const dprNow = app.renderer.resolution || 1;
        const initBufW = Math.max(2, Math.round(initW * dprNow));
        const initBufH = Math.max(2, Math.round(initH * dprNow));
        const resourceCanvas = document.createElement("canvas");
        resourceCanvas.width = initBufW;
        resourceCanvas.height = initBufH;
        const resourceTexture = new Texture({
          source: new CanvasSource({ resource: resourceCanvas }),
        });
        const resourceSprite = new Sprite(resourceTexture);
        stage.addChild(resourceSprite);

        const trails = new Container();
        stage.addChild(trails);
        const agents = new Container();
        stage.addChild(agents);
        const selectionLayer = new Graphics();
        stage.addChild(selectionLayer);
        app.stage.addChild(stage);
        stageRef.current = stage;
        trailLayerRef.current = trails;
        agentLayerRef.current = agents;
        selectionLayerRef.current = selectionLayer;
        texturesRef.current = buildMotivationTextures(
          app,
          monoRef.current,
          themeRef.current === "dark",
        );
        resourceCanvasRef.current = resourceCanvas;
        resourceTextureRef.current = resourceTexture;
        resourceSpriteRef.current = resourceSprite;
        appRef.current = app;
        const s = currentSizeRef.current;
        if (s.width !== initW || s.height !== initH) {
          app.canvas.style.width = `${s.width}px`;
          app.canvas.style.height = `${s.height}px`;
          app.renderer.resize(s.width, s.height);
        }
        paint(1);
      })
      .catch((err) => {
        console.error("[simulation-canvas] renderer init failed", err);
      });

    const sprites = spritesRef.current;
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      sprites.clear();

      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      stageRef.current = null;
      agentLayerRef.current = null;
      trailLayerRef.current = null;
      trailsRef.current = [];
      lastTrailTurnRef.current = -1;
      selectionLayerRef.current = null;
      texturesRef.current = null;
      resourceSpriteRef.current = null;
      resourceTextureRef.current = null;
      resourceCanvasRef.current = null;
      lastResourceTurnRef.current = -1;
    };
  }, [paint]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || size.width === 0 || size.height === 0) return;
    app.canvas.style.width = `${size.width}px`;
    app.canvas.style.height = `${size.height}px`;
    app.renderer.resize(size.width, size.height);
    paint(1);
  }, [size, paint]);

  useEffect(() => {
    void turn;
    void selectedId;
    void resolvedTheme;
    if (running) return;
    paint(1);
  }, [turn, running, selectedId, resolvedTheme, paint]);

  useEffect(() => {
    if (!running) return;
    function loop() {
      const interval = activeIntervalRef.current;
      const progress = Math.min(
        1,
        Math.max(0, (performance.now() - activeFrameAtRef.current) / interval),
      );
      paint(progress);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, paint]);

  useEffect(() => {
    if (started) return;
    const layer = agentLayerRef.current;
    if (!layer) return;
    layer.removeChildren();
    spritesRef.current.clear();
    const trailLayer = trailLayerRef.current;
    if (trailLayer) {
      for (const t of trailsRef.current) t.sprite.destroy();
      trailLayer.removeChildren();
      trailsRef.current = [];
    }
    lastTrailTurnRef.current = -1;
  }, [started]);

  return (
    <div className="relative flex h-full flex-1 flex-col">
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <div
          ref={hostRef}
          onClick={handleHostClick}
          onMouseMove={handleHostMouseMove}
          onMouseLeave={handleHostMouseLeave}
          style={{ width: size.width, height: size.height }}
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            started ? "opacity-100" : "opacity-0",
          )}
        />
        {started && selectedId !== null && (
          <DndContext
            sensors={inspectorSensors}
            onDragEnd={handleInspectorDragEnd}
          >
            <AgentInspectorOverlay
              selectedId={selectedId}
              position={inspectorPos}
              onClose={() => setSelectedId(null)}
            />
          </DndContext>
        )}
        {!started && (
          <div className="pointer-events-auto absolute inset-0 overflow-y-auto bg-background">
            <div className="mx-auto flex max-w-2xl flex-col px-6 pb-16 pt-16">
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                A society simulation
              </p>
              <h1 className="mt-3 text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                Set a few simple rules. Watch a society grow out of them.
              </h1>
              <p className="mt-5 text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
                You pick the starting conditions. Then a few thousand very
                simple agents get on with their lives: they look around, gather
                food, trade, have children, and die. Everything that shows up
                after that, like crowded settlements, rich and poor, or fights
                over good land, comes out of those small decisions. None of it
                is written into the code.
              </p>

              <ol className="mt-10 space-y-5">
                <Step
                  n="01"
                  title="Set the conditions"
                  body="How many people there are and how equal they start. What the land looks like. How far they can see, how fast they burn through food, how long they live, and what they care about. The setup walks you through it in about a minute."
                />
                <Step
                  n="02"
                  title="Press Run"
                  body="Every turn, each agent looks around, moves to the best spot it can see, eats, gets a little older, and sometimes has a child. That is the whole loop. Thousands of agents run it at the same time."
                />
                <Step
                  n="03"
                  title="Watch what happens"
                  body="Crowds build up on the good land. A few agents get rich and most do not. The poor move or starve. You can watch the inequality number climb while it runs."
                />
                <Step
                  n="04"
                  title="Hear what the observers make of it"
                  body="Ten AI observers watch the same run, each reading it a different way. Marx looks for class. Bourdieu looks for status. Schelling looks for tipping points. They often disagree, which is the interesting part."
                />
              </ol>
            </div>
          </div>
        )}

        <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md border border-border bg-card/80 px-2 py-1 backdrop-blur-sm">
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              running
                ? "animate-pulse bg-brand"
                : started
                  ? "bg-yellow-500/70"
                  : "bg-muted-foreground/40",
            )}
          />
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {running ? "running" : started ? "paused" : "idle"}
          </span>
        </div>
      </div>
    </div>
  );
}

function buildMotivationTextures(
  app: Application,
  mono: boolean,
  isDark: boolean,
): Record<MotivationKey, Texture> {
  const palette = mono
    ? isDark
      ? MOTIVATION_COLOR_MONO_DARK
      : MOTIVATION_COLOR_MONO_LIGHT
    : MOTIVATION_COLOR_HEX;
  const out = {} as Record<MotivationKey, Texture>;
  for (const k of MOTIVATION_KEYS) {
    const color = palette[k];
    const g = new Graphics();
    drawShape(g, k, color);
    const texture = app.renderer.generateTexture(g);
    out[k] = texture;
    g.destroy();
  }
  return out;
}

function drawShape(g: Graphics, motivation: MotivationKey, color: number) {
  const cx = 32;
  const cy = 32;
  const half = 28;
  if (motivation === "material") {
    g.rect(cx - half, cy - half, half * 2, half * 2).fill(color);
    return;
  }
  if (motivation === "symbolic") {
    g.circle(cx, cy, half).fill(color);
    return;
  }
  if (motivation === "normative") {
    g.poly([cx, cy - half, cx + half, cy + half, cx - half, cy + half]).fill(
      color,
    );
    return;
  }
  g.poly([cx, cy - half, cx + half, cy, cx, cy + half, cx - half, cy]).fill(
    color,
  );
}

function easeOutBack(t: number): number {
  const c1 = 1.2;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-4">
      <span className="pt-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {n}
      </span>
      <div>
        <div className="text-lg leading-tight text-foreground">{title}</div>
        <p
          className="mt-1.5 text-sm leading-relaxed text-foreground/75 sm:text-sm"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
    </li>
  );
}
