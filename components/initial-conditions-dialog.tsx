"use client";

import { useEffect, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  EyeIcon,
  GlobeIcon,
  InfoIcon,
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
import { Switch } from "@/components/ui/switch";
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
  onApply: (config: SimulationConfig) => void;
}

export function InitialConditionsDialog({
  open,
  onOpenChange,
  config,
  onApply,
}: InitialConditionsDialogProps) {
  const [draft, setDraft] = useState<SimulationConfig>(config);

  // Re-sync draft when dialog opens so it reflects committed config.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setDraft(config);
  }, [open, config]);

  function toggleObserver(key: ObserverKey) {
    setDraft((d) => ({
      ...d,
      observers: d.observers.includes(key)
        ? d.observers.filter((k) => k !== key)
        : [...d.observers, key],
    }));
  }

  const changed = JSON.stringify(draft) !== JSON.stringify(config);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[min(96vw,72rem)] sm:max-w-[72rem]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl italic">
            Initial conditions
          </DialogTitle>
          <DialogDescription>
            Set what kind of world this society starts in. Each choice is a
            claim about how societies work — pick the assumptions, then watch
            what unfolds.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="divide-y divide-foreground/[0.08]">
          {/* WORLD */}
          <Section
            icon={GlobeIcon}
            title="World"
            subtitle="Population, environment, demography."
          >
            <Field
              label="Scale"
              hint="How many agents the society starts with. Larger scales surface emergent dynamics but take longer to compute."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(Object.keys(SCALE_INFO) as Scale[]).map((s) => {
                  const info = SCALE_INFO[s];
                  return (
                    <OptionCard
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(EQUALITY_INFO) as Equality[]).map((e) => {
                  const info = EQUALITY_INFO[e];
                  return (
                    <OptionCard
                      key={e}
                      active={draft.equality === e}
                      onClick={() => setDraft((d) => ({ ...d, equality: e }))}
                      label={info.label}
                      hint={info.hint}
                    />
                  );
                })}
              </div>
            </Field>

            <Field
              label="Resource landscape"
              hint="The spatial layout of resources — shapes where agents settle and where conflict concentrates."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(LANDSCAPE_INFO) as Landscape[]).map((l) => {
                  const info = LANDSCAPE_INFO[l];
                  return (
                    <OptionCard
                      key={l}
                      active={draft.landscape === l}
                      onClick={() => setDraft((d) => ({ ...d, landscape: l }))}
                      label={info.label}
                      hint={info.hint}
                    />
                  );
                })}
              </div>
            </Field>

            <Field label="Reproduction" hint={REPRODUCTION_HINT}>
              <div className="flex h-10 items-center justify-between rounded-md border border-foreground/10 bg-card px-3">
                <span className="text-sm">
                  {draft.reproduction ? "Enabled" : "Disabled"}
                </span>
                <Switch
                  checked={draft.reproduction}
                  onCheckedChange={(v) =>
                    setDraft((d) => ({ ...d, reproduction: v }))
                  }
                />
              </div>
            </Field>
          </Section>

          {/* AGENTS */}
          <Section
            icon={UsersThreeIcon}
            title="Agents"
            subtitle="Motivation and interaction."
          >
            <Field
              label="Sophistication"
              hint="How agents make decisions — from blind reactions to social mimicry."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(SOPHISTICATION_INFO) as AgentSophistication[]).map(
                  (s) => {
                    const info = SOPHISTICATION_INFO[s];
                    return (
                      <OptionCard
                        key={s}
                        active={draft.sophistication === s}
                        onClick={() =>
                          setDraft((d) => ({ ...d, sophistication: s }))
                        }
                        label={info.label}
                        hint={info.hint}
                      />
                    );
                  },
                )}
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
                      <OptionCard
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
          </Section>

          {/* OBSERVERS */}
          <Section
            icon={EyeIcon}
            title="Observers"
            subtitle="AI theorists watching what emerges."
            meta={
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {draft.observers.length} selected
              </span>
            }
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
                      "group flex h-10 cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-left transition-colors",
                      active
                        ? "border-foreground/30 bg-foreground/[0.04]"
                        : "border-foreground/10 bg-card hover:border-foreground/20 hover:bg-foreground/[0.025]",
                    )}
                  >
                    <span className="truncate text-sm font-medium">
                      {info.label}
                    </span>
                    <span
                      className={cn(
                        "flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/15 bg-card",
                      )}
                    >
                      {active && <CheckIcon size={8} weight="bold" />}
                    </span>
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
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium leading-tight text-foreground">
                          {info.name}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {info.era} · {info.lens}
                        </span>
                      </div>
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
          </Section>
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
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!changed}
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  meta,
  children,
}: {
  icon?: typeof GlobeIcon;
  title: string;
  subtitle: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 gap-4 py-7 first:pt-2 last:pb-2 sm:grid-cols-[16rem_1fr] sm:gap-10">
      <div className="flex flex-col gap-1.5 sm:sticky sm:top-0">
        <div className="flex items-center gap-2">
          {Icon && (
            <Icon
              size={14}
              weight="regular"
              className="shrink-0 text-foreground/60"
            />
          )}
          <h3 className="font-serif text-base italic leading-none text-foreground">
            {title}
          </h3>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {subtitle}
        </p>
        {meta && <div className="mt-1">{meta}</div>}
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
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
    <div className="space-y-2">
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

function OptionCard({
  active,
  onClick,
  label,
  hint,
  meta,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  meta?: string;
}) {
  const card = (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "group relative flex h-10 cursor-pointer items-center justify-between gap-2 rounded-md border px-3 text-left transition-colors",
        active
          ? "border-foreground/30 bg-foreground/[0.04]"
          : "border-foreground/10 bg-card hover:border-foreground/20 hover:bg-foreground/[0.025]",
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {meta && (
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {meta}
          </span>
        )}
        <span
          className={cn(
            "flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors",
            active
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/15 bg-card",
          )}
        >
          {active && <CheckIcon size={8} weight="bold" />}
        </span>
      </div>
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={card} />
      <TooltipContent side="top" sideOffset={6} className="max-w-xs">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

