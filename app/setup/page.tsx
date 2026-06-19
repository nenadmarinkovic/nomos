"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CaretRightIcon,
  CheckIcon,
  PlayIcon,
  XIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  AgentModel,
  AgentMotivation,
  AgentSophistication,
  DEFAULT_CONFIG,
  describeMix,
  equalityBucket,
  HETEROGENEITY_BUCKETS,
  InitialSettlement,
  InteractionTopology,
  Landscape,
  LANDSCAPE_INFO,
  LIFESPAN_BUCKETS,
  METABOLISM_BUCKETS,
  MOTIVATION_INFO,
  OBSERVER_INFO,
  ObserverKey,
  REGROWTH_BUCKETS,
  REPRODUCTION_HINT,
  SCALE_INFO,
  Scale,
  SETTLEMENT_INFO,
  SOPHISTICATION_INFO,
  TOPOLOGY_INFO,
  VISION_BUCKETS,
  type SimulationConfig,
  type WeightedSelection,
  type WorldConfig,
  type WorldPhysics,
} from "@/lib/config";
import { useSimulationStore } from "@/lib/store";

type StepKey =
  | "scale"
  | "equality"
  | "landscape"
  | "settlement"
  | "reproduction"
  | "metabolism"
  | "regrowth"
  | "vision"
  | "lifespan"
  | "heterogeneity"
  | "sophistication"
  | "motivation"
  | "topology"
  | "observers"
  | "summary";

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
    key: "settlement",
    question: "Where do they start out?",
    framing:
      "At the very first turn, the world has to be populated somehow. Whether people are scattered, gathered into a few groups, already in one place, or pre-sorted by wealth — the starting pattern shapes what can emerge.",
    theoryHook:
      "The initial pattern of where people are is one of the quietest but most consequential choices. With a scattered start, distinctive clusters have to form through behaviour — that's the real test of whether neighbourhoods and tribes are emergent. With a clustered start, you skip ahead: 'people-near-each-other-look-alike' is already given. A single settlement forces migration into the story. A segregated start asks Schelling's question in reverse: once sorted, does a society stay sorted, or does mixing reassert itself?",
  },
  {
    key: "reproduction",
    question: "Does wealth pass between generations?",
    framing: REPRODUCTION_HINT,
    theoryHook:
      "Inheritance is how structure becomes durable. When wealth and traits pass down, a head start (or a disadvantage) compounds across generations — the same families stay near the top, the same families stay near the bottom, and the question 'why doesn't anyone move?' becomes legible. When each life resets, every birth is a clean slate: useful as a thought experiment, but unrealistic for any actual society. Bourdieu's whole project was about the quiet machinery of the first option.",
  },
  {
    key: "metabolism",
    question: "How fast do they burn through resources?",
    framing:
      "Every agent consumes a little each turn just to stay alive. The harder that burn, the tighter the margin between surplus and starvation.",
    theoryHook:
      "Metabolism is the heartbeat of any agent-based society. When it's low, almost nobody falls behind and surplus piles up — economies of comfort. When it's high, every turn is a small crisis: people compete for the same patches, the weak drop out, and inequality gets a brutal source even before any rules of trade exist. This single dial decides whether you're modelling abundance or scarcity.",
  },
  {
    key: "regrowth",
    question: "How quickly does the world replenish?",
    framing:
      "Resources don't only get used — they regrow. The speed of that regrowth sets the carrying capacity of the whole society.",
    theoryHook:
      "Slow regrowth turns the simulation into a Malthusian world: once exhausted, a region takes a long time to recover, and societies that overshoot collapse. Fast regrowth lifts the ceiling — there's always more, scarcity rarely bites, and the dynamics shift toward distribution and status rather than survival. The contrast between these two regimes is one of the oldest debates in human history, from Malthus to Ostrom.",
  },
  {
    key: "vision",
    question: "How far can they see?",
    framing:
      "Each agent only knows what it can perceive around itself. Vision sets the radius of that local knowledge.",
    theoryHook:
      "Vision is the cheapest way to produce inequality from nothing. Epstein showed that with everything else equal, agents who can see further find resources faster, accumulate more, and outcompete the rest. Short vision keeps the world locally knit and parochial: news travels slowly, opportunities go unnoticed. Long vision approaches an idealized market where everyone sees everything — the world economics textbooks usually assume but real societies almost never reach.",
  },
  {
    key: "lifespan",
    question: "How long do they live?",
    framing:
      "Even without reproduction, agents have finite lives. Lifespan decides how quickly the population turns over.",
    theoryHook:
      "Short lives mean a society that resets quickly: wealth dissolves with each death, hierarchies don't have time to entrench, and demographic pressure is constant. Long lives let structure accumulate — old agents carry old advantages forward, and the present is shaped by decisions made long ago. The classic insight: societies with very long-lived agents tend to look stable but rigid, while short-lived ones look chaotic but mobile.",
  },
  {
    key: "heterogeneity",
    question: "Are all agents identical, or do they vary?",
    framing:
      "Decide whether everyone shares the same vision, metabolism, and lifespan — or whether each agent draws their own values from a spread.",
    theoryHook:
      "This is Epstein's most-cited result. With everything else equal — same starting wealth, same landscape — a population where vision varies even slightly will still produce dramatic inequality. The agents who happen to see further find resources faster, and the gap compounds. A perfectly uniform population is a useful baseline, but it isn't really a society: real populations differ, and those differences are often the silent engine behind macro patterns. The wider the spread, the more outcomes look like the world we know.",
  },
  {
    key: "sophistication",
    question: "How do they think?",
    framing:
      "From blind stimulus-response to social imitation. Cognition sets the ceiling on what culture can do. Pick more than one — real populations mix cognitive types.",
    theoryHook:
      "Agents can be very simple or quite clever, and real populations are never one or the other. Minimal agents just react — see resource, go to resource. Bounded-rational ones have limited information and pick 'good enough' rather than optimal. Adaptive agents learn from past outcomes. Social agents watch each other and copy — and that's where fashion, herd behaviour, and shared culture come from. Pick more than one and the population becomes a mix: some imitators alongside some learners alongside some satisficers, which is what Doyne Farmer argues real societies actually look like. Homogeneous populations almost never behave like real ones.",
  },
  {
    key: "motivation",
    question: "What do they want?",
    framing:
      "What agents try to maximize shapes everything that follows — economy, status games, ritual life, authority. Pick more than one if you want different drives to coexist.",
    theoryHook:
      "This is the deepest choice in the model, and the four options track four classical positions. Material agents chase resources — Marx's productive subject. Symbolic ones chase status and distinction — Bourdieu's capital game. Normative ones chase belonging and conformity — Durkheim's collective conscience. Power-seeking ones chase authority and control over others — Weber's iron cage and the question of legitimate domination. Pick more than one and the population splits between drives — closer to real societies, where some chase money, others chase honour, others just follow the room, and some quietly try to rule it. When something emerges in a mixed population, the interesting question becomes: which drive produced it?",
  },
  {
    key: "topology",
    question: "Who can talk to whom — at the start?",
    framing:
      "The initial social graph: the structure at turn one. Whether hierarchies grow on top of it is for the simulation to decide.",
    theoryHook:
      "The shape of social connection at the start decides what reaches whom. With spatial neighbours, geography is destiny — news and gossip travel only as fast as people walk. Random mixing means anyone might meet anyone (almost never true in real life, but useful as a baseline). Persistent networks mean influence flows through friends-of-friends, so trust and information move along stable paths. You'll notice 'hierarchy' isn't on this menu — that's deliberate. A generative model should let hierarchies *emerge* from local interaction, not declare them at turn zero. If brokers and gatekeepers appear later in the run, that's the simulation telling you something.",
  },
  {
    key: "observers",
    question: "Whose eyes will watch?",
    framing:
      "AI theorists watch the same simulation and describe what they see in their own vocabulary.",
    theoryHook:
      "This is the move that makes Nomos different. The simulation runs once, but the chosen theorists each narrate it through their own lens. Marx might see class struggle where Durkheim sees ritual breakdown and Luhmann sees subsystems failing to translate each other. You're not asking which one is right — you're watching multiple readings of the same emergence, side by side. Pick more than one. Disagreement is where the intellectual move actually lives.",
  },
  {
    key: "summary",
    question: "Ready to begin?",
    framing:
      "Here's the society you've designed — world, agents, and observers in one view. Look it over, jump back to anything you'd like to change, then begin the simulation.",
    theoryHook:
      "Every choice on this page is a hypothesis: about what conditions produce what kinds of societies. Hit Begin, watch what emerges, and let the observers narrate it through their own theoretical vocabularies. If something surprises you, the answer is somewhere in these settings — that's the whole point of generative social science.",
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

function bucketIndex(buckets: readonly { value: number }[], v: number): number {
  let best = 0;
  let bestDist = Infinity;
  buckets.forEach((b, i) => {
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
  const [returnToSummary, setReturnToSummary] = useState(false);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const summaryIndex = STEPS.findIndex((s) => s.key === "summary");

  function patchWorld(p: Partial<WorldConfig>) {
    setDraft((d) => ({ ...d, world: { ...d.world, ...p } }));
  }

  function patchPhysics(p: Partial<WorldPhysics>) {
    setDraft((d) => ({
      ...d,
      world: { ...d.world, physics: { ...d.world.physics, ...p } },
    }));
  }

  function patchAgents(p: Partial<AgentModel>) {
    setDraft((d) => ({ ...d, agents: { ...d.agents, ...p } }));
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
    if (returnToSummary) {
      setStepIndex(summaryIndex);
      setReturnToSummary(false);
      return;
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }

  function goBack() {
    setReturnToSummary(false);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function jumpToStep(key: StepKey) {
    const idx = STEPS.findIndex((s) => s.key === key);
    if (idx < 0) return;
    setStepIndex(idx);
    setReturnToSummary(true);
  }

  const canAdvance = (() => {
    if (step.key === "observers") return draft.observers.length > 0;
    if (step.key === "motivation")
      return Object.keys(draft.agents.motivation).length > 0;
    if (step.key === "sophistication")
      return Object.keys(draft.agents.sophistication).length > 0;
    return true;
  })();

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
              patchWorld={patchWorld}
              patchPhysics={patchPhysics}
              patchAgents={patchAgents}
              toggleObserver={toggleObserver}
              jumpToStep={jumpToStep}
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
          onClick={() => {
            setDraft(DEFAULT_CONFIG);
            setStepIndex(0);
          }}
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
  patchWorld,
  patchPhysics,
  patchAgents,
  toggleObserver,
  jumpToStep,
}: {
  step: StepKey;
  draft: SimulationConfig;
  patchWorld: (p: Partial<WorldConfig>) => void;
  patchPhysics: (p: Partial<WorldPhysics>) => void;
  patchAgents: (p: Partial<AgentModel>) => void;
  toggleObserver: (k: ObserverKey) => void;
  jumpToStep: (key: StepKey) => void;
}) {
  if (step === "scale") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(Object.keys(SCALE_INFO) as Scale[]).map((s) => {
          const info = SCALE_INFO[s];
          return (
            <BigChoiceCard
              key={s}
              active={draft.world.scale === s}
              onClick={() => patchWorld({ scale: s })}
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
    const active = bucketIndex(EQUALITY_BUCKETS, draft.world.equality);
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {EQUALITY_BUCKETS.map((b, i) => (
          <BigChoiceCard
            key={b.label}
            active={active === i}
            onClick={() => patchWorld({ equality: b.value })}
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
              active={draft.world.landscape === l}
              onClick={() => patchWorld({ landscape: l })}
              label={info.label}
              hint={info.hint}
            />
          );
        })}
      </div>
    );
  }

  if (step === "settlement") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(Object.keys(SETTLEMENT_INFO) as InitialSettlement[]).map((s) => {
          const info = SETTLEMENT_INFO[s];
          return (
            <BigChoiceCard
              key={s}
              active={draft.world.initialSettlement === s}
              onClick={() => patchWorld({ initialSettlement: s })}
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
          active={draft.world.reproduction}
          onClick={() => patchWorld({ reproduction: true })}
          label="Yes — children inherit"
          hint="Wealth, traits, and disadvantage pass down. Class persists across generations."
        />
        <BigChoiceCard
          active={!draft.world.reproduction}
          onClick={() => patchWorld({ reproduction: false })}
          label="No — each life resets"
          hint="Every agent starts from zero. Inheritance plays no role; mobility is total."
        />
      </div>
    );
  }

  if (step === "metabolism") {
    const active = bucketIndex(
      METABOLISM_BUCKETS,
      draft.world.physics.metabolism,
    );
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {METABOLISM_BUCKETS.map((b, i) => (
          <BigChoiceCard
            key={b.label}
            active={active === i}
            onClick={() => patchPhysics({ metabolism: b.value })}
            label={b.label}
            hint={b.hint}
          />
        ))}
      </div>
    );
  }

  if (step === "regrowth") {
    const active = bucketIndex(
      REGROWTH_BUCKETS,
      draft.world.physics.regrowthRate,
    );
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {REGROWTH_BUCKETS.map((b, i) => (
          <BigChoiceCard
            key={b.label}
            active={active === i}
            onClick={() => patchPhysics({ regrowthRate: b.value })}
            label={b.label}
            hint={b.hint}
          />
        ))}
      </div>
    );
  }

  if (step === "vision") {
    const active = bucketIndex(VISION_BUCKETS, draft.world.physics.vision);
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VISION_BUCKETS.map((b, i) => (
          <BigChoiceCard
            key={b.label}
            active={active === i}
            onClick={() => patchPhysics({ vision: b.value })}
            label={b.label}
            hint={b.hint}
          />
        ))}
      </div>
    );
  }

  if (step === "lifespan") {
    const active = bucketIndex(LIFESPAN_BUCKETS, draft.world.physics.lifespan);
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LIFESPAN_BUCKETS.map((b, i) => (
          <BigChoiceCard
            key={b.label}
            active={active === i}
            onClick={() => patchPhysics({ lifespan: b.value })}
            label={b.label}
            hint={b.hint}
          />
        ))}
      </div>
    );
  }

  if (step === "heterogeneity") {
    const active = bucketIndex(
      HETEROGENEITY_BUCKETS,
      draft.world.physics.heterogeneity,
    );
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {HETEROGENEITY_BUCKETS.map((b, i) => (
          <BigChoiceCard
            key={b.label}
            active={active === i}
            onClick={() => patchPhysics({ heterogeneity: b.value })}
            label={b.label}
            hint={b.hint}
          />
        ))}
      </div>
    );
  }

  if (step === "sophistication") {
    return (
      <WeightedPickGrid<AgentSophistication>
        weights={draft.agents.sophistication}
        options={(Object.keys(SOPHISTICATION_INFO) as AgentSophistication[]).map(
          (s) => ({
            key: s,
            label: SOPHISTICATION_INFO[s].label,
            hint: SOPHISTICATION_INFO[s].hint,
          }),
        )}
        onChange={(next) => patchAgents({ sophistication: next })}
      />
    );
  }

  if (step === "motivation") {
    return (
      <WeightedPickGrid<AgentMotivation>
        weights={draft.agents.motivation}
        options={(Object.keys(MOTIVATION_INFO) as AgentMotivation[]).map((m) => ({
          key: m,
          label: MOTIVATION_INFO[m].label,
          hint: MOTIVATION_INFO[m].hint,
        }))}
        onChange={(next) => patchAgents({ motivation: next })}
      />
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
              active={draft.agents.topology === t}
              onClick={() => patchAgents({ topology: t })}
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

  if (step === "summary") {
    return <SummaryReview draft={draft} jumpToStep={jumpToStep} />;
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

function WeightedPickGrid<K extends string>({
  weights,
  options,
  onChange,
}: {
  weights: WeightedSelection<K>;
  options: { key: K; label: string; hint: string }[];
  onChange: (next: WeightedSelection<K>) => void;
}) {
  const selected = options.filter((o) => weights[o.key] !== undefined);
  const total = selected.reduce(
    (sum, o) => sum + (weights[o.key] as number),
    0,
  );

  function toggle(k: K) {
    const next = { ...weights };
    if (next[k] !== undefined) delete next[k];
    else next[k] = 1;
    onChange(next);
  }

  function setWeight(k: K, w: number) {
    onChange({ ...weights, [k]: w });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Pick one or more
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {selected.length} selected
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <BigChoiceCard
              key={o.key}
              active={weights[o.key] !== undefined}
              onClick={() => toggle(o.key)}
              label={o.label}
              hint={o.hint}
            />
          ))}
        </div>
      </div>

      {selected.length >= 2 && (
        <div className="space-y-3 rounded-lg border border-foreground/10 bg-card/40 px-4 py-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Mix
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
              Share of population
            </span>
          </div>
          <div className="space-y-2.5">
            {selected.map((o) => {
              const w = (weights[o.key] as number) ?? 1;
              const pct =
                total > 0 ? Math.round((w / total) * 100) : 0;
              return (
                <div
                  key={o.key}
                  className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3"
                >
                  <span className="truncate font-sans text-[13px] font-medium text-foreground">
                    {o.label}
                  </span>
                  <Slider
                    value={[w]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={(v) => {
                      const next = Array.isArray(v) ? v[0] : v;
                      if (typeof next === "number") setWeight(o.key, next);
                    }}
                  />
                  <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
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

function SummaryReview({
  draft,
  jumpToStep,
}: {
  draft: SimulationConfig;
  jumpToStep: (key: StepKey) => void;
}) {
  const metabolismIdx = bucketIndex(
    METABOLISM_BUCKETS,
    draft.world.physics.metabolism,
  );
  const regrowthIdx = bucketIndex(
    REGROWTH_BUCKETS,
    draft.world.physics.regrowthRate,
  );
  const visionIdx = bucketIndex(VISION_BUCKETS, draft.world.physics.vision);
  const lifespanIdx = bucketIndex(
    LIFESPAN_BUCKETS,
    draft.world.physics.lifespan,
  );
  const heterogeneityIdx = bucketIndex(
    HETEROGENEITY_BUCKETS,
    draft.world.physics.heterogeneity,
  );

  return (
    <div className="space-y-10">
      <SummarySection title="World">
        <SummaryRow
          label="Population"
          value={`${SCALE_INFO[draft.world.scale].label} · ${SCALE_INFO[
            draft.world.scale
          ].agents.toLocaleString()} agents`}
          onEdit={() => jumpToStep("scale")}
        />
        <SummaryRow
          label="Starting equality"
          value={equalityBucket(draft.world.equality).label}
          onEdit={() => jumpToStep("equality")}
        />
        <SummaryRow
          label="Landscape"
          value={LANDSCAPE_INFO[draft.world.landscape].label}
          onEdit={() => jumpToStep("landscape")}
        />
        <SummaryRow
          label="Initial settlement"
          value={SETTLEMENT_INFO[draft.world.initialSettlement].label}
          onEdit={() => jumpToStep("settlement")}
        />
        <SummaryRow
          label="Inheritance"
          value={
            draft.world.reproduction ? "Children inherit" : "Each life resets"
          }
          onEdit={() => jumpToStep("reproduction")}
        />
      </SummarySection>

      <SummarySection title="Physics">
        <SummaryRow
          label="Metabolism"
          value={METABOLISM_BUCKETS[metabolismIdx].label}
          onEdit={() => jumpToStep("metabolism")}
        />
        <SummaryRow
          label="Regrowth"
          value={REGROWTH_BUCKETS[regrowthIdx].label}
          onEdit={() => jumpToStep("regrowth")}
        />
        <SummaryRow
          label="Vision"
          value={VISION_BUCKETS[visionIdx].label}
          onEdit={() => jumpToStep("vision")}
        />
        <SummaryRow
          label="Lifespan"
          value={LIFESPAN_BUCKETS[lifespanIdx].label}
          onEdit={() => jumpToStep("lifespan")}
        />
        <SummaryRow
          label="Heterogeneity"
          value={HETEROGENEITY_BUCKETS[heterogeneityIdx].label}
          onEdit={() => jumpToStep("heterogeneity")}
        />
      </SummarySection>

      <SummarySection title="Agents">
        <SummaryRow
          label="Cognition"
          value={describeMix(
            draft.agents.sophistication,
            (k) => SOPHISTICATION_INFO[k].label,
          )}
          onEdit={() => jumpToStep("sophistication")}
        />
        <SummaryRow
          label="Motivation"
          value={describeMix(
            draft.agents.motivation,
            (k) => MOTIVATION_INFO[k].label,
          )}
          onEdit={() => jumpToStep("motivation")}
        />
        <SummaryRow
          label="Topology"
          value={TOPOLOGY_INFO[draft.agents.topology].label}
          onEdit={() => jumpToStep("topology")}
        />
      </SummarySection>

      <SummarySection title="Observers">
        <button
          type="button"
          onClick={() => jumpToStep("observers")}
          className="group flex w-full cursor-pointer items-start justify-between gap-4 py-2.5 text-left transition-colors hover:bg-foreground/[0.02]"
        >
          <span className="shrink-0 pt-1 font-sans text-[13px] text-muted-foreground">
            {draft.observers.length === 0
              ? "None"
              : `${draft.observers.length} selected`}
          </span>
          <span className="flex flex-1 items-start justify-end gap-3">
            <div className="flex flex-wrap justify-end gap-1.5">
              {draft.observers.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-foreground/10 bg-card px-2.5 py-0.5 font-sans text-[12px] font-medium text-foreground/85"
                >
                  {OBSERVER_INFO[k].name}
                </span>
              ))}
            </div>
            <CaretRightIcon
              size={12}
              weight="bold"
              className="mt-1.5 shrink-0 -translate-x-1 text-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
            />
          </span>
        </button>
      </SummarySection>
    </div>
  );
}

function SummarySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y divide-foreground/10 border-y border-foreground/10">
        {children}
      </div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="group flex w-full cursor-pointer items-center justify-between gap-4 py-2.5 text-left transition-colors hover:bg-foreground/[0.02]"
    >
      <span className="font-sans text-[13px] text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-2.5">
        <span className="font-sans text-[14px] font-medium text-foreground">
          {value}
        </span>
        <CaretRightIcon
          size={12}
          weight="bold"
          className="shrink-0 -translate-x-1 text-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
        />
      </span>
    </button>
  );
}
