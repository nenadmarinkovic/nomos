"use client";

import { ShapesIcon } from "@phosphor-icons/react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

// Short "what drives this agent" gloss for each motivation. Mirrors the hints
// shown on the setup screen (lib/config.ts) so the vocabulary stays consistent.
const MOTIVATION_HINT: Record<string, string> = {
  material: "Resources and labour come first — survive, harvest, get rich.",
  symbolic: "Status, taste, and distinction drive choices.",
  normative: "Belonging and ritual conformity guide action.",
  power: "Authority and control over others — the drive to lead and be obeyed.",
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
    <Dialog>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Legend
        </span>
        <DialogTrigger className="flex h-7 cursor-pointer select-none items-center gap-1.5 rounded-md border border-foreground/15 bg-card px-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.06] hover:text-foreground">
          <ShapesIcon size={11} weight="bold" />
          Open
        </DialogTrigger>
      </div>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reading the canvas</DialogTitle>
          <DialogDescription>
            What every shape, shade, and colour on the world map stands for.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <section>
            <h3 className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Motivations
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Every agent is drawn as a shape marking what it is chasing. Shape
              and colour go together — one for each drive.
            </p>
            <ul className="space-y-3">
              {keys.map((k) => (
                <li key={k} className="flex items-start gap-3">
                  <span className="mt-px flex size-5 shrink-0 items-center justify-center">
                    <LegendShape motivation={k} mono={monochrome} size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {MOTIVATION_LABEL[k] ?? k}
                    </div>
                    <div className="text-sm leading-relaxed text-muted-foreground">
                      {MOTIVATION_HINT[k] ?? ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Wealth
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Opacity tracks how rich an agent is. The wealthiest render solid;
              the poorest fade to almost nothing.
            </p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-px">
                {[0.35, 0.55, 0.8, 1].map((alpha) => (
                  <span
                    key={alpha}
                    aria-hidden
                    style={{ background: `rgba(160, 160, 160, ${alpha})` }}
                    className="block h-4 w-6"
                  />
                ))}
              </span>
              <span className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span>poor</span>
                <span aria-hidden>→</span>
                <span>rich</span>
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Resources
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Two goods grow on the land. Agents harvest, consume, and trade
              them — scarcity is what sets prices in motion.
            </p>
            <ul className="space-y-2.5">
              <li className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 block size-3.5 shrink-0 rounded-sm"
                  style={{ background: `rgba(${sugarRgb}, 0.9)` }}
                />
                <p className="text-sm leading-relaxed text-foreground">
                  <span className="font-medium">Sugar</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — the staple every agent burns each turn to stay alive.
                  </span>
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 block size-3.5 shrink-0 rounded-sm"
                  style={{ background: `rgba(${spiceRgb}, 0.9)` }}
                />
                <p className="text-sm leading-relaxed text-foreground">
                  <span className="font-medium">Spice</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — a second good; uneven supply gives agents a reason to
                    trade rather than just hoard.
                  </span>
                </p>
              </li>
            </ul>
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function LegendShape({
  motivation,
  mono,
  size = 14,
}: {
  motivation: string;
  mono: boolean;
  size?: number;
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
      width={size}
      height={size}
      viewBox="0 0 14 14"
      aria-hidden
      className={mono ? "text-foreground" : undefined}
      style={{ opacity }}
    >
      {shape}
    </svg>
  );
}
