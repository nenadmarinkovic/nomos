"use client";

import { useEffect, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  InfoIcon,
  PlayIcon,
} from "@phosphor-icons/react";

import {
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Step } from "@/components/stepper";
import { cn } from "@/lib/utils";
import {
  AgentMotivation,
  AgentSophistication,
  DEFAULT_CONFIG,
  equalityBucket,
  InteractionTopology,
  Landscape,
  LANDSCAPE_INFO,
  MOTIVATION_INFO,
  OBSERVER_INFO,
  ObserverKey,
  REPRODUCTION_HINT,
  SCALE_INFO,
  Scale,
  SimulationConfig,
  SOPHISTICATION_INFO,
  TOPOLOGY_INFO,
} from "@/lib/config";

export type StepKey = "world" | "agents" | "observers";

export const STEPS: readonly (Step & { key: StepKey })[] = [
  {
    key: "world",
    label: "World",
    description: "Population, environment, demography.",
  },
  {
    key: "agents",
    label: "Agents",
    description: "Motivation and interaction.",
  },
  {
    key: "observers",
    label: "Observers",
    description: "AI theorists watching what emerges.",
  },
];

interface InitialConditionsDialogProps {
  open: boolean;
  onClose: () => void;
  config: SimulationConfig;
  onRun: (config: SimulationConfig) => void;
  step: number;
  maxReached: number;
  onStepChange: (step: number) => void;
  onMaxReachedChange: (max: number) => void;
}

