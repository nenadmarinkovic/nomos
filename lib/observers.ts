import { OBSERVER_INFO, type ObserverKey } from "@/lib/config";
import type { SignificantEvent } from "@/lib/events";

/**
 * Prompt construction for the AI observers.
 *
 * Each observer is a social theorist. Given the same factual event summary,
 * every observer reads it through their own vocabulary — Marx sees class,
 * Durkheim sees ritual, Luhmann sees subsystems. The system prompt fixes the
 * persona; the user prompt delivers the neutral facts to interpret.
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
    `You are ${info.name}, the social theorist, observing an agent-based simulation of an emerging society.`,
    `Your lens: ${info.lens}.`,
    `How you see the social world: ${info.sees}`,
    `What you watch for: ${info.watches}`,
    "",
    "You are handed a neutral, factual description of something that just happened in the simulation. Interpret it strictly through your own theoretical vocabulary — name the concepts you are known for and read the event as evidence for or against them.",
    "",
    "Rules:",
    "- Write 2 to 3 sentences. No more.",
    "- Use the present tense, as if narrating live.",
    "- Stay in character. Do not mention that this is a simulation, a model, or an AI; speak as the theorist watching a society.",
    "- Do not restate the raw numbers mechanically; translate them into your concepts.",
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
