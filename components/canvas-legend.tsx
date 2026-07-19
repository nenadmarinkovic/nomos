"use client";

import { useSimulationStore } from "@/lib/store";

const MOTIVATION_COLOR: Record<string, string> = {
  material: "#E63946",
  symbolic: "#2E5C9E",
  normative: "#FFD23F",
  power: "#2A9D5C",
};

// Black & white mode: shapes use the foreground colour (theme-aware, so they
// stay high-contrast in both themes) stepped by opacity to keep the four
// motivations distinguishable. Ordering matches the mono palette in
// simulation-canvas.tsx.
const MOTIVATION_MONO_OPACITY: Record<string, number> = {
  normative: 1,
  material: 0.82,
  power: 0.64,
  symbolic: 0.48,
};

const MOTIVATION_LABEL: Record<string, string> = {
  material: "Material",
  symbolic: "Symbolic",
  normative: "Normative",
  power: "Power",
};

export function CanvasLegend() {
  const started = useSimulationStore((s) => s.started);
  const monochrome = useSimulationStore((s) => s.monochrome);
  const motivation = useSimulationStore((s) => s.config.agents.motivation);

  if (!started) return null;

  const keys = Object.keys(motivation).filter(
    (k) => (motivation as Record<string, number | undefined>)[k] !== undefined,
  );
  const sugarRgb = monochrome ? "158, 158, 158" : "120, 200, 130";
  const spiceRgb = monochrome ? "96, 96, 96" : "214, 158, 90";

  return (
    <div className="space-y-2.5 px-3 py-3">
      <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
        Key
      </div>

      <div className="flex flex-col gap-1.5">
        {keys.map((k) => (
          <div key={k} className="flex items-center gap-2">
            <LegendShape motivation={k} mono={monochrome} />
            <span className="font-sans text-xs text-foreground/85">
              {MOTIVATION_LABEL[k] ?? k}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-foreground/10 pt-2">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Wealth
        </span>
        <span className="flex items-center gap-px">
          {[0.35, 0.55, 0.8, 1].map((alpha) => (
            <span
              key={alpha}
              aria-hidden
              style={{ background: `rgba(160, 160, 160, ${alpha})` }}
              className="block h-2.5 w-3"
            />
          ))}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Sugar
        </span>
        <span
          aria-hidden
          className="block h-2.5 w-2.5"
          style={{ background: `rgba(${sugarRgb}, 0.85)` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Spice
        </span>
        <span
          aria-hidden
          className="block h-2.5 w-2.5"
          style={{ background: `rgba(${spiceRgb}, 0.85)` }}
        />
      </div>
    </div>
  );
}

function LegendShape({
  motivation,
  mono,
}: {
  motivation: string;
  mono: boolean;
}) {
  const color = mono
    ? "currentColor"
    : (MOTIVATION_COLOR[motivation] ?? MOTIVATION_COLOR.material);
  const stroke = mono ? "currentColor" : "rgba(20,20,20,0.7)";
  const sw = 0.9;
  const opacity = mono ? (MOTIVATION_MONO_OPACITY[motivation] ?? 0.8) : 1;

  const shape =
    motivation === "symbolic" ? (
      <circle cx="7" cy="7" r="5.5" fill={color} stroke={stroke} strokeWidth={sw} />
    ) : motivation === "normative" ? (
      <polygon
        points="7,1.5 12.5,12 1.5,12"
        fill={color}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="miter"
      />
    ) : motivation === "power" ? (
      <polygon
        points="7,1.5 12.5,7 7,12.5 1.5,7"
        fill={color}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="miter"
      />
    ) : (
      <rect x="1.5" y="1.5" width="11" height="11" fill={color} stroke={stroke} strokeWidth={sw} />
    );

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden
      className={mono ? "text-foreground" : undefined}
      style={{ opacity }}
    >
      {shape}
    </svg>
  );
}
