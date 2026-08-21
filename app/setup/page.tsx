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
    question: "How many people live here?",
    framing:
      "A small world lets you follow individual lives. A big one gets you crowds, neighbourhoods and crashes.",
    theoryHook:
      "Size changes what you can see. In a village of 500 you can watch a single agent get rich or starve. In a city of 50,000 individuals blur and you start seeing whole districts move. Bigger worlds are slower to run.",
  },
  {
    key: "equality",
    question: "Do they all start with the same amount?",
    framing:
      "Either everyone opens with an identical pile of food, or some are born richer than others.",
    theoryHook:
      "Starting everyone equal is the more interesting test. If a gap opens up anyway, it came from the run itself: luck, where they happened to be standing, who they traded with. Starting unequal asks a different question, which is whether a head start ever wears off.",
  },
  {
    key: "landscape",
    question: "What does the land look like?",
    framing:
      "Where the food is decides where people go, what they fight over, and which routes get used.",
    theoryHook:
      "Two rich areas means two crowds that meet in the middle, to trade when times are good and to fight when they are not. One rich centre pulls everyone inward and empties the edges. Scattered patches give you lots of small separate settlements. Flat land gives the geography no say at all, so anything that happens is purely social.",
  },
  {
    key: "settlement",
    question: "Where does everyone start out?",
    framing:
      "Somebody has to place them on the map at turn one. Spread out, in a few groups, all in one spot, or already sorted by wealth.",
    theoryHook:
      "This one matters more than it looks. Spread everyone out and any grouping you see later actually formed on its own. Start them in clumps and you have handed the world its neighbourhoods for free. Start them sorted by wealth and you get to see whether a divided world ever mixes back together.",
  },
  {
    key: "metabolism",
    question: "How fast do they burn through food?",
    framing:
      "Every agent eats a bit each turn just to stay alive. The higher this is, the thinner the margin between getting by and starving.",
    theoryHook:
      "Low burn means almost nobody dies and food piles up. High burn makes every turn a small emergency: agents crowd the same patches, the slow ones drop out, and a gap opens between rich and poor before anyone has traded anything. This one dial decides whether you are running a comfortable world or a desperate one.",
  },
  {
    key: "regrowth",
    question: "How fast does food grow back?",
    framing:
      "Food gets eaten, but it also grows back. How fast decides how many people the world can support.",
    theoryHook:
      "Slow regrowth means a stripped area stays stripped for a long time, so a population that grows too fast eats itself into a collapse. Fast regrowth raises the ceiling: there is always more, going hungry is rare, and the run becomes about who gets what rather than whether anyone survives.",
  },
  {
    key: "substrate",
    question: "Does the ground itself change?",
    framing:
      "Food can either regrow patch by patch, or the ground can behave like something alive, with rich soil bleeding into empty squares and worn-out soil spreading outward.",
    theoryHook:
      "Normally each square regrows on its own and ignores its neighbours. Turn this on and food spreads toward emptier squares, and how fertile a square is drifts toward its neighbours. Heavy use spreads outward like a desert, and good land slowly reseeds the ground next to it. The question is whether stripped land heals or whether the damage travels faster than anyone can walk away from it.",
  },
  {
    key: "vision",
    question: "How far can they see?",
    framing:
      "An agent only knows about the squares it can see. This sets how far that goes.",
    theoryHook:
      "This is the cheapest way to create inequality out of nothing. Give two identical agents different eyesight and the one who sees further finds food first, every time, and the gap compounds. Short sight keeps the world local and slow. Very long sight is closer to the textbook market where everyone knows about every opportunity, which almost never happens in real life.",
  },
  {
    key: "lifespan",
    question: "How long do they live?",
    framing:
      "Everyone dies eventually. This sets how quickly the population turns over.",
    theoryHook:
      "Short lives keep resetting the world: wealth breaks up at every death and nothing has time to harden. Long lives let advantages stack up, so what happens now depends on choices made hundreds of turns ago. Long-lived worlds tend to look stable but stuck; short-lived ones look chaotic but keep moving.",
  },
  {
    key: "heterogeneity",
    question: "Are they all the same, or do they vary?",
    framing:
      "Either every agent gets the same eyesight, appetite and lifespan, or each one draws its own from a range.",
    theoryHook:
      "This is the famous result from the original model. Keep everything else equal, give people the same starting wealth and the same land, and just let eyesight vary slightly. You still get dramatic inequality, because the agents who see a little further find food a little sooner and it snowballs. An identical population is a useful baseline, but it is not really a society.",
  },
  {
    key: "sophistication",
    question: "How do they decide where to go?",
    framing:
      "From pure reflex to copying whoever looks successful. You can pick more than one, and real populations are always a mix.",
    theoryHook:
      "Some agents just walk toward the best thing they can see. Some stop at the first option that is good enough. Some learn from how their past moves worked out. Some ignore the food entirely and copy their richest neighbour, which is where fashion and herd behaviour come from. Mixing several types is closer to how real populations behave.",
  },
  {
    key: "motivation",
    question: "What do they care about?",
    framing:
      "Each agent has its own mix of greed, sociability, appetite for status, and appetite for control. These four options are just starting points in that mix. The labels you see later are read back from where each agent actually ended up.",
    theoryHook:
      "This is the deepest choice here. Material agents mostly want more stuff. Symbolic ones want to be admired. Normative ones want to fit in with the people around them. Power ones want others to do what they say. Pick more than one and the population starts spread across all of them. Once the run begins agents copy each other, so the mix you see at turn 500 is not the one you set.",
  },
  {
    key: "topology",
    question: "Who can reach whom at the start?",
    framing:
      "Whether agents only deal with whoever is standing nearby, bump into anyone at random, or keep a stable set of contacts.",
    theoryHook:
      "This decides how fast anything travels. With neighbours only, news moves at walking pace. With random mixing anyone can meet anyone, which is unrealistic but a useful baseline. With stable contacts, influence flows through friends of friends. You will notice there is no option for hierarchy. That is on purpose: if leaders and gatekeepers show up later in the run, they got there on their own.",
  },
  {
    key: "observers",
    question: "Who should be watching?",
    framing:
      "AI observers watch the same run and write about what they see, each in their own way.",
    theoryHook:
      "This is the part that makes Nomos different from a normal simulation. The run happens once, but each observer you pick describes it differently. Marx might call something class conflict where Schelling calls it a tipping point nobody intended. You are not looking for the right answer. Pick a few, because the disagreements are the good part.",
  },
  {
    key: "summary",
    question: "Ready?",
    framing:
      "Here is everything you picked. Go back and change anything you want, then start the run.",
    theoryHook:
      "Every setting on this page is a guess about what kind of world it produces. Start the run and find out. If something surprises you, the cause is somewhere in these settings.",
  },
] as const;

