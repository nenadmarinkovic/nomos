"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlayIcon,
  XIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  AgentMotivation,
  AgentSophistication,
  DEFAULT_CONFIG,
  InteractionTopology,
  Landscape,
  LANDSCAPE_INFO,
  MOTIVATION_INFO,
  OBSERVER_INFO,
  ObserverKey,
  REPRODUCTION_HINT,
  SCALE_INFO,
  Scale,
  SOPHISTICATION_INFO,
  TOPOLOGY_INFO,
  type SimulationConfig,
} from "@/lib/config";
import { useSimulationStore } from "@/lib/store";

type StepKey =
  | "scale"
  | "equality"
  | "landscape"
  | "reproduction"
  | "sophistication"
  | "motivation"
  | "topology"
  | "observers";

interface StepDef {
  key: StepKey;
  question: string;
  framing: string;
  theoryHook: string;
}

const STEPS: readonly StepDef[] = [
  {
    key: "scale",
    question: "How many people live in this society?",
    framing:
      "Smaller worlds let you watch each life. Larger ones reveal cities, institutions, and crises.",
    theoryHook:
      "Different things happen at different sizes. In a village of 500 you can see every encounter — whether a market or a custom takes hold. In a town of 5,000 institutions start to crystallize: shared norms, recurring roles, durable hierarchies. In a city of 50,000 you get the texture of real societies — neighbourhoods, classes, even the rise and fall of order itself. Bigger is slower to compute, but more 'society-like' in what it can produce.",
  },
  {
    key: "equality",
    question: "Do they start equal?",
    framing:
      "Some societies begin behind a Rawlsian veil — everyone identical. Others inherit history from turn one.",
    theoryHook:
      "If everyone starts with the same resources and inequality still appears, the simulation itself produced it — through luck, geography, neighbour effects, or how the rules compound small differences. That's a strong claim: inequality doesn't need a head start to emerge, it can grow from nothing. Starting unequal asks a different question instead — how does structure persist, soften, or harden when history is already baked in?",
  },
  {
    key: "landscape",
    question: "What does the land look like?",
    framing:
      "Geography decides where people gather, what they fight over, and which routes carry trade or migration.",
    theoryHook:
      "Resources have a shape, and that shape shapes everything. Two abundant zones means people cluster around each and likely meet — to trade in good times, to fight in bad. A single rich centre acts like a magnet: population pulls inward, leaving a periphery (the classic story of urbanization). Scattered patches scatter the society too — many small settlements, more local economies, slower spread of ideas. Flat means geography has no opinion: whatever happens is purely social.",
  },
  {
    key: "reproduction",
    question: "Do they have children?",
    framing: REPRODUCTION_HINT,
    theoryHook:
      "With reproduction off, every agent lives one life and dies — whatever wealth or status they built disappears with them. With it on, children inherit from their parents, so a head start (or a disadvantage) compounds across generations. This is how class becomes durable: the same families stay near the top, the same families stay near the bottom, and the question 'why doesn't anyone move?' becomes legible. Bourdieu's whole project was about this quiet machinery.",
  },
  {
    key: "sophistication",
    question: "How do they think?",
    framing:
      "From blind stimulus-response to social imitation. Cognition sets the ceiling on what culture can do.",
    theoryHook:
      "Agents can be very simple or quite clever. Minimal agents just react — see resource, go to resource. Bounded-rational agents (Herbert Simon's classic insight, and the sociological default) have limited information and pick 'good enough' rather than optimal — like real people most of the time. Adaptive agents learn from past outcomes. Social agents watch each other and copy — and that's where fashion, herd behaviour, and shared culture come from. Smarter agents don't always mean smarter societies.",
  },
  {
    key: "motivation",
    question: "What do they want?",
    framing:
      "What agents try to maximize shapes everything that follows — economy, status games, ritual life.",
    theoryHook:
      "This is the deepest choice in the model. If agents chase resources, you're running a Marx-like world where material conditions explain the rest. If they chase status and distinction, you're in Bourdieu's territory — the game becomes about taste, recognition, and symbolic capital. If they follow shared norms because belonging matters more than gain, Durkheim's collective conscience does the heavy lifting. Mixed is more realistic, but harder to read: when something emerges, you can't always tell which drive caused it.",
  },
  {
    key: "topology",
    question: "Who can talk to whom?",
    framing:
      "The social graph is the silent infrastructure. It decides how news, norms, trade, and disease spread.",
    theoryHook:
      "The shape of social connection decides what reaches whom. With spatial neighbours, geography is destiny — news and gossip travel only as fast as people walk. Random mixing means anyone might meet anyone (almost never true in real life, but useful as a baseline). Persistent networks mean influence flows through friends-of-friends, so trust and information move along stable paths. Hierarchy means brokers and gatekeepers — bosses, priests, party officials — decide who hears what. Same agents, very different societies.",
  },
  {
    key: "observers",
    question: "Whose eyes will watch?",
    framing:
      "AI theorists watch the same simulation and describe what they see in their own vocabulary.",
    theoryHook:
      "This is the move that makes Nomos different. The simulation runs once, but the chosen theorists each narrate it through their own lens. Marx might see class struggle where Durkheim sees ritual breakdown and Luhmann sees subsystems failing to translate each other. You're not asking which one is right — you're watching multiple readings of the same emergence, side by side. Pick more than one. Disagreement is where the intellectual move actually lives.",
  },
] as const;

