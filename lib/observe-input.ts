import { clampNumber, sanitizeLine } from "@/lib/http";
import type { SignificantEvent } from "@/lib/events";
import type { ObserverKey } from "@/lib/config";
import {
  isObserverKey,
  type SimContext,
  type WorldSummary,
} from "@/lib/observers";

const MAX_SUMMARY = 600;
const MAX_TITLE = 160;
const MAX_LABEL = 48;
const MAX_ID = 128;
const MAX_RECENT_EVENTS = 12;
const MAX_TURN = 10_000_000;

export interface ObservePayload {
  observer: ObserverKey;
  event: SignificantEvent;
  world: WorldSummary;
  context?: SimContext;
}

export type ParseResult =
  | { ok: true; value: ObservePayload }
  | { ok: false; error: string };

export function parseObserveRequest(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Malformed request body" };
  }
  const raw = body as Record<string, unknown>;

  if (!isObserverKey(raw.observer)) {
    return { ok: false, error: "Unknown or missing observer" };
  }

  const event = raw.event as Record<string, unknown> | undefined;
  const summary = sanitizeLine(event?.summary, MAX_SUMMARY);
  if (!event || !summary || typeof event.turn !== "number") {
    return { ok: false, error: "Missing or malformed event" };
  }

  const world = raw.world as Record<string, unknown> | undefined;
  if (!world || typeof world !== "object") {
    return { ok: false, error: "Missing world summary" };
  }

  return {
    ok: true,
    value: {
      observer: raw.observer,
      event: {
        id: sanitizeLine(event.id, MAX_ID),
        turn: Math.round(clampNumber(event.turn, 0, MAX_TURN, 0)),
        kind: sanitizeLine(event.kind, MAX_LABEL),
        title: sanitizeLine(event.title, MAX_TITLE),
        summary,
        severity: event.severity === "major" ? "major" : "minor",
        metrics: {},
      } as SignificantEvent,
      world: {
        scale: sanitizeLine(world.scale, MAX_LABEL) || "unspecified",
        landscape: sanitizeLine(world.landscape, MAX_LABEL) || "unspecified",
        equality: sanitizeLine(world.equality, MAX_LABEL) || "unspecified",
      },
      context: parseContext(raw.context),
    },
  };
}

function parseContext(value: unknown): SimContext | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;

  const mix = (raw.motivationMix ?? {}) as Record<string, unknown>;
  const ties = (raw.ties ?? {}) as Record<string, unknown>;
  const recent = Array.isArray(raw.recentEvents) ? raw.recentEvents : [];

  return {
    motivationMix: {
      material: clampNumber(mix.material, 0, 1, 0),
      symbolic: clampNumber(mix.symbolic, 0, 1, 0),
      normative: clampNumber(mix.normative, 0, 1, 0),
      power: clampNumber(mix.power, 0, 1, 0),
    },
    ties: {
      count: Math.round(clampNumber(ties.count, 0, 1_000_000, 0)),
      topWeight: clampNumber(ties.topWeight, 0, 1_000, 0),
      isolatesShare: clampNumber(ties.isolatesShare, 0, 1, 0),
    },
    recentEvents: recent
      .slice(0, MAX_RECENT_EVENTS)
      .map((e) => {
        const entry = (e ?? {}) as Record<string, unknown>;
        return {
          turn: Math.round(clampNumber(entry.turn, 0, MAX_TURN, 0)),
          kind: sanitizeLine(entry.kind, MAX_LABEL),
          title: sanitizeLine(entry.title, MAX_TITLE),
        };
      })
      .filter((e) => e.title.length > 0),
  };
}
