import { anonIdHeaders } from "@/lib/anon-id";
import type { SimulationConfig } from "@/lib/config";
import type { HistoryPoint, ChronicleEntry } from "@/lib/store";

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

export interface RunDetail extends RunSummary {
  config: SimulationConfig;
  history: HistoryPoint[];
  chronicle: ChronicleEntry[];
}

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

export async function claimAnonRuns(): Promise<number> {
  const res = await fetch("/api/runs/claim", {
    method: "POST",
    headers: anonIdHeaders(false),
  });
  if (!res.ok) throw new Error(`Claim failed (${res.status})`);
  const body = (await res.json()) as { claimed: number };
  return body.claimed;
}
