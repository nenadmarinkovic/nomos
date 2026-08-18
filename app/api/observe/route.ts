import { NextResponse } from "next/server";

import { getCaller } from "@/lib/api-auth";
import type { SignificantEvent } from "@/lib/events";
import {
  buildSystemPrompt,
  buildUserPrompt,
  isObserverKey,
  type SimContext,
  type WorldSummary,
} from "@/lib/observers";
import {
  MistralConfigError,
  MistralRequestError,
  mistralChat,
} from "@/lib/mistral";
import { checkObserveLimit, clientIp } from "@/lib/observe-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ObserveRequest {
  observer?: unknown;
  event?: SignificantEvent;
  world?: WorldSummary;
  context?: SimContext;
}

export async function POST(req: Request) {
  let body: ObserveRequest;
  try {
    body = (await req.json()) as ObserveRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { observer, event, world, context } = body;

  if (!isObserverKey(observer)) {
    return NextResponse.json(
      { error: "Unknown or missing observer" },
      { status: 400 },
    );
  }
  if (!event?.summary || typeof event.turn !== "number") {
    return NextResponse.json(
      { error: "Missing or malformed event" },
      { status: 400 },
    );
  }
  if (!world) {
    return NextResponse.json(
      { error: "Missing world summary" },
      { status: 400 },
    );
  }

  const caller = await getCaller(req);
  const verdict = checkObserveLimit(caller, clientIp(req));
  if (!verdict.ok) {
    return NextResponse.json(
      {
        error:
          verdict.scope === "global"
            ? "The observers are catching their breath — this deployment has hit its hourly narration budget."
            : "You are narrating faster than the observers can think. Try again shortly.",
        code: "rate_limited",
        retryAfter: verdict.retryAfterSec,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(verdict.retryAfterSec),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(verdict.resetAt / 1000)),
        },
      },
    );
  }

  try {
    const text = await mistralChat([
      { role: "system", content: buildSystemPrompt(observer) },
      { role: "user", content: buildUserPrompt(event, world, context) },
    ]);
    return NextResponse.json(
      { observer, eventId: event.id, text },
      {
        headers: {
          "X-RateLimit-Remaining": String(verdict.remaining),
          "X-RateLimit-Reset": String(Math.ceil(verdict.resetAt / 1000)),
        },
      },
    );
  } catch (err) {
    if (err instanceof MistralConfigError) {
      return NextResponse.json(
        {
          error:
            "The observers are offline — set MISTRAL_API_KEY to let them speak.",
          code: "no_api_key",
        },
        { status: 503 },
      );
    }
    if (err instanceof MistralRequestError) {
      return NextResponse.json(
        { error: err.message, code: "mistral_error" },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
