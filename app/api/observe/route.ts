import { NextResponse } from "next/server";

import type { SignificantEvent } from "@/lib/events";
import {
  buildSystemPrompt,
  buildUserPrompt,
  isObserverKey,
  type WorldSummary,
} from "@/lib/observers";
import {
  MistralConfigError,
  MistralRequestError,
  mistralChat,
} from "@/lib/mistral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ObserveRequest {
  observer?: unknown;
  event?: SignificantEvent;
  world?: WorldSummary;
}

export async function POST(req: Request) {
  let body: ObserveRequest;
  try {
    body = (await req.json()) as ObserveRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { observer, event, world } = body;

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

  try {
    const text = await mistralChat([
      { role: "system", content: buildSystemPrompt(observer) },
      { role: "user", content: buildUserPrompt(event, world) },
    ]);
    return NextResponse.json({ observer, eventId: event.id, text });
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
