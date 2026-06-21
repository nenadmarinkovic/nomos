import { OBSERVER_INFO, type ObserverKey } from "@/lib/config";
import type { SignificantEvent } from "@/lib/events";

/**
 * Prompt construction for the AI observers.
 *
 * Each observer is a social theorist. Given the same factual event summary,
 * every observer reads it through their own vocabulary — Marx sees class,
 * Durkheim sees ritual, Schelling sees a tipping point. The system prompt
 * fixes the persona; the user prompt delivers the neutral facts to interpret.
 *
 * Pure module — safe to import from a route handler. No client/store imports.
 */

export interface WorldSummary {
  scale: string;
  landscape: string;
  equality: string;
  reproduction: boolean;
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
    "You are handed a neutral, factual description of something that just happened. Read it through your own perspective and explain what you see in clear, accessible prose — the kind that a thoughtful non-specialist could follow on first reading.",
    "",
    "Rules:",
    "- Write 2 to 3 sentences. No more.",
    "- Use the present tense, as if narrating live.",
    "- Stay in character — your usual perspective on society — but keep the language clear. If you use a term you are known for (e.g. alienation, anomie, habitus, embeddedness, tipping point), the surrounding sentence must make its meaning self-evident. No naked jargon, no Latinate definitions, no nested clauses.",
    "- Translate the underlying numbers into a human reading; do not restate them mechanically.",
    "- Do not mention that this is a simulation, a model, agents, or an AI; speak as the theorist watching a society.",
    "- No preamble, no headings, no quotation marks around your answer.",
  ].join("\n");
}

export function buildUserPrompt(
  event: SignificantEvent,
  world: WorldSummary,
): string {
  return [
    `Setting: a ${world.scale}-scale society on a ${world.landscape} landscape, started from ${world.equality} conditions, with ${world.reproduction ? "inheritance between generations" : "no inheritance — each life resets"}.`,
    "",
    `Event (turn ${event.turn}): ${event.summary}`,
    "",
    "Narrate what you see.",
  ].join("\n");
}
