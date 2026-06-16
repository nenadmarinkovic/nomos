"use client";

import { useEffect, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  EyeIcon,
  GlobeIcon,
  InfoIcon,
  PlayIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";

import {
  Dialog,
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
import { cn } from "@/lib/utils";
import {
  AgentSophistication,
  DEFAULT_CONFIG,
  Equality,
  EQUALITY_INFO,
  InteractionTopology,
  Landscape,
  LANDSCAPE_INFO,
  OBSERVER_INFO,
  ObserverKey,
  REPRODUCTION_HINT,
  SCALE_INFO,
  Scale,
  SimulationConfig,
  SOPHISTICATION_INFO,
  TOPOLOGY_INFO,
} from "@/lib/config";

interface InitialConditionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: SimulationConfig;
  onRun: (config: SimulationConfig) => void;
}

type StepKey = "world" | "agents" | "observers";

const STEPS: {
  key: StepKey;
  label: string;
  description: string;
  icon: typeof GlobeIcon;
}[] = [
  {
    key: "world",
    label: "World",
    description: "Population, environment, demography.",
    icon: GlobeIcon,
  },
  {
    key: "agents",
    label: "Agents",
    description: "Motivation and interaction.",
    icon: UsersThreeIcon,
  },
  {
    key: "observers",
    label: "Observers",
    description: "AI theorists watching what emerges.",
    icon: EyeIcon,
  },
];

export function InitialConditionsDialog({
  open,
  onOpenChange,
  config,
  onRun,
}: InitialConditionsDialogProps) {
  const [draft, setDraft] = useState<SimulationConfig>(config);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setDraft(config);
    setStep(0);
    setMaxReached(0);
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

  function goToStep(i: number) {
    if (i !== step && i <= maxReached) setStep(i);
  }

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:h-[min(98vh,52rem)] sm:w-[min(96vw,56rem)] sm:max-w-[56rem]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl italic">
            Initial conditions
          </DialogTitle>
          <DialogDescription>
            Set what kind of world this society starts in, then run the
            simulation.
          </DialogDescription>
        </DialogHeader>

        <Stepper step={step} maxReached={maxReached} onSelect={goToStep} />

        <DialogBody>
          <div className="mb-5 flex items-center gap-2">
            <current.icon
              size={14}
              weight="regular"
              className="shrink-0 text-foreground/60"
            />
            <h3 className="font-serif text-base italic leading-none text-foreground">
              {current.label}
            </h3>
            <span className="text-[11px] leading-snug text-muted-foreground">
              · {current.description}
            </span>
            {current.key === "observers" && (
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {draft.observers.length} selected
              </span>
            )}
          </div>

          {current.key === "world" && (
            <div className="space-y-5">
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
                <StepSlider
                  value={draft.equality}
                  onChange={(v) => setDraft((d) => ({ ...d, equality: v }))}
                  options={(Object.keys(EQUALITY_INFO) as Equality[]).map(
                    (e) => ({
                      value: e,
                      label: EQUALITY_INFO[e].label,
                      hint: EQUALITY_INFO[e].hint,
                    }),
                  )}
                />
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto]">
                <Field
                  label="Resource landscape"
                  hint="The spatial layout of resources — shapes where agents settle and where conflict concentrates."
                >
                  <div className="grid grid-cols-2 gap-2">
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
                  <div className="grid grid-cols-2 gap-2 sm:w-[16rem]">
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
            </div>
          )}

          {current.key === "agents" && (
            <div className="space-y-8">
              <Field
                label="Sophistication"
                hint="How agents make decisions — from blind reactions to social mimicry."
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                label="Interaction topology"
                hint="Who can talk to whom — the structure of the social graph."
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(Object.keys(TOPOLOGY_INFO) as InteractionTopology[]).map(
                    (t) => {
                      const info = TOPOLOGY_INFO[t];
                      return (
                        <ChoiceCard
                          key={t}
                          active={draft.topology === t}
                          onClick={() =>
                            setDraft((d) => ({ ...d, topology: t }))
                          }
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                        ? "border-foreground/30 bg-foreground/[0.04]"
                        : "border-foreground/10 bg-card hover:border-foreground/20 hover:bg-foreground/[0.025]",
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
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          {isLast ? (
            <Button
              size="sm"
              onClick={() => {
                onRun(draft);
                onOpenChange(false);
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
                setStep(next);
                setMaxReached((m) => Math.max(m, next));
              }}
            >
              Next
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({
  step,
  maxReached,
  onSelect,
}: {
  step: number;
  maxReached: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="shrink-0 px-5 pb-1 pt-5 sm:px-6 sm:pb-2 sm:pt-6">
      <div className="relative">
        <div
          className="absolute h-px bg-foreground/10"
          style={{ top: 18, left: "16.6667%", right: "16.6667%" }}
        />
        <div
          className="absolute h-[2px] bg-foreground"
          style={{
            top: 17.5,
            left: "16.6667%",
            width: `${(step / (STEPS.length - 1)) * 66.6667}%`,
            transition: "width 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
        <div className="grid grid-cols-3">
          {STEPS.map((s, i) => {
            const isCurrent = i === step;
            const isComplete = i < step;
            const isReachable = i <= maxReached;
            const isFuture = !isReachable && !isCurrent;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onSelect(i)}
                className={cn(
                  "group flex flex-col items-center border-0 bg-transparent p-0 text-center",
                  isCurrent
                    ? "cursor-default"
                    : isReachable
                      ? "cursor-pointer"
                      : "cursor-default",
                )}
              >
                <div
                  className={cn(
                    "mb-3 transition-transform duration-300 ease-out",
                    isReachable && !isCurrent && "group-hover:scale-110",
                  )}
                >
                  <div
                    className={cn(
                      "relative z-10 flex size-9 items-center justify-center rounded-full border-2 bg-card ring-offset-0 transition-[border-color,background-color,color,transform,box-shadow] duration-400",
                      (isCurrent || isComplete) &&
                        "border-foreground bg-foreground",
                      !isCurrent && !isComplete && "border-foreground/15",
                      isCurrent && "ring-4 ring-foreground/10",
                    )}
                    style={{
                      transitionTimingFunction:
                        "cubic-bezier(0.34, 1.56, 0.64, 1)",
                      transform: isFuture ? "scale(0.85)" : "scale(1)",
                    }}
                  >
                    {isComplete ? (
                      <CheckIcon
                        size={13}
                        weight="bold"
                        className="text-background"
                      />
                    ) : (
                      <span
                        className={cn(
                          "font-mono text-[11px] font-medium tabular-nums",
                          isCurrent
                            ? "text-background"
                            : "text-muted-foreground",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    "font-serif text-sm italic leading-none",
                    isCurrent || isComplete
                      ? "text-foreground"
                      : isReachable
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50",
                  )}
                >
                  {s.label}
                </div>
                <div
                  className={cn(
                    "mt-1 hidden max-w-[180px] text-[11px] leading-snug sm:block",
                    isCurrent
                      ? "text-muted-foreground"
                      : isComplete
                        ? "text-muted-foreground/70"
                        : "text-muted-foreground/40",
                  )}
                >
                  {s.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
        "group relative flex cursor-pointer flex-col gap-1 rounded-md border text-left transition-colors",
        compact ? "px-3 py-2" : "gap-1.5 px-3.5 py-3",
        active
          ? "border-foreground/30 bg-foreground/[0.04]"
          : "border-foreground/10 bg-card hover:border-foreground/20 hover:bg-foreground/[0.025]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-medium leading-tight",
            compact ? "text-[13px]" : "text-sm",
          )}
        >
          {label}
        </span>
        <div className="flex items-center gap-2">
          {meta && (
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {meta}
            </span>
          )}
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
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
          compact ? "text-[10.5px]" : "text-[11px]",
        )}
      >
        {hint}
      </p>
    </button>
  );
}

function StepSlider<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint: string }[];
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[index];

  return (
    <div className="space-y-3 rounded-md border border-foreground/10 bg-card px-4 pb-3 pt-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{current.label}</span>
        <span className="text-[11px] leading-snug text-muted-foreground">
          {current.hint}
        </span>
      </div>
      <Slider
        value={[index]}
        min={0}
        max={options.length - 1}
        step={1}
        onValueChange={(v) => {
          const idx = Array.isArray(v) ? v[0] : v;
          onChange(options[idx as number].value);
        }}
      />
      <div className="flex justify-between gap-2 text-[10px] uppercase tracking-[0.12em]">
        {options.map((o, i) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "cursor-pointer transition-colors",
              i === index
                ? "text-foreground"
                : "text-muted-foreground/60 hover:text-foreground/80",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
