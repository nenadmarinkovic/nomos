"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
  CaretRightIcon,
  CheckIcon,
  PlayIcon,
  XIcon,
} from "@phosphor-icons/react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  AgentModel,
  AgentMotivation,
  AgentSophistication,
  DEFAULT_CONFIG,
  DEFAULT_MUTATION_RATE,
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

SyntaxHighlighter.registerLanguage("typescript", typescript);

type StepKey =
  | "scale"
  | "equality"
  | "landscape"
  | "settlement"
  | "metabolism"
  | "regrowth"
  | "substrate"
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
      "Slow regrowth turns the simulation into a Malthusian world: once exhausted, a region takes a long time to recover, and societies that overshoot collapse. Fast regrowth lifts the ceiling — there's always more, scarcity rarely bites, and the dynamics shift toward distribution and status rather than survival. The contrast between these two regimes is one of the oldest debates in human history.",
  },
  {
    key: "substrate",
    question: "Does the land itself move?",
    framing:
      "Resources can sit still on each patch, or the ground can behave like a living surface — abundance seeping into bare cells, exhaustion creeping outward from worn ground.",
    theoryHook:
      "By default the landscape is inert scenery: each patch regrows on its own, blind to its neighbours. Switch this on and the substrate becomes a cellular automaton in its own right — standing resources diffuse toward emptier cells, and a patch's fertility drifts toward its neighbours', so heavy use spreads like desertification while fertile land slowly reseeds the ground beside it. The agents stay an agent-based model; only the earth under them gains its own local rules. The interesting question is what changes when scarcity can travel: do depleted regions heal, or do dust bowls march across the map faster than anyone can outrun them?",
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
      "Every agent has a finite life. Lifespan decides how quickly the population turns over.",
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
    question: "What kinds of dispositions seed the population?",
    framing:
      "Every agent carries a trait vector — greed, prosociality, dominance, status-seeking. The four options here are named centroids in that space; your mix decides which regions the initial population is drawn from. The motivation labels you'll see later are read back from where each agent's traits actually sit — not the input you gave here.",
    theoryHook:
      "This is the deepest choice in the model, and the four centroids track four classical positions. Material seeds high greed with modest neighbour-pull — Marx's productive subject. Symbolic seeds high status-seeking — Bourdieu's capital game. Normative seeds high prosociality — Durkheim's collective conscience. Power seeds high dominance — the question of legitimate domination. Pick more than one and the initial population fans out across trait space. Once the run starts, cultural drift and imitation move traits around; the visible mix at turn 500 is what *emerged*, not what you set. When something surfaces — a moralistic wave, a coercion cycle — the interesting question becomes: which region of the trait space produced it?",
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
      "This is the move that makes Nomos different. The simulation runs once, but the chosen theorists each narrate it through their own lens. Marx might see class struggle where Durkheim sees ritual breakdown and Schelling sees a quiet segregation cascade nobody intended. You're not asking which one is right — you're watching multiple readings of the same emergence, side by side. Pick more than one. Disagreement is where the intellectual move actually lives.",
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

/**
 * One or more anchors per step. Each shows what the step actually does in
 * plain English and in code. The `mode` badge is honest about what the
 * snippet is — real, simplified, or planned-but-unwired.
 */
type CodeMode = "real" | "pseudo" | "planned";

interface CodeAnchor {
  /** One-sentence description shown above the snippet. */
  plain: string;
  /** ≤ ~7 lines: real code, faithful pseudocode, or a planned sketch. */
  snippet: string;
  mode: CodeMode;
  /** Source file the snippet is drawn from. Omitted for `planned`. */
  file?: string;
  /** Line range like "191-213". Used to build the source link. */
  lines?: string;
}

const REPO_BLOB = "https://github.com/nenadmarinkovic/nomos/blob/main";

const STEP_CODE: Partial<Record<StepKey, CodeAnchor[]>> = {
  scale: [
    {
      plain:
        "Your pick sets how wide the world is and how many agents are born into it.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "13-23",
      snippet: `const GRID_SIZE: Record<Scale, number> = {
  village: 50,
  town: 80,
  city: 110,
};

const AGENT_COUNT: Record<Scale, number> = {
  village: 500,
  town: 1000,
  city: 5000,
};`,
    },
  ],
  equality: [
    {
      plain:
        "Each agent's starting wealth is blended between a flat baseline everyone shares and an exponential random draw. The more inequality you ask for, the more the draw dominates.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "1868-1879",
      snippet: `const baseline = 15;
const eq = config.world.equality;
for (let i = 0; i < count; i++) {
  if (eq === 0) {
    wealths.push(baseline);
  } else {
    const u = Math.max(0.001, rng());
    const exp = -Math.log(u) * baseline;    // heavy-tailed draw
    wealths.push(baseline * (1 - eq) + exp * eq);
  }
}`,
    },
  ],
  landscape: [
    {
      plain:
        "Resources are piled up at a few 'peaks' and fade with Gaussian distance. Your choice decides where those peaks sit.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "1751-1791",
      snippet: `if (landscape === "flat") {
  sugar.fill(3);
  spice.fill(3);
  return;
}
if (landscape === "two_peaks") {
  sugarPeaks = [{ x: width * 0.27, y: height * 0.5 },
                { x: width * 0.73, y: height * 0.5 }];
  spicePeaks = [{ x: width * 0.5,  y: height * 0.27 },
                { x: width * 0.5,  y: height * 0.73 }];
} else if (landscape === "centre") {
  sugarPeaks = [{ x: width * 0.5,  y: height * 0.5 }];
  spicePeaks = [{ x: width * 0.2,  y: height * 0.2 },
                { x: width * 0.8,  y: height * 0.8 }];
} else if (landscape === "scattered") {
  for (let i = 0; i < 6; i++) {
    sugarPeaks.push({ x: rng() * width, y: rng() * height });
    spicePeaks.push({ x: rng() * width, y: rng() * height });
  }
}
fillGaussian(sugar, width, height, sugarPeaks, sigma);
fillGaussian(spice, width, height, spicePeaks, sigma);`,
    },
  ],
  settlement: [
    {
      plain:
        "On turn one the agents have to be placed somewhere. Your choice picks the pattern — random cells, a single Gaussian blob, a few clusters, or wealth-sorted quadrants.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "1968-2037",
      snippet: `if (settlement === "scattered") {
  for (let i = 0; i < count; i++) tryPlace(i, rng() * W, rng() * H);
  return positions;
}
if (settlement === "single") {
  const cx = W / 2, cy = H / 2;
  const sigma = Math.min(W, H) / 12;
  for (let i = 0; i < count; i++)
    tryPlace(i, cx + normal() * sigma, cy + normal() * sigma);
  return positions;
}
if (settlement === "clustered") {
  const k = Math.min(5, Math.max(2, Math.floor(count / 100)));
  const centroids = pickCentroids(k);   // k random hubs, per run
  const sigma = Math.min(W, H) / 10;
  for (let i = 0; i < count; i++) {
    const c = centroids[Math.floor(rng() * k)];
    tryPlace(i, c.x + normal() * sigma, c.y + normal() * sigma);
  }
  return positions;
}
// segregated: sort by wealth desc, fill each quadrant in order
const order = [...Array(count).keys()].sort((a, b) => wealths[b] - wealths[a]);
const quadrants = [tl, tr, bl, br];
const groupSize = Math.ceil(count / 4);
for (let oi = 0; oi < order.length; oi++) {
  const q = quadrants[Math.min(3, Math.floor(oi / groupSize))];
  tryPlace(order[oi],
           q.x0 + rng() * (q.x1 - q.x0),
           q.y0 + rng() * (q.y1 - q.y0));
}`,
    },
  ],
  metabolism: [
    {
      plain:
        "Every turn each agent burns a little of both goods just to stay alive. Run either one down to nothing and it dies.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "1077-1094",
      snippet: `private consume(a: Agent): void {
  if (a.sophistication === "adaptive") {
    const now = holdings(a);
    a.boldness =
      now > a.lastHoldings
        ? Math.min(1, a.boldness + 0.05)
        : Math.max(0.05, a.boldness - 0.05);
    a.lastHoldings = now;
  }

  a.sugar -= a.sugarMetab;
  a.spice -= a.spiceMetab;
  a.age++;

  if (a.sugar <= 0 || a.spice <= 0 || a.age >= a.maxAge) {
    this.killAgent(a);           // starved, or past its lifespan
  }
}`,
    },
  ],
  regrowth: [
    {
      plain:
        "Each patch grows back a slice of its ceiling every turn — but the rate breathes seasonally (~30–170% of base over 60 turns) and drops to 40% while a blight is active.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "745-768",
      snippet: `private regrow(stock: Float32Array, max: Float32Array, isSugar: boolean): void {
  // Seasonal swing — regrowth between ~30% and ~170% of base over 60 turns.
  const seasonal =
    1 + 0.7 * Math.sin((this.turn * 2 * Math.PI) / 60);
  const blightActive = isSugar && this.turn < this.blightUntilTurn;
  const rate = this.regrowthRate * seasonal * (blightActive ? 0.4 : 1);

  for (let i = 0; i < stock.length; i++) {
    const m = max[i];
    if (m > 0) {
      const next = stock[i] + rate * m;
      stock[i] = next > m ? m : next;   // grow, but cap at full
    }
  }
}`,
    },
  ],
  substrate: [
    {
      plain:
        "When substrate diffusion is on, every tick each cell exchanges standing resources with its four orthogonal neighbours (mass-preserving), and separately relaxes its fertility toward theirs.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "788-805",
      snippet: `private diffuseStock(stock: Float32Array): void {
  const w = this.width, h = this.height;
  const out = this.diffScratch;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const s = stock[i];
      let flux = 0;
      if (x > 0)     flux += stock[i - 1] - s;
      if (x < w - 1) flux += stock[i + 1] - s;
      if (y > 0)     flux += stock[i - w] - s;
      if (y < h - 1) flux += stock[i + w] - s;
      out[i] = s + STOCK_DIFFUSION * flux;
    }
  }
  stock.set(out);   // commit synchronously — this is a CA, not a sweep
}`,
    },
  ],
  vision: [
    {
      plain:
        "An agent scans the four cardinal directions ring by ring, up to its vision, and moves to the highest-scoring free cell — ties break toward the nearer one.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "972-996",
      snippet: `private greedyMove(a: Agent, vision: number): { x: number; y: number } {
  let bestX = a.x, bestY = a.y;
  let bestScore = this.scoreCell(a, a.x, a.y);
  let bestDist = 0;

  for (let d = 1; d <= vision; d++) {
    for (const [cx, cy] of this.axisTargets(a, d)) {
      if (!this.inBounds(cx, cy)) continue;
      const idx = cy * this.width + cx;
      if (!this.isFree(idx, a)) continue;
      const score = this.scoreCell(a, cx, cy);
      if (
        score > bestScore ||
        (score === bestScore && bestDist > 0 && d < bestDist)
      ) {
        bestScore = score;
        bestX = cx; bestY = cy;
        bestDist = d;
      }
    }
  }
  return { x: bestX, y: bestY };
}`,
    },
  ],
  lifespan: [
    {
      plain:
        "Agents age one turn at a time; the same check that catches starvation kills any agent past its maximum age, however well fed.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "1089-1093",
      snippet: `a.age++;

if (a.sugar <= 0 || a.spice <= 0 || a.age >= a.maxAge) {
  this.killAgent(a);   // starved, or past its lifespan
}`,
    },
  ],
  heterogeneity: [
    {
      plain:
        "Each agent's vision, metabolism, and lifespan are drawn around the configured average. Zero heterogeneity makes everyone identical; higher widens the spread linearly.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "1852-1919",
      snippet: `const sampleAttr = (mean: number) => {
  if (h === 0) return mean;
  return mean * (1 - h + 2 * h * rng());   // [mean·(1−h), mean·(1+h)]
};

// applied per agent when spawning:
vision:     Math.max(1,   Math.round(sampleAttr(physics.vision))),
sugarMetab: Math.max(0.1, sampleAttr(metabMean)),
spiceMetab: Math.max(0.1, sampleAttr(metabMean)),
maxAge:     Math.max(10,  Math.round(sampleAttr(physics.lifespan))),`,
    },
  ],
  sophistication: [
    {
      plain:
        "Each turn's movement rule dispatches on the agent's sophistication — greedy optimum, satisfice a short horizon, follow learned boldness, or imitate the wealthiest visible neighbour.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "939-950",
      snippet: `private chooseTarget(a: Agent): { x: number; y: number } {
  switch (a.sophistication) {
    case "bounded_rational":
      return this.satisficeMove(a);         // good-enough at half vision
    case "adaptive":
      return this.adaptiveMove(a);          // vision × learned boldness
    case "social":
      return this.imitativeMove(a);         // follow the richest neighbour
    default:                                 // "minimal"
      return this.greedyMove(a, a.vision);  // best cell in full vision
  }
}`,
    },
  ],
  motivation: [
    {
      plain:
        "Motivation isn't a switch anymore — it's a four-dimensional trait vector. Each named motivation seeds its own centroid, then each agent is jittered around it.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "64-69",
      snippet: `const MOTIVATION_TRAIT_CENTROID: Record<AgentMotivation, AgentTraits> = {
  material:  { greed: 0.7, prosociality: 0.5, dominance: 0.3, statusSeeking: 0.3 },
  symbolic:  { greed: 0.4, prosociality: 0.5, dominance: 0.2, statusSeeking: 0.8 },
  normative: { greed: 0.3, prosociality: 0.9, dominance: 0.1, statusSeeking: 0.4 },
  power:     { greed: 0.6, prosociality: 0.1, dominance: 0.9, statusSeeking: 0.5 },
};`,
    },
    {
      plain:
        "A cell's score reads directly off those traits — greed weights raw resources, prosociality weights company, dominance turns nearby weaker neighbours into prey, and statusSeeking chases high-wealth surroundings.",
      mode: "real",
      file: "lib/engine.ts",
      lines: "223-240",
      snippet: `function scoreCellByTraits(
  t: AgentTraits,
  resources: number,
  neighbourCount: number,
  neighbourAvgWealth: number,
  ownWealth: number,
): number {
  const resourceWeight  = 0.6 + 0.5 * t.greed;
  const proximityWeight = 0.6 * t.prosociality;
  const predatoryWeight =
    ownWealth > neighbourAvgWealth ? 0.8 * t.dominance : 0;
  const statusWeight    = 0.1 * t.statusSeeking;
  return (
    resources * resourceWeight +
    neighbourCount * (proximityWeight + predatoryWeight) +
    neighbourAvgWealth * statusWeight
  );
}`,
    },
  ],
  topology: [
    {
      plain:
        "Who an agent can trade with each turn — four random strangers from anywhere, only the eight cells touching it, or a wider box that grows with its vision (capped at 4).",
      mode: "real",
      file: "lib/engine.ts",
      lines: "1158-1184",
      snippet: `private partnersFor(a: Agent): number[] {
  const out: number[] = [];
  if (this.topology === "random") {
    // Random meetings: a few draws from the whole field.
    for (let i = 0; i < 4; i++) {
      const j = Math.floor(this.rng() * this.agents.length);
      const other = this.agents[j];
      if (other && other.alive && other.id !== a.id) out.push(other.id);
    }
    return out;
  }
  // Spatial = adjacent; network = within vision (further reach).
  const radius = this.topology === "network" ? Math.min(a.vision, 4) : 1;
  for (let dy = -radius; dy <= radius; dy++) {
    const ny = a.y + dy;
    if (ny < 0 || ny >= this.height) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = a.x + dx;
      if (nx < 0 || nx >= this.width) continue;
      const occ = this.occupants[ny * this.width + nx];
      if (occ !== -1 && occ !== a.id) out.push(occ);
    }
  }
  return out;
}`,
    },
  ],
  observers: [
    {
      plain:
        "Each observer's system prompt fixes the theorist's persona; the user prompt hands them the same neutral event. One such pair is issued per chosen observer, per significant event.",
      mode: "real",
      file: "lib/observers.ts",
      lines: "51-69",
      snippet: `export function buildSystemPrompt(observer: ObserverKey): string {
  const info = OBSERVER_INFO[observer];
  return [
    \`You are \${info.name}, the social theorist, observing an emerging society.\`,
    \`Your lens: \${info.lens}.\`,
    \`How you see the social world: \${info.sees}\`,
    \`What you watch for: \${info.watches}\`,
    "",
    "You are handed a neutral, factual description of something that just happened. Read it through your own perspective…",
    // Rules follow: 2–3 sentences, present tense, stay in character…
  ].join("\\n");
}`,
    },
  ],
};

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
          <span className="hidden text-xs uppercase tracking-[0.22em] text-muted-foreground sm:inline">
            Guided setup
          </span>
        </Link>

        <Link
          href="/"
          aria-label="Close guided setup"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
        >
          <XIcon size={18} weight="regular" />
        </Link>
      </header>

      <div className="shrink-0 bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-5 px-4 pb-3 pt-5 sm:px-6">
          <span className="font-mono text-xs uppercase tracking-[0.22em] tabular-nums text-muted-foreground">
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
          <h1 className="text-[34px] font-normal leading-[1.1] tracking-[-0.015em] text-foreground sm:text-[44px]">
            {step.question}
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-foreground/70 sm:text-lg">
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

          <p className="mt-12 max-w-2xl text-[17px] leading-relaxed text-foreground/80 sm:text-lg">
            {step.theoryHook}
          </p>

          {STEP_CODE[step.key] && (
            <CodeAnchors anchors={STEP_CODE[step.key]!} />
          )}
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

  if (step === "substrate") {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BigChoiceCard
          active={draft.world.substrateDiffusion}
          onClick={() => patchWorld({ substrateDiffusion: true })}
          label="Living ground"
          hint="The landscape is a cellular automaton: resources diffuse and fertility spreads, so exhaustion and abundance travel across the map."
        />
        <BigChoiceCard
          active={!draft.world.substrateDiffusion}
          onClick={() => patchWorld({ substrateDiffusion: false })}
          label="Inert ground"
          hint="Each patch regrows alone, blind to its neighbours. The land is fixed scenery the agents move across."
        />
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
    const rate = draft.agents.mutationRate ?? DEFAULT_MUTATION_RATE;
    return (
      <div className="space-y-6">
        <WeightedPickGrid<AgentMotivation>
          weights={draft.agents.motivation}
          options={(Object.keys(MOTIVATION_INFO) as AgentMotivation[]).map((m) => ({
            key: m,
            label: MOTIVATION_INFO[m].label,
            hint: MOTIVATION_INFO[m].hint,
          }))}
          onChange={(next) => patchAgents({ motivation: next })}
        />
        <div className="rounded-md border border-foreground/10 bg-card/40 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-foreground">
              Mutation rate
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {Math.round(rate * 100)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Per-birth chance the child&apos;s traits are resampled from the
            centroid mix above instead of drifting off the parent&apos;s.
            Higher = diversity rebleeds in after a single region of trait
            space has taken over; 0 = strict heritability, and once a trait
            cluster wins it stays won.
          </p>
          <div className="mt-3">
            <Slider
              value={[Math.round(rate * 100)]}
              min={0}
              max={20}
              step={1}
              onValueChange={(v) => {
                const next = Array.isArray(v) ? v[0] : v;
                if (typeof next === "number")
                  patchAgents({ mutationRate: next / 100 });
              }}
            />
          </div>
        </div>
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
            <div className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
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
      <p className="text-sm leading-snug text-muted-foreground">{hint}</p>
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
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Pick one or more
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
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
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Mix
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
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
                  <span className="truncate text-sm font-medium text-foreground">
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
                  <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
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
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Pick one or more
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
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
                  <div className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
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
              <p className="text-sm italic leading-snug text-foreground/70">
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
          label="Substrate"
          value={draft.world.substrateDiffusion ? "Living ground" : "Inert ground"}
          onEdit={() => jumpToStep("substrate")}
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
          <span className="shrink-0 pt-1 text-sm text-muted-foreground">
            {draft.observers.length === 0
              ? "None"
              : `${draft.observers.length} selected`}
          </span>
          <span className="flex flex-1 items-start justify-end gap-3">
            <div className="flex flex-wrap justify-end gap-1.5">
              {draft.observers.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-foreground/10 bg-card px-2.5 py-0.5 text-xs font-medium text-foreground/85"
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
      <h3 className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y divide-foreground/10 border-y border-foreground/10">
        {children}
      </div>
    </section>
  );
}

const MODE_LABEL: Record<CodeMode, string> = {
  real: "Actual code",
  pseudo: "Simplified",
  planned: "Planned — not wired yet",
};

function blobHref(file: string, lines?: string): string {
  if (!lines) return `${REPO_BLOB}/${file}`;
  const [start, end] = lines.split("-");
  return `${REPO_BLOB}/${file}#L${start}${end ? `-L${end}` : ""}`;
}

function CodeAnchors({ anchors }: { anchors: CodeAnchor[] }) {
  return (
    <Accordion
      type="single"
      collapsible
      className="mt-12 max-w-2xl border-t border-foreground/10 pt-6"
    >
      <AccordionItem value="anchors">
        <AccordionTrigger className="group font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
          <CaretRightIcon
            size={11}
            weight="bold"
            className="shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90"
          />
          What the simulation actually does
        </AccordionTrigger>
        <AccordionContent>
          <div className="mt-6 space-y-7">
            {anchors.map((anchor, i) => (
              <CodeAnchorBlock key={i} anchor={anchor} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function CodeAnchorBlock({ anchor }: { anchor: CodeAnchor }) {
  const { resolvedTheme } = useTheme();
  const codeStyle = resolvedTheme === "dark" ? oneDark : oneLight;

  return (
    <div className="space-y-3">
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground",
          anchor.mode === "planned"
            ? "border-dashed border-foreground/25"
            : "border-foreground/15",
        )}
      >
        {MODE_LABEL[anchor.mode]}
      </span>
      <p className="text-[15px] leading-relaxed text-foreground/80">
        {anchor.plain}
      </p>
      <div className="overflow-hidden rounded-md border border-foreground/10 bg-card/40">
        <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-1.5">
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            typescript
          </span>
        </div>
        <SyntaxHighlighter
          language="typescript"
          style={codeStyle}
          customStyle={{
            margin: 0,
            padding: "12px 14px",
            background: "transparent",
            fontSize: "13.5px",
            lineHeight: "1.55",
          }}
          codeTagProps={{
            style: { fontFamily: "var(--font-mono)" },
          }}
        >
          {anchor.snippet}
        </SyntaxHighlighter>
      </div>
      {anchor.file && (
        <a
          href={blobHref(anchor.file, anchor.lines)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {anchor.file}
          {anchor.lines && <span className="text-muted-foreground/50">·</span>}
          {anchor.lines && <span>{anchor.lines}</span>}
          <ArrowSquareOutIcon size={12} weight="regular" />
        </a>
      )}
    </div>
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
      <span className="text-sm text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-2.5">
        <span className="text-[14px] font-medium text-foreground">
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
