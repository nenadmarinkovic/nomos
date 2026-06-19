/**
 * Minimal server-side Mistral chat client.
 *
 * Used by the /api/observe route to turn an event + observer persona into a
 * single short narration. One call per active observer per significant event —
 * never per tick. Keep this dependency-free so it stays cheap to reason about.
 */

const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

/** Per-theorist narration model. Small is plenty for two-sentence readings. */
export const MISTRAL_MODEL =
  process.env.MISTRAL_MODEL ?? "mistral-small-latest";

/** Thrown when the API key is absent so the route can answer 503, not 500. */
export class MistralConfigError extends Error {
  constructor(message = "MISTRAL_API_KEY is not configured") {
    super(message);
    this.name = "MistralConfigError";
  }
}

/** Thrown when Mistral itself rejects or fails the request. */
export class MistralRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MistralRequestError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface MistralChatResponse {
  choices?: { message?: { content?: string } }[];
}

export async function mistralChat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new MistralConfigError();

  const res = await fetch(MISTRAL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 220,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new MistralRequestError(
      `Mistral request failed (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
      res.status,
    );
  }

  const data = (await res.json()) as MistralChatResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new MistralRequestError("Mistral returned an empty response", 502);
  }
  return text;
}
