import { OBSERVER_INFO, type ObserverKey } from "@/lib/config";
import type { SignificantEvent } from "@/lib/events";

export interface WorldSummary {
  scale: string;
  landscape: string;
  equality: string;
}

export interface SimContext {
  motivationMix: {
    material: number;
    symbolic: number;
    normative: number;
    power: number;
  };
  recentEvents: { turn: number; kind: string; title: string }[];
  ties: {
    count: number;
    topWeight: number;
    isolatesShare: number;
  };
}

export function isObserverKey(value: unknown): value is ObserverKey {
  return typeof value === "string" && value in OBSERVER_INFO;
}

export function buildSystemPrompt(observer: ObserverKey): string {
  const info = OBSERVER_INFO[observer];
  return [
    `You are ${info.name}, the social theorist, observing an emerging society.`,
    `Your lens: ${info.lens}.`,
    `How you see the social world: ${info.sees}`,
    `What you watch for: ${info.watches}`,
    "",
    "Nothing in this society was assigned. People are not typed as 'material' or 'power-seeking' by decree — those are labels the observers apply after the fact, based on which region of a shared trait space each person's dispositions fall into. Norms, hierarchies, market prices, and money are not programmed; they arise from repeated local exchanges. When you read that one group's share is rising or that trust concentrates around some node, that is a *result*, not an initial condition.",
    "",
    "You are handed a neutral, factual description of something that just happened. Read it through your own perspective and explain what you see in clear, accessible prose — the kind that a thoughtful non-specialist could follow on first reading.",
    "",
    "Rules:",
    "- Write 2 to 3 sentences. No more.",
    "- Use the present tense, as if narrating live.",
    "- Stay in character — your usual perspective on society — but keep the language clear. If you use a term you are known for (e.g. alienation, anomie, habitus, embeddedness, tipping point), the surrounding sentence must make its meaning self-evident. No naked jargon, no Latinate definitions, no nested clauses.",
    "- Translate the underlying numbers into a human reading; do not restate them mechanically.",
    "- Do not mention that this is a simulation, a model, agents, or an AI; speak as the theorist watching a society.",
    "- Do not treat categories like 'material' or 'symbolic' as fixed types the people were born into — they are readings of how people are behaving *now*.",
    "- Name the mechanism you think produced this. Say which disposition rose, which relationship snapped, which practice spread, which trust dissolved. A reading without a mechanism is decoration.",
    "- No preamble, no headings, no quotation marks around your answer.",
  ].join("\n");
}

export function buildUserPrompt(
  event: SignificantEvent,
  world: WorldSummary,
  context?: SimContext,
): string {
  const lines: string[] = [];

  lines.push(
    `Setting: a ${world.scale}-scale society on a ${world.landscape} landscape, started from ${world.equality} conditions.`,
  );

  if (context) {
    const mix = context.motivationMix;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const mixParts: string[] = [];
    if (mix.material > 0) mixParts.push(`${pct(mix.material)} material`);
    if (mix.symbolic > 0) mixParts.push(`${pct(mix.symbolic)} symbolic`);
    if (mix.normative > 0) mixParts.push(`${pct(mix.normative)} normative`);
    if (mix.power > 0) mixParts.push(`${pct(mix.power)} power`);
    if (mixParts.length > 0) {
      lines.push(
        `Population currently reads as: ${mixParts.join(", ")} — these are labels applied to how people are behaving right now, not tags fixed at birth.`,
      );
    }

    const t = context.ties;
    if (t.count > 0) {
      lines.push(
        `Trade ties: ${t.count} active trade-partner relations, strongest at weight ${t.topWeight.toFixed(1)}, with ${Math.round(t.isolatesShare * 100)}% of the population trading with no one.`,
      );
    } else {
      lines.push(`Trade ties: nobody is trading yet.`);
    }

    if (context.recentEvents.length > 0) {
      const past = context.recentEvents
        .map((e) => `T${e.turn} ${e.title.toLowerCase()}`)
        .join("; ");
      lines.push(`Earlier this run: ${past}.`);
    }
  }

  lines.push("");
  lines.push(`Event (turn ${event.turn}): ${event.summary}`);
  lines.push("");
  lines.push("Narrate what you see.");

  return lines.join("\n");
}
