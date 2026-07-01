"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type p5 from "p5";

const PALETTES: string[][] = [
  ["#ffd23f", "#fb7c1f", "#f6e3b4"],
  ["#a3e635", "#22d3ee", "#fde047"],
  ["#ff7e5f", "#feb47b", "#56cfe1"],
  ["#fefae0", "#fb7185", "#c084fc"],
  ["#fff0f5", "#ffb3c6", "#fb6f92"],
  ["#caffbf", "#9bf6ff", "#ffd6a5"],
  ["#ff52d9", "#ffd200", "#00f0ff"],
  ["#f3e5c8", "#d77a3a", "#5d7c4b"],
  ["#0077b6", "#90e0ef", "#ffd60a"],
  ["#ff0080", "#ffd60a", "#9b5de5"],

  ["#9acd00", "#52b788", "#1b4332"],
  ["#0a9396", "#94d2bd", "#005f73"],
  ["#52b69a", "#34a0a4", "#168aad"],
  ["#76c893", "#52b788", "#2d6a4f"],
  ["#9acd00", "#bfd200", "#5c7c4f"],
  ["#2d6a4f", "#40916c", "#95d5b2"],
  ["#9acd00", "#264653", "#2a9d8f"],

  ["#9aff52", "#39ff14", "#00ff7f"],
  ["#bfff00", "#9acd00", "#7fff00"],
  ["#00ff85", "#00f5a0", "#52ffa8"],
  ["#a3e635", "#84cc16", "#bef264"],
  ["#7cfc00", "#adff2f", "#00ff00"],
  ["#00ffaa", "#39ff14", "#9aff52"],

  ["#03045e", "#0077b6", "#00b4d8"],
  ["#1d3557", "#457b9d", "#a8dadc"],
  ["#4361ee", "#4895ef", "#4cc9f0"],
  ["#480ca8", "#3a0ca3", "#4361ee"],
  ["#264653", "#2a9d8f", "#8ecae6"],

  ["#00ffff", "#00d4ff", "#00aaff"],
  ["#0080ff", "#00bfff", "#1e90ff"],
  ["#00f0ff", "#00ccff", "#33ddff"],
  ["#1e90ff", "#4169e1", "#6495ed"],
  ["#0099ff", "#00ccff", "#00e6e6"],
  ["#00bfff", "#1e90ff", "#87ceeb"],

  ["#e63946", "#f77f00", "#fcbf49"],
  ["#ff6b35", "#f7931e", "#ffb627"],
  ["#ff8c42", "#ffae42", "#ffe082"],
  ["#bb3e03", "#e85d04", "#faa307"],

  ["#7209b7", "#b5179e", "#f72585"],
  ["#5a189a", "#9d4edd", "#c77dff"],
  ["#3c096c", "#7b2cbf", "#e0aaff"],
  ["#240046", "#9d4edd", "#ff6ec7"],

  ["#ffffff", "#c4c4c4", "#7a7a7a"],
  ["#f5f1e8", "#a8a397", "#5c5749"],
  ["#e0e0e0", "#9aa5b1", "#3e4c59"],
  ["#ffffff", "#888888", "#222222"],

  ["#f7f3ec", "#a89e8a", "#2b2b2b"],
  ["#bcbf8a", "#6b7c4e", "#3a4a2b"],
  ["#e8ecef", "#74879b", "#2c3e50"],
  ["#f1d9b6", "#d29976", "#85583a"],
  ["#cce6cd", "#7fab87", "#2f5d4f"],
  ["#fce8e8", "#e8b1b1", "#a35f5f"],
  ["#cfe0e3", "#5d8a93", "#1f3d44"],
  ["#f1ecdc", "#b07c7c", "#5b1f2a"],
  ["#e6f5ec", "#9dc8b4", "#3d6e60"],
  ["#ecdef0", "#a695c5", "#5b4a82"],
  ["#dde2e6", "#7e8fa1", "#37475c"],
  ["#f3eada", "#c19a55", "#3a3024"],
  ["#f5efe2", "#a9b09b", "#5c6754"],
  ["#dbe0ef", "#7178a8", "#2d3057"],
  ["#fbe9d8", "#e1a994", "#9a5440"],
  ["#e9f1f5", "#9bc1d3", "#39667a"],
  ["#f5e9c7", "#c9a04e", "#4d3617"],
  ["#f2dcce", "#d28e6a", "#7f3a23"],
  ["#e2ebe1", "#92a99a", "#3e5950"],
  ["#ede2eb", "#a877a0", "#4d2a4d"],
];

