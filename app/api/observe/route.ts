import { NextResponse } from "next/server";

import { getCaller } from "@/lib/api-auth";
import { readJsonBody } from "@/lib/http";
import { parseObserveRequest } from "@/lib/observe-input";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/observers";
import {
  MistralConfigError,
  MistralRequestError,
  mistralChat,
} from "@/lib/mistral";
import { checkObserveLimit, clientIp } from "@/lib/observe-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(req: Request) {
  const body = await readJsonBody<unknown>(req, MAX_BODY_BYTES);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const parsed = parseObserveRequest(body.data);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { observer, event, world, context } = parsed.value;

  const caller = await getCaller(req);
  const verdict = await checkObserveLimit(caller, clientIp(req));
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
    console.error("[observe] narration failed", err);
    if (err instanceof MistralRequestError) {
      return NextResponse.json(
        { error: "The observers could not be reached.", code: "mistral_error" },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Narration failed." },
      { status: 500 },
    );
  }
}
