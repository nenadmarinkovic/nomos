import { anonIdHeaders } from "@/lib/anon-id";
import type { SimulationConfig } from "@/lib/config";
import type { HistoryPoint, ChronicleEntry } from "@/lib/store";

/** A saved run as it appears in the library list — metadata only, no payload. */
export interface RunSummary {
  id: string;
  name: string;
  createdAt: string;
  seed: number;
  turn: number;
  alive: number;
  gini: number;
  totalWealth: number;
}

/** A saved run with everything needed to browse or replay it. */
export interface RunDetail extends RunSummary {
  config: SimulationConfig;
  history: HistoryPoint[];
  chronicle: ChronicleEntry[];
}

/** What the client sends to persist the current run. */
export interface SaveRunInput {
  name: string;
  config: SimulationConfig;
  turn: number;
  alive: number;
  gini: number;
  totalWealth: number;
  history: HistoryPoint[];
  chronicle: ChronicleEntry[];
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(body || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function listRuns(): Promise<RunSummary[]> {
  return asJson<RunSummary[]>(
    await fetch("/api/runs", {
      cache: "no-store",
      // `create: false` — listing is a read-only first visit, no need to
      // mint an anonymous id just to look at the (empty) library.
      headers: anonIdHeaders(false),
    }),
  );
}

export async function saveRun(input: SaveRunInput): Promise<RunSummary> {
  return asJson<RunSummary>(
    await fetch("/api/runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Saves need an owner. Mint the anon id if it doesn't exist yet.
        ...anonIdHeaders(true),
      },
      body: JSON.stringify(input),
    }),
  );
}

export async function getRun(id: string): Promise<RunDetail> {
  return asJson<RunDetail>(
    await fetch(`/api/runs/${id}`, {
      cache: "no-store",
      headers: anonIdHeaders(false),
    }),
  );
}

export async function deleteRun(id: string): Promise<void> {
  const res = await fetch(`/api/runs/${id}`, {
    method: "DELETE",
    headers: anonIdHeaders(false),
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}

/**
 * Reassign any runs saved under this browser's anonymous `ownerKey` to the
 * currently-authenticated user. Safe to call multiple times; safe to call
 * when no anon id exists (the server returns `{ claimed: 0 }`).
 */
export async function claimAnonRuns(): Promise<number> {
  const res = await fetch("/api/runs/claim", {
    method: "POST",
    headers: anonIdHeaders(false),
  });
  if (!res.ok) throw new Error(`Claim failed (${res.status})`);
  const body = (await res.json()) as { claimed: number };
  return body.claimed;
}