const EQUALITY_BUCKETS: ReadonlyArray<{
  value: number;
  label: string;
  hint: string;
}> = [
  {
    value: 0.05,
    label: "Perfectly equal",
    hint: "Everyone starts with identical resources. Any divergence is endogenous.",
  },
  {
    value: 0.25,
    label: "Slight differences",
    hint: "Tiny random variation. Tests whether small accidents amplify.",
  },
  {
    value: 0.55,
    label: "Stratified",
    hint: "Wealth bands already exist. Inheritance and class matter from turn one.",
  },
  {
    value: 0.85,
    label: "Extreme inequality",
    hint: "Few rich, many poor. Power-law distribution from the start.",
  },
];

function equalityBucketIndex(v: number): number {
  let best = 0;
  let bestDist = Infinity;
  EQUALITY_BUCKETS.forEach((b, i) => {
    const d = Math.abs(b.value - v);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

export default function SetupPage() {
  const router = useRouter();
  const storeConfig = useSimulationStore((s) => s.config);
  const startRun = useSimulationStore((s) => s.startRun);

  const [draft, setDraft] = useState<SimulationConfig>(storeConfig);
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  function patch(p: Partial<SimulationConfig>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function toggleObserver(key: ObserverKey) {
    setDraft((d) => ({
      ...d,
      observers: d.observers.includes(key)
        ? d.observers.filter((k) => k !== key)
        : [...d.observers, key],
    }));
  }

  function goNext() {
    if (isLast) {
      startRun(draft);
      router.push("/");
      return;
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  const canAdvance =
    step.key !== "observers" || draft.observers.length > 0;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-foreground/10 bg-background px-4 sm:px-6">
        <Link href="/" aria-label="Nomos" className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt="Nomos"
            width={38}
            height={35}
            priority
            className="h-9 w-auto dark:invert"
          />
          <span className="hidden font-sans text-[11px] uppercase tracking-[0.22em] text-muted-foreground sm:inline">
            Guided setup
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/"
            aria-label="Close guided setup"
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
          >
            <XIcon size={18} weight="regular" />
          </Link>
        </div>
      </header>

      <div className="shrink-0 bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-5 px-4 pb-3 pt-5 sm:px-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] tabular-nums text-muted-foreground">
            <span className="text-foreground">
              {String(stepIndex + 1).padStart(2, "0")}
            </span>
            <span className="mx-1.5 text-muted-foreground/40">/</span>
            {String(STEPS.length).padStart(2, "0")}
          </span>
          <div className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-foreground"
              style={{
                width: `${progress}%`,
                transition: "width 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
          <h1 className="font-serif text-[34px] font-normal leading-[1.1] tracking-[-0.015em] text-foreground sm:text-[44px]">
            {step.question}
          </h1>
          <p className="mt-5 max-w-2xl font-serif text-[17px] leading-relaxed text-foreground/70 sm:text-lg">
            {step.framing}
          </p>

          <div className="mt-12">
            <StepBody
              step={step.key}
              draft={draft}
              patch={patch}
              toggleObserver={toggleObserver}
            />
          </div>

          <p className="mt-12 max-w-2xl font-serif text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
            {step.theoryHook}
          </p>
        </div>
      </main>

      <footer className="flex h-14 shrink-0 items-center justify-between border-t border-foreground/10 bg-background px-4 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDraft(DEFAULT_CONFIG)}
        >
          <ArrowCounterClockwiseIcon weight="regular" />
          Reset
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goBack}
            disabled={stepIndex === 0}
          >
            <ArrowLeftIcon weight="regular" />
            Back
          </Button>
          <Button size="sm" onClick={goNext} disabled={!canAdvance}>
            {isLast ? (
              <>
                <PlayIcon weight="fill" />
                Begin
              </>
            ) : (
              <>
                Next
                <ArrowRightIcon weight="regular" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function StepBody({
  step,
  draft,
  patch,
  toggleObserver,
}: {
  step: StepKey;
  draft: SimulationConfig;
  patch: (p: Partial<SimulationConfig>) => void;
  toggleObserver: (k: ObserverKey) => void;
}) {
  if (step === "scale") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(Object.keys(SCALE_INFO) as Scale[]).map((s) => {
          const info = SCALE_INFO[s];
          return (
            <BigChoiceCard
              key={s}
              active={draft.scale === s}
              onClick={() => patch({ scale: s })}
              label={info.label}
              hint={info.hint}
              meta={info.agents.toLocaleString() + " agents"}
            />
          );
        })}
      </div>
    );
  }

  if (step === "equality") {
    const active = equalityBucketIndex(draft.equality);
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EQUALITY_BUCKETS.map((b, i) => (
          <BigChoiceCard
            key={b.label}
            active={active === i}
            onClick={() => patch({ equality: b.value })}
            label={b.label}
            hint={b.hint}
          />
        ))}
      </div>
    );
  }

  if (step === "landscape") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(LANDSCAPE_INFO) as Landscape[]).map((l) => {
          const info = LANDSCAPE_INFO[l];
          return (
            <BigChoiceCard
              key={l}
              active={draft.landscape === l}
              onClick={() => patch({ landscape: l })}
              label={info.label}
              hint={info.hint}
            />
          );
        })}
      </div>
    );
  }

  if (step === "reproduction") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BigChoiceCard
          active={!draft.reproduction}
          onClick={() => patch({ reproduction: false })}
          label="No — single generation"
          hint="Agents live one life. Inequality cannot be inherited."
        />
        <BigChoiceCard
          active={draft.reproduction}
          onClick={() => patch({ reproduction: true })}
          label="Yes — traits pass down"
          hint="Children inherit wealth and traits. Class persists across generations."
        />
      </div>
    );
  }

  if (step === "sophistication") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(SOPHISTICATION_INFO) as AgentSophistication[]).map(
          (s) => {
            const info = SOPHISTICATION_INFO[s];
            return (
              <BigChoiceCard
                key={s}
                active={draft.sophistication === s}
                onClick={() => patch({ sophistication: s })}
                label={info.label}
                hint={info.hint}
              />
            );
          },
        )}
      </div>
    );
  }

  if (step === "motivation") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(MOTIVATION_INFO) as AgentMotivation[]).map((m) => {
          const info = MOTIVATION_INFO[m];
          return (
            <BigChoiceCard
              key={m}
              active={draft.motivation === m}
              onClick={() => patch({ motivation: m })}
              label={info.label}
              hint={info.hint}
            />
          );
        })}
      </div>
    );
  }

  if (step === "topology") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(TOPOLOGY_INFO) as InteractionTopology[]).map((t) => {
          const info = TOPOLOGY_INFO[t];
          return (
            <BigChoiceCard
              key={t}
              active={draft.topology === t}
              onClick={() => patch({ topology: t })}
              label={info.label}
              hint={info.hint}
            />
          );
        })}
      </div>
    );
  }

  if (step === "observers") {
    return <ObserverPicker draft={draft} toggleObserver={toggleObserver} />;
  }

  return null;
}

