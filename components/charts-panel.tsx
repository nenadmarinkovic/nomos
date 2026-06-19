"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { useSimulationStore } from "@/lib/store";
import { WEALTH_BIN_LABELS } from "@/lib/engine";

export function ChartsPanel() {
  const started = useSimulationStore((s) => s.started);
  const history = useSimulationStore((s) => s.history);
  const snapshot = useSimulationStore((s) => s.snapshot);

  if (!started) return null;

  return (
    <aside className="hidden shrink-0 border-t border-foreground/10 bg-card/40 md:block">
      <div className="grid grid-cols-3 divide-x divide-foreground/10">
        <ChartBlock
          label="Gini"
          value={snapshot.gini.toFixed(3)}
          hint="Wealth concentration"
          data={history.map((p) => p.gini)}
          domain={[0, 1]}
          color="#f4a85a"
        />
        <ChartBlock
          label="Alive"
          value={snapshot.alive.toLocaleString()}
          hint="Population over time"
          data={history.map((p) => p.alive)}
          color="#9ad0a4"
        />
        <HistogramBlock bins={snapshot.wealthBins} />
      </div>
    </aside>
  );
}

function HistogramBlock({ bins }: { bins: number[] }) {
  const total = bins.reduce((s, v) => s + v, 0);
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Wealth
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {total.toLocaleString()} alive
        </span>
      </div>
      <Histogram bins={bins} />
      <span className="font-sans text-[11px] text-muted-foreground">
        Distribution by tier
      </span>
    </div>
  );
}

function Histogram({ bins }: { bins: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      draw();
    }

    function draw() {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const padX = 4;
      const padTop = 4;
      const padBot = 14;
      const usableW = W - padX * 2;
      const usableH = H - padTop - padBot;
      const max = Math.max(1, ...bins);
      const n = bins.length;
      const gap = 2;
      const barW = (usableW - gap * (n - 1)) / n;

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(padX, H - padBot, usableW, 1);

      for (let i = 0; i < n; i++) {
        const v = bins[i];
        const h = (v / max) * usableH;
        const x = padX + i * (barW + gap);
        const y = H - padBot - h;
        const hue = 18 + (i / Math.max(1, n - 1)) * 38;
        ctx.fillStyle = `hsla(${hue}, 70%, 60%, 0.9)`;
        ctx.fillRect(x, y, barW, Math.max(1, h));
      }

      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `${9 * dpr}px ui-monospace, SFMono-Regular, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i < n; i++) {
        const label = WEALTH_BIN_LABELS[i] ?? "";
        const x = padX + i * (barW + gap) + barW / 2;
        ctx.fillText(label, x, H - padBot + 2);
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [bins]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("h-20 w-full rounded-sm bg-foreground/[0.02]")}
      style={{ width: "100%", height: 80 }}
    />
  );
}

function ChartBlock({
  label,
  value,
  hint,
  data,
  color,
  domain,
}: {
  label: string;
  value: string;
  hint: string;
  data: number[];
  color: string;
  domain?: [number, number];
}) {
  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-[13px] tabular-nums text-foreground">
          {value}
        </span>
      </div>
      <MiniChart data={data} color={color} domain={domain} />
      <span className="font-sans text-[11px] text-muted-foreground">
        {hint}
      </span>
    </div>
  );
}

function MiniChart({
  data,
  color,
  domain,
}: {
  data: number[];
  color: string;
  domain?: [number, number];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const widthRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      widthRef.current = rect.width;
      draw();
    }

    function draw() {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (data.length < 2) {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(0, H - 1, W, 1);
        return;
      }

      const padX = 2;
      const padY = 4;
      const usableW = W - padX * 2;
      const usableH = H - padY * 2;

      let lo: number;
      let hi: number;
      if (domain) {
        lo = domain[0];
        hi = domain[1];
      } else {
        lo = Infinity;
        hi = -Infinity;
        for (const v of data) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        if (lo === hi) {
          lo -= 1;
          hi += 1;
        }
      }
      const range = hi - lo || 1;

      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, H - padY);
      ctx.lineTo(W - padX, H - padY);
      ctx.stroke();

      const stepX = data.length > 1 ? usableW / (data.length - 1) : usableW;

      const gradient = ctx.createLinearGradient(0, padY, 0, H - padY);
      gradient.addColorStop(0, hexToRgba(color, 0.32));
      gradient.addColorStop(1, hexToRgba(color, 0.02));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(padX, H - padY);
      for (let i = 0; i < data.length; i++) {
        const x = padX + i * stepX;
        const v = (data[i] - lo) / range;
        const y = H - padY - v * usableH;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(padX + (data.length - 1) * stepX, H - padY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.2, 1.4 * (window.devicePixelRatio || 1));
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = padX + i * stepX;
        const v = (data[i] - lo) / range;
        const y = H - padY - v * usableH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [data, color, domain]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "h-16 w-full rounded-sm bg-foreground/[0.02]",
      )}
      style={{ width: "100%", height: 64 }}
    />
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