const PETAL_COUNTS = [12, 16, 18, 20, 24, 28, 32, 36];
const MAX_LAYERS = 6;

const FLOURISHING_MIN = 0;
const FLOURISHING_MAX = 100;
const FLOURISHING_START = 50;
const FLOURISHING_STEP = 8;

export default function MandalaPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [flourishing, setFlourishing] = useState(FLOURISHING_START);
  const flourishingRef = useRef(FLOURISHING_START);

  useEffect(() => {
    flourishingRef.current = flourishing;
  }, [flourishing]);

  useEffect(() => {
    let instance: p5 | null = null;
    let cancelled = false;
    let hovered = false;
    let regenerateFn: (() => void) | null = null;

    const container = containerRef.current;
    const onEnter = () => {
      hovered = true;
    };
    const onLeave = () => {
      hovered = false;
    };
    const onCanvasDown = () => {
      regenerateFn?.();
    };
    container?.addEventListener("mouseenter", onEnter);
    container?.addEventListener("mouseleave", onLeave);
    container?.addEventListener("mousedown", onCanvasDown);

    (async () => {
      const p5Module = (await import("p5")).default;
      if (cancelled || !containerRef.current) return;

      type Layer = {
        radius: number;
        color: string;
      };

      type Params = {
        numPetals: number;
        layers: Layer[];
        baseRadius: number;
        noiseFreq: number;
        noiseAmpFrac: number;
        noiseSeed: number;
        weight: number;
      };

      let params: Params = {
        numPetals: 24,
        layers: [],
        baseRadius: 120,
        noiseFreq: 2,
        noiseAmpFrac: 0.18,
        noiseSeed: 0,
        weight: 1.1,
      };

      let angleOffset = 0;
      let energy = 0;
      let liveT = 0;
      let mind = FLOURISHING_START;

      const sketch = (p: p5) => {
        function pick<T>(arr: readonly T[]): T {
          return arr[Math.floor(p.random(arr.length))];
        }

        function regenerate() {
          const palette = pick(PALETTES);
          const numPetals = pick(PETAL_COUNTS);
          const maxR = Math.min(p.width, p.height) * 0.42;

          const noiseFreq = p.random(1.4, 2.8);
          const noiseAmpFrac = p.random(0.12, 0.22);
          const noiseSeed = p.random(1000);
          const weight = p.random(0.9, 1.4);

          const layers: Layer[] = [];
          for (let i = 0; i < MAX_LAYERS; i++) {
            const t = i / (MAX_LAYERS - 1);
            layers.push({
              radius: maxR * p.lerp(0.35, 1, t),
              color: palette[i % palette.length],
            });
          }

          params = {
            numPetals,
            layers,
            baseRadius: maxR * 0.32,
            noiseFreq,
            noiseAmpFrac,
            noiseSeed,
            weight,
          };
          angleOffset = 0;
        }

        p.setup = () => {
          const w = containerRef.current!.clientWidth;
          const h = containerRef.current!.clientHeight;
          p.createCanvas(w, h);
          p.angleMode(p.RADIANS);
          regenerate();
        };

        p.windowResized = () => {
          if (!containerRef.current) return;
          p.resizeCanvas(
            containerRef.current.clientWidth,
            containerRef.current.clientHeight,
          );
        };

        regenerateFn = regenerate;

        function strokeForLayer(layer: Layer, e: number, alpha: number) {
          p.noFill();
          const c = p.color(layer.color);
          c.setAlpha(alpha);
          p.stroke(c);
          p.strokeWeight(params.weight + e * 0.1);
        }

        function drawOrganicPetal(layer: Layer, t: number, e: number) {
          p.beginShape();
          const steps = 90;
          const ampMul = 1 + e * 0.12;
          const freqMul = 1 + e * 0.05;
          const amp = layer.radius * params.noiseAmpFrac;
          for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            const angle = u * Math.PI;
            const baseR = Math.sin(angle) * layer.radius;
            const noise =
              (p.noise(
                Math.cos(angle) * params.noiseFreq * freqMul +
                  params.noiseSeed +
                  t * 0.4,
                Math.sin(angle) * params.noiseFreq * freqMul + t,
              ) -
                0.5) *
              2 *
              amp *
              ampMul;
            const r = baseR + noise;
            p.vertex(Math.cos(angle) * r, Math.sin(angle) * r);
          }
          p.endShape();
        }

        function drawLayer(layer: Layer, t: number, e: number, alpha: number) {
          strokeForLayer(layer, e, alpha);
          for (let i = 0; i < params.numPetals; i++) {
            p.push();
            p.rotate((p.TWO_PI / params.numPetals) * i);
            drawOrganicPetal(layer, t, e);
            p.pop();
          }
        }

        p.draw = () => {
          p.background(0);

          mind += (flourishingRef.current - mind) * 0.06;
          const m01 = Math.max(0, Math.min(1, mind / FLOURISHING_MAX));
          const mSigned = (mind - FLOURISHING_START) / FLOURISHING_START;

          const target = (hovered ? 1 : 0) + mSigned * 0.4;
          energy += (target - energy) * 0.04;

          liveT += 0.003 + energy * 0.002;

          const breath = 1 + Math.sin(p.frameCount * 0.025) * 0.015;
          const scale = (1 + energy * 0.03) * breath * (0.85 + m01 * 0.25);

          p.translate(p.width / 2, p.height / 2);
          p.scale(scale);

          angleOffset += 0.002 + energy * 0.001;

          const visibleF = 1 + m01 * (MAX_LAYERS - 1);
          const fullLayers = Math.floor(visibleF);
          const partial = visibleF - fullLayers;

          const baseAlpha = 70 + m01 * 185;

          p.rotate(angleOffset);
          for (let li = 0; li < Math.min(MAX_LAYERS, fullLayers + 1); li++) {
            const layer = params.layers[li];
            const layerAlpha =
              li < fullLayers ? baseAlpha : baseAlpha * partial;
            if (layerAlpha < 1) continue;
            drawLayer(layer, liveT, energy, layerAlpha);
          }
        };
      };

      instance = new p5Module(sketch, containerRef.current);
    })();

    return () => {
      cancelled = true;
      container?.removeEventListener("mouseenter", onEnter);
      container?.removeEventListener("mouseleave", onLeave);
      container?.removeEventListener("mousedown", onCanvasDown);
      instance?.remove();
    };
  }, []);

  const onGood = () =>
    setFlourishing((f) => Math.min(FLOURISHING_MAX, f + FLOURISHING_STEP));
  const onBad = () =>
    setFlourishing((f) => Math.max(FLOURISHING_MIN, f - FLOURISHING_STEP));
  const onReset = () => setFlourishing(FLOURISHING_START);

  const pct = Math.round(flourishing);

  return (
    <div className="flex h-svh flex-col bg-black text-white">
      <div className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">
          Mandala · click canvas to remix
        </span>

        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em]">
          <button
            type="button"
            onClick={onBad}
            disabled={flourishing === FLOURISHING_MIN}
            className="cursor-pointer rounded border border-white/10 px-3 py-1 text-white/70 transition-colors hover:border-rose-400/60 hover:bg-rose-500/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:bg-transparent disabled:hover:text-white/70"
            aria-label="Bad thought — mandala shrinks"
          >
            Bad
          </button>
          <div className="flex items-baseline gap-1 px-2 text-white/60">
            <span className="text-white/40">mind</span>
            <span className="w-10 text-center tabular-nums text-white">
              {pct}
            </span>
            <span className="text-white/30">%</span>
          </div>
          <button
            type="button"
            onClick={onGood}
            disabled={flourishing === FLOURISHING_MAX}
            className="cursor-pointer rounded border border-white/10 px-3 py-1 text-white/70 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/10 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:bg-transparent disabled:hover:text-white/70"
            aria-label="Good thought — mandala flourishes"
          >
            Good
          </button>
          <button
            type="button"
            onClick={onReset}
            className="ml-2 cursor-pointer text-white/40 transition-colors hover:text-white/70"
            aria-label="Reset to neutral"
          >
            reset
          </button>
        </div>

        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/60 transition-colors hover:text-white"
        >
          ← back
        </Link>
      </div>
      <div
        ref={containerRef}
        className="flex-1 cursor-pointer overflow-hidden"
      />
    </div>
  );
}