function BigChoiceCard({
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "group flex w-full cursor-pointer flex-col gap-2 rounded-lg border px-5 py-4 text-left transition-colors",
        active
          ? "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60"
          : "border-foreground/10 bg-card hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-medium leading-tight text-foreground">
            {label}
          </div>
          {meta && (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {meta}
            </div>
          )}
        </div>
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            active
              ? "border-foreground bg-foreground text-background"
              : "border-foreground/15 bg-card",
          )}
        >
          {active && <CheckIcon size={11} weight="bold" />}
        </span>
      </div>
      <p className="text-[13px] leading-snug text-muted-foreground">{hint}</p>
    </button>
  );
}

function ObserverPicker({
  draft,
  toggleObserver,
}: {
  draft: SimulationConfig;
  toggleObserver: (k: ObserverKey) => void;
}) {
  const keys = useMemo(
    () => Object.keys(OBSERVER_INFO) as ObserverKey[],
    [],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Pick one or more
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {draft.observers.length} selected
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {keys.map((key) => {
          const info = OBSERVER_INFO[key];
          const active = draft.observers.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleObserver(key)}
              aria-pressed={active}
              aria-label={info.label}
              className={cn(
                "group flex w-full cursor-pointer flex-col gap-2 rounded-lg border px-5 py-4 text-left transition-colors",
                active
                  ? "border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60"
                  : "border-foreground/10 bg-card hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/30",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-medium leading-tight text-foreground">
                    {info.name}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {info.era}
                  </div>
                </div>
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/15 bg-card",
                  )}
                >
                  {active && <CheckIcon size={11} weight="bold" />}
                </span>
              </div>
              <p className="font-serif text-[13px] italic leading-snug text-foreground/70">
                {info.lens}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
