"use client";

import { useSimulationStore } from "@/lib/store";

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

export function CanvasLegend() {
  const started = useSimulationStore((s) => s.started);
  const motivation = useSimulationStore((s) => s.config.agents.motivation);

  if (!started) return null;

  const keys = Object.keys(motivation).filter(
    (k) => (motivation as Record<string, number | undefined>)[k] !== undefined,
  );

  return (
    <div className="space-y-2.5 px-3 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Key
      </div>

      <div className="flex flex-col gap-1.5">
        {keys.map((k) => (
          <div key={k} className="flex items-center gap-2">
            <LegendShape motivation={k} />
            <span className="font-sans text-[12px] text-foreground/85">
              {MOTIVATION_LABEL[k] ?? k}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-foreground/10 pt-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
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
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          Sugar
        </span>
        <span
          aria-hidden
          className="block h-2.5 w-2.5"
          style={{ background: "rgba(120, 200, 130, 0.85)" }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          Spice
        </span>
        <span
          aria-hidden
          className="block h-2.5 w-2.5"
          style={{ background: "rgba(214, 158, 90, 0.85)" }}
        />
      </div>
    </div>
  );
}

function LegendShape({ motivation }: { motivation: string }) {
  const color = MOTIVATION_COLOR[motivation] ?? "#E63946";
  const isPower = motivation === "power";
  const stroke = isPower ? "rgba(240,240,240,0.9)" : "rgba(20,20,20,0.7)";
  const sw = 0.9;

  if (motivation === "symbolic") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="5.5" fill={color} stroke={stroke} strokeWidth={sw} />
      </svg>
    );
  }
  if (motivation === "normative") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <polygon
          points="7,1.5 12.5,12 1.5,12"
          fill={color}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="miter"
        />
      </svg>
    );
  }
  if (motivation === "power") {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <polygon
          points="7,1.5 12.5,7 7,12.5 1.5,7"
          fill={color}
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin="miter"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect
        x="1.5"
        y="1.5"
        width="11"
        height="11"
        fill={color}
        stroke={stroke}
        strokeWidth={sw}
      />
    </svg>
  );
}