type CodeMode = "real" | "pseudo" | "planned";

interface CodeAnchor {
  plain: string;
  snippet: string;
  mode: CodeMode;
  file?: string;
  lines?: string;
}

const REPO_BLOB = "https://github.com/nenadmarinkovic/nomos/blob/main";

const STEP_CODE: Partial<Record<StepKey, CodeAnchor[]>> = {
  scale: [
    {
      plain:
        "Your pick decides how wide the map is and how many agents start on it.",
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
        "Starting wealth is a blend of a flat amount everyone gets and a random draw. The more inequality you ask for, the more the random draw takes over.",
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
        "Food is piled up around a few peaks and thins out with distance. Your choice decides where those peaks go.",
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
        "On turn one everyone has to be put somewhere. Your choice picks the pattern: random squares, one blob, a few clumps, or four corners sorted by wealth.",
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
        "Every turn each agent eats a little of both goods. Run either one down to zero and it dies.",
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
        "Each square regrows part of its maximum every turn. The rate rises and falls with a 60-turn season, and drops to 40% during a blight.",
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
        "With living ground on, every square trades a little food with the four squares next to it each turn, and its fertility slowly drifts toward theirs. Nothing is created or lost, it just moves.",
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
        "An agent looks up, down, left and right, one step at a time, out to the edge of its sight, and moves to the best free square it finds. If two are equally good it takes the closer one.",
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
        "Agents get one turn older each turn. The same check that catches starvation also removes anyone past their maximum age, however well fed they are.",
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
        "Each agent's sight, appetite and lifespan are drawn around the average you set. At zero variation everyone is identical. Higher settings widen the spread.",
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
        "How an agent moves depends on the type it is: take the best square it can see, take the first good-enough one, follow what it has learned, or copy the richest neighbour in sight.",
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
        "Motivation is not a fixed label. Each agent carries four numbers: greed, sociability, dominance and status-seeking. Your choice sets where those numbers start, then each agent is nudged a little off that.",
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
        "Those four numbers decide what a square is worth to an agent. Greed likes food, sociability likes company, dominance likes weaker neighbours nearby, and status-seeking likes rich company.",
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
        "Who an agent can trade with each turn: four random strangers from anywhere, only the eight squares touching it, or a wider area that grows with its eyesight.",
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
        "Each observer gets a prompt setting up who they are, then the same plain description of what happened. One pair of prompts per observer, per event.",
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
    hint: "Everyone gets the same. Any gap that opens later was made by the run.",
  },
  {
    value: 0.25,
    label: "Almost equal",
    hint: "Small random differences. See whether tiny luck snowballs.",
  },
  {
    value: 0.55,
    label: "Already divided",
    hint: "Rich and poor exist from turn one.",
  },
  {
    value: 0.85,
    label: "Very unequal",
    hint: "A few very rich agents and a lot of poor ones.",
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
          aria-label="Close setup"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/4 hover:text-foreground"
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
          <div className="relative h-0.75 flex-1 overflow-hidden rounded-full bg-foreground/8">
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
          hint="Food seeps between neighbouring squares and good soil spreads. Worn-out land and rich land both travel across the map."
        />
        <BigChoiceCard
          active={!draft.world.substrateDiffusion}
          onClick={() => patchWorld({ substrateDiffusion: false })}
          label="Inert ground"
          hint="Every square regrows on its own and ignores the ones next to it. The land is just scenery."
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
        options={(
          Object.keys(SOPHISTICATION_INFO) as AgentSophistication[]
        ).map((s) => ({
          key: s,
          label: SOPHISTICATION_INFO[s].label,
          hint: SOPHISTICATION_INFO[s].hint,
        }))}
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
          options={(Object.keys(MOTIVATION_INFO) as AgentMotivation[]).map(
            (m) => ({
              key: m,
              label: MOTIVATION_INFO[m].label,
              hint: MOTIVATION_INFO[m].hint,
            }),
          )}
          onChange={(next) => patchAgents({ motivation: next })}
        />
        <div className="rounded-md border border-foreground/10 bg-card/40 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-foreground">
              How often children differ
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {Math.round(rate * 100)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The chance that a child ignores its parent and gets fresh traits
            from the mix above. At 0 children always take after their parents,
            so whichever type wins early stays on top. Turn it up and new kinds
            of agent keep appearing.
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
          ? "border-foreground/20 bg-accent dark:border-zinc-700 dark:bg-zinc-900/60"
          : "border-foreground/10 bg-card hover:border-foreground/20 hover:bg-accent/60 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/30",
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
              Share of the population
            </span>
          </div>
          <div className="space-y-2.5">
            {selected.map((o) => {
              const w = (weights[o.key] as number) ?? 1;
              const pct = total > 0 ? Math.round((w / total) * 100) : 0;
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
  const keys = useMemo(() => Object.keys(OBSERVER_INFO) as ObserverKey[], []);

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
                  ? "border-foreground/20 bg-accent dark:border-zinc-700 dark:bg-zinc-900/60"
                  : "border-foreground/10 bg-card hover:border-foreground/20 hover:bg-accent/60 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/30",
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
              <p className="text-sm leading-snug text-foreground/70">
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
          label="Starting wealth"
          value={equalityBucket(draft.world.equality).label}
          onEdit={() => jumpToStep("equality")}
        />
        <SummaryRow
          label="Landscape"
          value={LANDSCAPE_INFO[draft.world.landscape].label}
          onEdit={() => jumpToStep("landscape")}
        />
        <SummaryRow
          label="Where they start"
          value={SETTLEMENT_INFO[draft.world.initialSettlement].label}
          onEdit={() => jumpToStep("settlement")}
        />
      </SummarySection>

      <SummarySection title="How the world works">
        <SummaryRow
          label="Food burned per turn"
          value={METABOLISM_BUCKETS[metabolismIdx].label}
          onEdit={() => jumpToStep("metabolism")}
        />
        <SummaryRow
          label="How fast food grows back"
          value={REGROWTH_BUCKETS[regrowthIdx].label}
          onEdit={() => jumpToStep("regrowth")}
        />
        <SummaryRow
          label="The ground"
          value={
            draft.world.substrateDiffusion ? "Living ground" : "Inert ground"
          }
          onEdit={() => jumpToStep("substrate")}
        />
        <SummaryRow
          label="How far they see"
          value={VISION_BUCKETS[visionIdx].label}
          onEdit={() => jumpToStep("vision")}
        />
        <SummaryRow
          label="Lifespan"
          value={LIFESPAN_BUCKETS[lifespanIdx].label}
          onEdit={() => jumpToStep("lifespan")}
        />
        <SummaryRow
          label="How much they vary"
          value={HETEROGENEITY_BUCKETS[heterogeneityIdx].label}
          onEdit={() => jumpToStep("heterogeneity")}
        />
      </SummarySection>

      <SummarySection title="The people">
        <SummaryRow
          label="How they decide"
          value={describeMix(
            draft.agents.sophistication,
            (k) => SOPHISTICATION_INFO[k].label,
          )}
          onEdit={() => jumpToStep("sophistication")}
        />
        <SummaryRow
          label="What they want"
          value={describeMix(
            draft.agents.motivation,
            (k) => MOTIVATION_INFO[k].label,
          )}
          onEdit={() => jumpToStep("motivation")}
        />
        <SummaryRow
          label="Who they can reach"
          value={TOPOLOGY_INFO[draft.agents.topology].label}
          onEdit={() => jumpToStep("topology")}
        />
      </SummarySection>

      <SummarySection title="Who is watching">
        <button
          type="button"
          onClick={() => jumpToStep("observers")}
          className="group flex w-full cursor-pointer items-start justify-between gap-4 py-2.5 text-left transition-colors hover:bg-foreground/2"
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
  real: "Real code",
  pseudo: "Simplified version",
  planned: "Planned, not built yet",
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
      className="group flex w-full cursor-pointer items-center justify-between gap-4 py-2.5 text-left transition-colors hover:bg-foreground/2"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2.5">
        <span className="text-[14px] font-medium text-foreground">{value}</span>
        <CaretRightIcon
          size={12}
          weight="bold"
          className="shrink-0 -translate-x-1 text-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
        />
      </span>
    </button>
  );
}
