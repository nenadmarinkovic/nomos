"use client";

import { useEffect, useState } from "react";
import {
  ArrowCounterClockwise,
  Check,
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
import { cn } from "@/lib/utils";
import {
  AgentSophistication,
  DEFAULT_CONFIG,
  Equality,
  InteractionTopology,
  Landscape,
  OBSERVER_INFO,
  ObserverKey,
  SCALE_INFO,
  Scale,
  SimulationConfig,
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
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl italic">
            Initial conditions
          </DialogTitle>
          <DialogDescription>
            Set what kind of world this society starts in. Anything you add
            here becomes a claim you&rsquo;re making.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-7">
          {/* WORLD */}
          <Section
            title="World"
            subtitle="Population, environment, demography"
          >
            <Field label="Scale" hint="Determines time-to-emergence">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(SCALE_INFO) as Scale[]).map((s) => {
                  const info = SCALE_INFO[s];
                  const active = draft.scale === s;
                  return (
                    <OptionCard
                      key={s}
                      active={active}
                      onClick={() => setDraft((d) => ({ ...d, scale: s }))}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{info.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                          {info.agents.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-[11px] leading-snug text-muted-foreground">
                        {info.hint}
                      </span>
                    </OptionCard>
                  );
                })}
              </div>
            </Field>

            <Field label="Starting equality">
              <Pills
                value={draft.equality}
                onChange={(v) => setDraft((d) => ({ ...d, equality: v }))}
                options={[
                  { value: "equal", label: "Equal" },
                  { value: "slight", label: "Slight noise" },
                  { value: "stratified", label: "Stratified" },
                  { value: "extreme", label: "Extreme" },
                ] as { value: Equality; label: string }[]}
              />
            </Field>

            <Field label="Resource landscape">
              <Pills
                value={draft.landscape}
                onChange={(v) => setDraft((d) => ({ ...d, landscape: v }))}
                options={[
                  { value: "two_peaks", label: "Two peaks" },
                  { value: "centre", label: "Single centre" },
                  { value: "scattered", label: "Scattered" },
                  { value: "flat", label: "Flat" },
                ] as { value: Landscape; label: string }[]}
              />
            </Field>

            <div className="flex items-center justify-between rounded-md border border-foreground/10 bg-card px-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-sm">Reproduction</span>
                <span className="text-[11px] text-muted-foreground">
                  Inheritance follows Bourdieu&rsquo;s rates
                </span>
              </div>
              <Switch
                checked={draft.reproduction}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, reproduction: v }))
                }
              />
            </div>
          </Section>

          <Divider />

          {/* AGENTS */}
          <Section title="Agents" subtitle="Motivation and interaction">
            <Field label="Sophistication">
              <Pills
                value={draft.sophistication}
                onChange={(v) =>
                  setDraft((d) => ({ ...d, sophistication: v }))
                }
                options={[
                  { value: "minimal", label: "Minimal" },
                  { value: "bounded_rational", label: "Bounded" },
                  { value: "adaptive", label: "Adaptive" },
                  { value: "social", label: "Social" },
                ] as { value: AgentSophistication; label: string }[]}
              />
            </Field>

            <Field label="Interaction topology">
              <Pills
                value={draft.topology}
                onChange={(v) => setDraft((d) => ({ ...d, topology: v }))}
                options={[
                  { value: "spatial", label: "Local spatial" },
                  { value: "random", label: "Random mixing" },
                  { value: "network", label: "Network" },
                  { value: "hierarchical", label: "Hierarchical" },
                ] as { value: InteractionTopology; label: string }[]}
              />
            </Field>
          </Section>

          <Divider />

          {/* OBSERVERS */}
          <Section
            title="Observers"
            subtitle="AI theorists watching what emerges"
            meta={
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {draft.observers.length} selected
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(OBSERVER_INFO) as ObserverKey[]).map((key) => {
                const info = OBSERVER_INFO[key];
                const active = draft.observers.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleObserver(key)}
                    aria-pressed={active}
                    className={cn(
                      "group flex items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors",
                      active
                        ? "border-foreground/40 bg-foreground/5"
                        : "border-foreground/10 bg-card hover:border-foreground/20 hover:bg-foreground/[0.025]",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-foreground/20 bg-card",
                      )}
                    >
                      {active && <Check size={10} weight="bold" />}
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium leading-tight">
                        {info.label}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {info.lens}
                      </span>
                    </div>
                  </button>
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
            <ArrowCounterClockwise weight="regular" />
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
  title,
  subtitle,
  meta,
  children,
}: {
  title: string;
  subtitle: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-sans text-sm font-medium leading-none text-foreground">
            {title}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {meta}
      </div>
      {children}
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
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </Label>
        {hint && (
          <span className="text-[10px] text-muted-foreground/70">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-foreground/[0.08]" aria-hidden />;
}

function OptionCard({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-foreground/40 bg-foreground/5"
          : "border-foreground/10 bg-card hover:border-foreground/20 hover:bg-foreground/[0.025]",
      )}
    >
      {children}
    </button>
  );
}

function Pills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              active
                ? "border-foreground/40 bg-foreground/5 text-foreground"
                : "border-foreground/10 bg-card text-foreground/70 hover:border-foreground/20 hover:bg-foreground/[0.025] hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
