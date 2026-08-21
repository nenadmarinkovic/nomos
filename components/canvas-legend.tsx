"use client";

import { ArrowRightIcon, ShapesIcon } from "@phosphor-icons/react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SidebarRow } from "@/components/sidebar-section";
import { useSimulationStore } from "@/lib/store";

const MOTIVATION_COLOR: Record<string, string> = {
  material: "#0076E7",
  symbolic: "#E93013",
  normative: "#F29320",
  power: "#249375",
};

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

const MOTIVATION_HINT: Record<string, string> = {
  material: "Wants food and wealth. Harvests, hoards, gets rich.",
  symbolic: "Wants status. Moves toward whoever is doing well.",
  normative: "Wants to fit in. Stays close to the group.",
  power: "Wants control. Looks for weaker neighbours to push around.",
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
      <SidebarRow label="Legend">
        <DialogTrigger className="flex cursor-pointer select-none items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-xs uppercase tracking-[0.14em] text-foreground/55 outline-none transition-colors hover:bg-foreground/6 hover:text-foreground data-[state=open]:bg-foreground/6 data-[state=open]:text-foreground">
          <ShapesIcon size={11} weight="bold" />
          Open
        </DialogTrigger>
      </SidebarRow>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What you are looking at</DialogTitle>
          <DialogDescription>
            What the shapes, shades and colours on the map mean.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          <section>
            <h3 className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Motivations
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Each agent is drawn as a shape showing what it wants. Each shape
              has its own colour.
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
              The richer an agent is, the more solid it looks. The poorest ones
              are almost invisible.
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
                <ArrowRightIcon
                  size={10}
                  weight="bold"
                  className="self-center"
                  aria-hidden
                />
                <span>rich</span>
              </span>
            </div>
          </section>

          <section>
            <h3 className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Resources
            </h3>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Two things grow on the land. Agents pick them up, eat them and
              trade them with each other.
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
                    is the food everyone burns through every turn just to stay
                    alive.
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
                    is the second good. Because it grows in different places,
                    agents have a reason to trade instead of just hoarding.
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
  const opacity = mono ? (MOTIVATION_MONO_OPACITY[motivation] ?? 0.8) : 1;

  const shape =
    motivation === "symbolic" ? (
      <circle cx="7" cy="7" r="5.5" fill={color} />
    ) : motivation === "normative" ? (
      <polygon points="7,1.5 12.5,12 1.5,12" fill={color} />
    ) : motivation === "power" ? (
      <polygon points="7,1.5 12.5,7 7,12.5 1.5,7" fill={color} />
    ) : (
      <rect x="1.5" y="1.5" width="11" height="11" fill={color} />
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
