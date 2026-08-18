import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getCaller, ownerData, ownerWhere } from "@/lib/api-auth";
import { clientIp } from "@/lib/client-ip";
import { clampNumber, readJsonBody, sanitizeLine } from "@/lib/http";
import {
  MAX_CHRONICLE_ENTRIES,
  MAX_HISTORY_POINTS,
  MAX_RUNS_PER_OWNER,
  MAX_RUN_BODY_BYTES,
  MAX_RUN_NAME,
  RUN_READ_LIMITS,
  RUN_WRITE_LIMITS,
  checkRunsLimit,
} from "@/lib/runs-limits";
import type { SaveRunInput } from "@/lib/runs-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUMMARY_SELECT = {
  id: true,
  name: true,
  createdAt: true,
  seed: true,
  turn: true,
  alive: true,
  gini: true,
  totalWealth: true,
} as const;

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly.", code: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function GET(req: Request) {
  const caller = await getCaller(req);
  const where = ownerWhere(caller);
  // Unidentified caller (no auth, no anon id): returns an empty list rather
  // than every run in the database. The library UI will render "no runs yet"
  // and the first save will mint an anon id on the client side.
  if (!where) return NextResponse.json([]);

  const limit = await checkRunsLimit(
    caller,
    clientIp(req),
    "read",
    RUN_READ_LIMITS(),
  );
  if (!limit.ok) return tooMany(limit.retryAfterSec);

  const runs = await prisma.run.findMany({
    where,
    select: SUMMARY_SELECT,
    orderBy: { createdAt: "desc" },
    take: MAX_RUNS_PER_OWNER,
  });
  return NextResponse.json(runs);
}

export async function POST(req: Request) {
  const caller = await getCaller(req);
  const owner = ownerData(caller);
  if (!owner) {
    return NextResponse.json(
      { error: "Missing anonymous id; saves require a browser session." },
      { status: 401 },
    );
  }

  const limit = await checkRunsLimit(
    caller,
    clientIp(req),
    "write",
    RUN_WRITE_LIMITS(),
  );
  if (!limit.ok) return tooMany(limit.retryAfterSec);

  const parsed = await readJsonBody<Partial<SaveRunInput>>(
    req,
    MAX_RUN_BODY_BYTES,
  );
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  }
  const body = parsed.data;

  const name = sanitizeLine(body.name, MAX_RUN_NAME);
  if (!name) {
    return NextResponse.json({ error: "A name is required" }, { status: 400 });
  }

  const { config } = body;
  if (!config || typeof config !== "object" || typeof config.seed !== "number") {
    return NextResponse.json(
      { error: "Missing or malformed config" },
      { status: 400 },
    );
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const chronicle = Array.isArray(body.chronicle) ? body.chronicle : [];
  if (
    history.length > MAX_HISTORY_POINTS ||
    chronicle.length > MAX_CHRONICLE_ENTRIES
  ) {
    return NextResponse.json(
      { error: "Run is too large to save" },
      { status: 413 },
    );
  }

  const held = await prisma.run.count({ where: ownerWhere(caller) ?? undefined });
  if (held >= MAX_RUNS_PER_OWNER) {
    return NextResponse.json(
      {
        error: `You have reached the limit of ${MAX_RUNS_PER_OWNER} saved runs. Delete one to save another.`,
        code: "quota_exceeded",
      },
      { status: 409 },
    );
  }

  const run = await prisma.run.create({
    data: {
      ...owner,
      name,
      seed: Math.round(clampNumber(config.seed, -2_147_483_648, 2_147_483_647, 0)),
      turn: Math.round(clampNumber(body.turn, 0, 10_000_000, 0)),
      alive: Math.round(clampNumber(body.alive, 0, 10_000_000, 0)),
      gini: clampNumber(body.gini, 0, 1, 0),
      totalWealth: clampNumber(body.totalWealth, 0, Number.MAX_SAFE_INTEGER, 0),
      config: JSON.stringify(config),
      history: JSON.stringify(history),
      chronicle: JSON.stringify(chronicle),
    },
    select: SUMMARY_SELECT,
  });

  return NextResponse.json(run, { status: 201 });
}
