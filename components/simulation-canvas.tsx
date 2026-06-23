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
import { useCallback, useEffect, useRef, useState } from "react";

import { AgentInspectorOverlay } from "@/components/agent-inspector";
import {
  drawResourceField,
  SPICE_RGB,
  SUGAR_RGB,
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
  material: 0xe63946,
  symbolic: 0x2e5c9e,
  normative: 0xffd23f,
  power: 0x2a9d5c,
};

const MOTIVATION_KEYS = ["material", "symbolic", "normative", "power"] as const;
type MotivationKey = (typeof MOTIVATION_KEYS)[number];

/** Pixi WebGL field renderer. Each alive agent is a motivation-coloured
 *  sprite (batched by Pixi); the resource grid is an off-screen Canvas2D
 *  blitted to a single GPU sprite each tick; selection is a Graphics
 *  layer with a pulsing two-pass ring. */
export function SimulationCanvas({ running }: SimulationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stageRef = useRef<Container | null>(null);
  const agentLayerRef = useRef<Container | null>(null);
  const spritesRef = useRef<Map<number, Sprite>>(new Map());
  const texturesRef = useRef<Record<MotivationKey, Texture> | null>(null);
  /** Selection overlay — vision lines + a two-pass ring with a subtle
   *  pulsing alpha for a "live" feel that C2D's static ring doesn't have. */
  const selectionLayerRef = useRef<Graphics | null>(null);
  // The resource layer: an off-screen Canvas2D we redraw each tick, plus
  // a single Pixi Sprite that wraps it as a texture. One draw call for
  // ≤12k cells, with sharp pixels at any zoom.
  const resourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resourceTextureRef = useRef<Texture | null>(null);
  const resourceSpriteRef = useRef<Sprite | null>(null);
  const lastResourceTurnRef = useRef<number>(-1);
  const rafRef = useRef<number | null>(null);
  // Canvas size: React state drives both the host's inline pixel dims
  // (mirroring the Canvas2D path that's known to lay out correctly) and
  // the Pixi renderer. The ref mirrors the same value so async callbacks
  // (init().then) can read the latest without a stale closure.
  const [size, setSize] = useState({ width: 0, height: 0 });
  const currentSizeRef = useRef({ width: 0, height: 0 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  const [inspectorPos, setInspectorPos] = useState({ x: 12, y: 12 });
  const inspectorSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const started = useSimulationStore((s) => s.started);
  const runId = useSimulationStore((s) => s.runId);
  const turn = useSimulationStore((s) => s.turn);
  const setCanvasSize = useSimulationStore((s) => s.setCanvasSize);

  // Clear selection on new run.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(null);
  }, [runId, started]);

  function handleInspectorDragEnd(e: DragEndEvent) {
    setInspectorPos((p) => ({
      x: Math.max(0, p.x + e.delta.x),
      y: Math.max(0, p.y + e.delta.y),
    }));
  }

  function handleHostClick(e: React.MouseEvent<HTMLDivElement>) {
    const host = hostRef.current;
    const world = activeWorldRef.current;
    if (!host || !world) return;
    const r = host.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const cellW = r.width / world.width;
    const cellH = r.height / world.height;
    const gx = Math.floor(px / cellW);
    const gy = Math.floor(py / cellH);
    if (gx < 0 || gy < 0 || gx >= world.width || gy >= world.height) {
      setSelectedId(null);
      return;
    }
    const id = world.occupants[gy * world.width + gx];
    setSelectedId(id === -1 ? null : id);
  }

  const paint = useCallback((progress = 1) => {
    const app = appRef.current;
    const layer = agentLayerRef.current;
    const textures = texturesRef.current;
    const world = activeWorldRef.current;
    if (!app || !layer || !textures || !world) return;

    // In Pixi v8, `renderer.width/height` are already CSS-space dimensions
    // (the values passed to `resize()`); the framebuffer attribute is
    // separately scaled by `resolution`. Dividing again here was the
    // bug that made all content render at half size in the top-left
    // quarter on retina displays.
    const W = app.renderer.width;
    const H = app.renderer.height;
    const cellW = W / world.width;
    const cellH = H / world.height;
    const shapeSize = Math.min(cellW, cellH);
    // Floor at 6 CSS pixels so agents stay legible even at city scale,
    // where each cell on a typical viewport is only ~9 px wide.
    const agentSize = Math.max(shapeSize * 0.78, 6);
    const ease = easeInOutCubic(progress);

    // Resource layer — only repaint when the world's turn has changed.
    // The off-screen canvas is sized at framebuffer resolution (CSS × dpr)
    // and drawn at that scale so retina displays render sharp; the Pixi
    // sprite stays at CSS-pixel dimensions, so Pixi 1:1-maps texture
    // pixels to framebuffer pixels.
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
        // Recreate the texture entirely so UVs match the new canvas
        // dimensions. The old source/texture is destroyed; the new one
        // is built via explicit constructors (not `Texture.from`) so
        // Pixi's texture cache can't hand us back a stale entry.
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
          drawResourceField(
            rctx,
            world.cells,
            world.maxCells,
            SUGAR_RGB,
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
            SPICE_RGB,
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
      const ix = a.prevX + (a.x - a.prevX) * ease;
      const iy = a.prevY + (a.y - a.prevY) * ease;
      s.x = ix * cellW + cellW / 2;
      s.y = iy * cellH + cellH / 2;
      const scale = agentSize / 64;
      s.scale.set(scale);
      // Wealth-based brightness. Broke agents dim toward α=0.45, rich
      // agents stay at full brightness. The sqrt mapping handles the
      // long-tail wealth distribution: most agents sit in the middle
      // band, a few outliers anchor the "fully bright" reading.
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

    // Selection overlay — pulsing two-pass ring + vision lines.
    const selection = selectionLayerRef.current;
    if (selection) {
      selection.clear();
      const selId = selectedIdRef.current;
      if (selId !== null) {
        const a = world.agents[selId];
        if (a && a.alive) {
          const ax = a.prevX + (a.x - a.prevX) * ease;
          const ay = a.prevY + (a.y - a.prevY) * ease;
          const cx = ax * cellW + cellW / 2;
          const cy = ay * cellH + cellH / 2;

          // Vision lines — to every visible neighbour. Drawn first so the
          // selection ring overlaps them at the centre.
          const lineWidth = Math.max(0.8, shapeSize * 0.06);
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
              selection
                .moveTo(cx, cy)
                .lineTo(nxp, nyp)
                .stroke({ color: 0x141414, width: lineWidth, alpha: 0.45 });
            }
          }

          // Two-pass ring with breathing alpha. The outer halo stays
          // steady; the inner ring pulses slowly so the selection feels
          // alive without distracting from the agents.
          const r = Math.max(shapeSize * 0.9, 8);
          const t = performance.now() / 1000;
          const pulse = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.4));
          selection
            .circle(cx, cy, r + 3)
            .stroke({ color: 0xffffff, width: 3, alpha: 0.6 });
          selection
            .circle(cx, cy, r)
            .stroke({ color: 0x141414, width: 1.6, alpha: pulse });
        }
      }
    }
  }, []);

  // ResizeObserver pushes the container's dimensions into both React
  // state (drives the host's inline width/height) and the ref (read by
  // async init callbacks).
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

  // Bootstrap the Pixi Application. We measure the container synchronously
  // BEFORE calling init() so Pixi starts at the right size — no race
  // between init() resolving and a later resize call.
  useEffect(() => {
    const host = hostRef.current;
    const container = containerRef.current;
    if (!host || !container) return;
    let cancelled = false;

    // Synchronous measurement — forces layout, gives real dims.
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
          // Strict-mode mount/unmount race: init finished after cleanup ran.
          app.destroy(true, { children: true });
          return;
        }
        // Apply CSS dimensions explicitly. Pixi sets the framebuffer
        // attributes; we set the display CSS so the canvas fills the host.
        app.canvas.style.cssText = `position: absolute; left: 0; top: 0; display: block; width: ${initW}px; height: ${initH}px;`;
        host.appendChild(app.canvas);
        const stage = new Container();
        // Resource layer first (below agents). The sprite's texture is
        // an off-screen canvas we paint per tick; one Pixi draw call.
        // Initial canvas is sized to the framebuffer right away so the
        // first texture has correct UVs — `Texture.from(canvas)` reads
        // the canvas dimensions at creation time and caches them.
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
        const agents = new Container();
        stage.addChild(agents);
        // Selection overlay sits above agents so the ring isn't occluded.
        const selectionLayer = new Graphics();
        stage.addChild(selectionLayer);
        app.stage.addChild(stage);
        stageRef.current = stage;
        agentLayerRef.current = agents;
        selectionLayerRef.current = selectionLayer;
        texturesRef.current = buildMotivationTextures(app);
        resourceCanvasRef.current = resourceCanvas;
        resourceTextureRef.current = resourceTexture;
        resourceSpriteRef.current = resourceSprite;
        appRef.current = app;
        // If the container has been resized between measurement and now
        // (e.g., RO fired with a different size during the async init),
        // catch up to the latest dims.
        const s = currentSizeRef.current;
        if (s.width !== initW || s.height !== initH) {
          app.canvas.style.width = `${s.width}px`;
          app.canvas.style.height = `${s.height}px`;
          app.renderer.resize(s.width, s.height);
        }
        paint(1);
      });

    const sprites = spritesRef.current;
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      sprites.clear();
      // Only destroy if appRef.current is populated — that flag is only
      // set after init resolves, so this avoids the half-init crash
      // (`this._cancelResize is not a function`). When init is still
      // pending the then() above will destroy the app itself.
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      stageRef.current = null;
      agentLayerRef.current = null;
      selectionLayerRef.current = null;
      texturesRef.current = null;
      resourceSpriteRef.current = null;
      resourceTextureRef.current = null;
      resourceCanvasRef.current = null;
      lastResourceTurnRef.current = -1;
    };
    // `paint` is stable (useCallback with []), so including it doesn't
    // re-trigger Pixi init on every render.
  }, [paint]);

  // Drive Pixi's renderer from React state. Runs whenever size changes
  // *or* once init has completed (re-fires because `paint` is the same
  // useCallback ref — actually no, only on size change, so init's .then
  // also resizes itself, see below).
  useEffect(() => {
    const app = appRef.current;
    if (!app || size.width === 0 || size.height === 0) return;
    app.canvas.style.width = `${size.width}px`;
    app.canvas.style.height = `${size.height}px`;
    app.renderer.resize(size.width, size.height);
    paint(1);
  }, [size, paint]);

  // Repaint on every fresh tick when not running (paused), and on
  // selection change so the ring updates immediately even while paused.
  useEffect(() => {
    void turn;
    void selectedId;
    if (running) return;
    paint(1);
  }, [turn, running, selectedId, paint]);

  // Per-RAF interpolated repaint while running.
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

  // Clear when no run is active.
  useEffect(() => {
    if (started) return;
    const layer = agentLayerRef.current;
    if (!layer) return;
    layer.removeChildren();
    spritesRef.current.clear();
  }, [started]);

  return (
    <div className="relative flex h-full flex-1 flex-col">
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <div
          ref={hostRef}
          onClick={handleHostClick}
          style={{ width: size.width, height: size.height }}
          className={cn(
            "absolute inset-0 transition-opacity duration-300",
            started ? "cursor-pointer opacity-100" : "opacity-0",
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
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                A generative society simulation
              </p>
              <h1 className="mt-3 font-serif text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
                Build a society from{" "}
                <em className="text-brand">simple rules</em> and watch what it
                becomes.
              </h1>
              <p className="mt-5 font-serif text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
                Nomos doesn&rsquo;t program societies — it grows them. You set
                a few starting conditions; agents follow simple rules; whatever
                happens next is what the conditions produced. Inequality,
                settlements, classes, conflict: never written into the engine,
                always emerging from the bottom up.
              </p>

              <ol className="mt-10 space-y-5">
                <Step
                  n="01"
                  title="Set the conditions"
                  body="How many people. How equal they start. What kind of land. What they want — resources (Marx), status (Bourdieu), belonging (Durkheim), or domination over others. What kind of minds they have — Herbert Simon&rsquo;s bounded rationality, learners, or imitators."
                />
                <Step
                  n="02"
                  title="Press Run"
                  body="Agents move, harvest, pay metabolism, age, die, and — if you turned inheritance on — leave their wealth to children. The same Sugarscape rule Joshua Epstein wrote in 1996, run in your browser."
                />
                <Step
                  n="03"
                  title="Watch what emerges"
                  body="Wealth concentrates. Clusters form on the resource peaks. The poor migrate or starve. The Gini coefficient climbs in real time. You didn&rsquo;t script any of it — it grew from what you set."
                />
                <Step
                  n="04"
                  title="Hear the theorists"
                  body="AI observers read the same run through different lenses — Marx, Polanyi, Bourdieu, Durkheim, Granovetter, Schelling, Turchin, Farmer, Epstein, Flack, Axelrod — and narrate what they see in their own vocabulary. Same emergence, multiple readings, side by side."
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
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {running ? "running" : started ? "paused" : "idle"}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Pre-render each motivation's shape into a 64×64 RenderTexture once.
 *  Sprites then scale these to fit the current cell. Phase B will swap the
 *  filled-circle placeholders for the proper square/circle/triangle/diamond
 *  per motivation. */
function buildMotivationTextures(
  app: Application,
): Record<MotivationKey, Texture> {
  const out = {} as Record<MotivationKey, Texture>;
  for (const k of MOTIVATION_KEYS) {
    const color = MOTIVATION_COLOR_HEX[k];
    const g = new Graphics();
    drawShape(g, k, color);
    const texture = app.renderer.generateTexture(g);
    out[k] = texture;
    g.destroy();
  }
  return out;
}

/** Draw the canonical motivation shape into a Graphics, centred in a 64×64
 *  box. The size argument is the *target* footprint; sprites scale this
 *  texture to fit the current cell at render time. */
function drawShape(g: Graphics, motivation: MotivationKey, color: number) {
  const cx = 32;
  const cy = 32;
  const half = 28;
  if (motivation === "material") {
    g.rect(cx - half, cy - half, half * 2, half * 2)
      .fill(color)
      .stroke({ color: 0x141414, width: 2, alpha: 0.6 });
    return;
  }
  if (motivation === "symbolic") {
    g.circle(cx, cy, half)
      .fill(color)
      .stroke({ color: 0x141414, width: 2, alpha: 0.6 });
    return;
  }
  if (motivation === "normative") {
    g.poly([cx, cy - half, cx + half, cy + half, cx - half, cy + half])
      .fill(color)
      .stroke({ color: 0x141414, width: 2, alpha: 0.6 });
    return;
  }
  // power — diamond
  g.poly([cx, cy - half, cx + half, cy, cx, cy + half, cx - half, cy])
    .fill(color)
    .stroke({ color: 0x141414, width: 2, alpha: 0.6 });
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-4">
      <span className="pt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {n}
      </span>
      <div>
        <div className="font-serif text-lg leading-tight text-foreground">
          {title}
        </div>
        <p
          className="mt-1.5 font-sans text-[13px] leading-relaxed text-foreground/75 sm:text-sm"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      </div>
    </li>
  );
}