export function InitialConditionsDialog({
  open,
  onClose,
  config,
  onRun,
  step,
  maxReached,
  onStepChange,
  onMaxReachedChange,
}: InitialConditionsDialogProps) {
  const [draft, setDraft] = useState<SimulationConfig>(config);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setDraft(config);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, config]);

  function toggleObserver(key: ObserverKey) {
    setDraft((d) => ({
      ...d,
      observers: d.observers.includes(key)
        ? d.observers.filter((k) => k !== key)
        : [...d.observers, key],
    }));
  }

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <DialogContent
      className="top-[calc(50%+3rem)] max-h-[calc(100vh-9rem)] sm:max-h-[calc(100vh-11rem)] sm:w-[min(96vw,56rem)] sm:max-w-[56rem]"
      onPointerDownOutside={(e) => {
        if ((e.target as Element | null)?.closest("[data-stepper-portal]")) {
          e.preventDefault();
        }
      }}
      onInteractOutside={(e) => {
        if ((e.target as Element | null)?.closest("[data-stepper-portal]")) {
          e.preventDefault();
        }
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-medium tracking-tight">
          Initial conditions
        </DialogTitle>
        <DialogDescription>
          Set what kind of world this society starts in, then run the
          simulation.
        </DialogDescription>
      </DialogHeader>

      <DialogBody>
        {current.key === "world" && (
          <div className="space-y-7">
            <Field
              label="Scale"
              hint="How many agents the society starts with. Larger scales surface emergent dynamics but take longer to compute."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(Object.keys(SCALE_INFO) as Scale[]).map((s) => {
                  const info = SCALE_INFO[s];
                  return (
                    <ChoiceCard
                      key={s}
                      active={draft.scale === s}
                      onClick={() => setDraft((d) => ({ ...d, scale: s }))}
                      label={info.label}
                      hint={info.hint}
                      meta={info.agents.toLocaleString()}
                    />
                  );
                })}
              </div>
            </Field>

            <Field
              label="Starting equality"
              hint="The initial distribution of wealth and capital across agents."
            >
              <EqualitySlider
                value={draft.equality}
                onChange={(v) => setDraft((d) => ({ ...d, equality: v }))}
              />
            </Field>

            <Field
              label="Resource landscape"
              hint="The spatial layout of resources — shapes where agents settle and where conflict concentrates."
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(LANDSCAPE_INFO) as Landscape[]).map((l) => {
                  const info = LANDSCAPE_INFO[l];
                  return (
                    <ChoiceCard
                      key={l}
                      active={draft.landscape === l}
                      onClick={() =>
                        setDraft((d) => ({ ...d, landscape: l }))
                      }
                      label={info.label}
                      hint={info.hint}
                      compact
                    />
                  );
                })}
              </div>
            </Field>

            <Field label="Reproduction" hint={REPRODUCTION_HINT}>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceCard
                  active={!draft.reproduction}
                  onClick={() =>
                    setDraft((d) => ({ ...d, reproduction: false }))
                  }
                  label="Off"
                  hint="Single-generation lives."
                  compact
                />
                <ChoiceCard
                  active={draft.reproduction}
                  onClick={() =>
                    setDraft((d) => ({ ...d, reproduction: true }))
                  }
                  label="On"
                  hint="Traits pass down."
                  compact
                />
              </div>
            </Field>
          </div>
        )}

        {current.key === "agents" && (
          <div className="space-y-7">
            <Field
              label="Sophistication"
              hint="How agents make decisions — from blind reactions to social mimicry."
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  Object.keys(SOPHISTICATION_INFO) as AgentSophistication[]
                ).map((s) => {
                  const info = SOPHISTICATION_INFO[s];
                  return (
                    <ChoiceCard
                      key={s}
                      active={draft.sophistication === s}
                      onClick={() =>
                        setDraft((d) => ({ ...d, sophistication: s }))
                      }
                      label={info.label}
                      hint={info.hint}
                    />
                  );
                })}
              </div>
            </Field>

            <Field
              label="Motivation"
              hint="What agents try to maximize — the drive behind every choice."
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(MOTIVATION_INFO) as AgentMotivation[]).map((m) => {
                  const info = MOTIVATION_INFO[m];
                  return (
                    <ChoiceCard
                      key={m}
                      active={draft.motivation === m}
                      onClick={() =>
                        setDraft((d) => ({ ...d, motivation: m }))
                      }
                      label={info.label}
                      hint={info.hint}
                    />
                  );
                })}
              </div>
            </Field>

            <Field
              label="Interaction topology"
              hint="Who can talk to whom — the structure of the social graph."
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(TOPOLOGY_INFO) as InteractionTopology[]).map(
                  (t) => {
                    const info = TOPOLOGY_INFO[t];
                    return (
                      <ChoiceCard
                        key={t}
                        active={draft.topology === t}
                        onClick={() => setDraft((d) => ({ ...d, topology: t }))}
                        label={info.label}
                        hint={info.hint}
                      />
                    );
                  },
                )}
              </div>
            </Field>
          </div>
        )}

        {current.key === "observers" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {draft.observers.length} selected
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(OBSERVER_INFO) as ObserverKey[]).map((key) => {
                const info = OBSERVER_INFO[key];
                const active = draft.observers.includes(key);
                const card = (
                  <button
                    type="button"
                    onClick={() => toggleObserver(key)}
                    aria-pressed={active}
                    aria-label={info.label}
                    className={cn(
                      "group flex h-full cursor-pointer flex-col gap-1.5 rounded-md border px-3.5 py-3 text-left transition-colors",
                      active
                        ? "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60"
                        : "border-foreground/10 bg-card hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium leading-tight">
                          {info.name}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {info.era}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-foreground/15 bg-card",
                        )}
                      >
                        {active && <CheckIcon size={9} weight="bold" />}
                      </span>
                    </div>
                    <p className="font-serif text-[11px] italic leading-snug text-foreground/70">
                      {info.lens}
                    </p>
                  </button>
                );
                return (
                  <Tooltip key={key}>
                    <TooltipTrigger render={card} />
                    <TooltipContent
                      side="top"
                      sideOffset={6}
                      className="max-w-sm flex-col items-start gap-2 px-3.5 py-3 text-left"
                    >
                      <div className="space-y-1.5 text-[11px] leading-snug text-muted-foreground">
                        <p>
                          <span className="font-medium text-foreground/80">
                            Sees:
                          </span>{" "}
                          {info.sees}
                        </p>
                        <p>
                          <span className="font-medium text-foreground/80">
                            Watches:
                          </span>{" "}
                          {info.watches}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDraft(DEFAULT_CONFIG)}
        >
          <ArrowCounterClockwiseIcon weight="regular" />
          Reset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onStepChange(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          Back
        </Button>
        {isLast ? (
          <Button
            size="sm"
            onClick={() => {
              onRun(draft);
              onClose();
            }}
          >
            <PlayIcon weight="fill" />
            Run
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              const next = Math.min(STEPS.length - 1, step + 1);
              onStepChange(next);
              if (next > maxReached) onMaxReachedChange(next);
            }}
          >
            Next
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </Label>
        {hint && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`About ${label}`}
                  className="flex size-4 cursor-help items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:text-foreground"
                >
                  <InfoIcon size={12} weight="regular" />
                </button>
              }
            />
            <TooltipContent side="top" sideOffset={6} className="max-w-sm">
              {hint}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  label,
  hint,
  meta,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  meta?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col gap-1.5 rounded-md border text-left transition-colors",
        compact ? "px-3 py-2.5" : "px-3.5 py-3",
        active
          ? "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60"
          : "border-foreground/10 bg-card hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "truncate font-medium leading-tight",
            compact ? "text-[13px]" : "text-sm",
            active ? "text-foreground" : "text-foreground/90",
          )}
        >
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {meta && (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {meta}
            </span>
          )}
          <span
            className={cn(
              "flex size-4 items-center justify-center rounded-full border transition-colors",
              active
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/15 bg-card",
            )}
          >
            {active && <CheckIcon size={9} weight="bold" />}
          </span>
        </div>
      </div>
      <p
        className={cn(
          "leading-snug text-muted-foreground",
          compact ? "text-[11px]" : "text-[12px]",
        )}
      >
        {hint}
      </p>
    </button>
  );
}

function EqualitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(value * 100);
  const bucket = equalityBucket(value);

  return (
    <div className="space-y-3 pt-1">
      <Slider
        value={[pct]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => {
          const next = Array.isArray(v) ? v[0] : v;
          onChange((next as number) / 100);
        }}
      />
      <div className="flex justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
        <span>Equal</span>
        <span>Extreme</span>
      </div>
      <div className="flex items-baseline justify-between gap-3 pt-1">
        <div>
          <span className="text-sm font-medium text-foreground">
            {bucket.label}
          </span>
          <span className="ml-2 font-mono text-[11px] tabular-nums text-muted-foreground">
            {pct}%
          </span>
        </div>
        <p className="max-w-[28rem] text-right text-[11px] leading-snug text-muted-foreground">
          {bucket.hint}
        </p>
      </div>
    </div>
  );
}
