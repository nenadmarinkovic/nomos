import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getCaller } from "@/lib/api-auth";
import { clientIp } from "@/lib/client-ip";
import {
  RUN_READ_LIMITS,
  RUN_WRITE_LIMITS,
  checkRunsLimit,
} from "@/lib/runs-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

type Caller = Awaited<ReturnType<typeof getCaller>>;

function canRead(
  run: { ownerId: string | null; ownerKey: string | null; isPublic: boolean },
  caller: Caller,
): boolean {
  if (run.isPublic) return true;
  if (caller.kind === "user") return run.ownerId === caller.userId;
  if (caller.kind === "anon")
    return run.ownerId === null && run.ownerKey === caller.key;
  return false;
}

function canWrite(
  run: { ownerId: string | null; ownerKey: string | null },
  caller: Caller,
): boolean {
  if (caller.kind === "user") return run.ownerId === caller.userId;
  if (caller.kind === "anon")
    return run.ownerId === null && run.ownerKey === caller.key;
  return false;
}

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly.", code: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function GET(req: Request, { params }: Context) {
  const { id } = await params;
  const caller = await getCaller(req);

  const limit = await checkRunsLimit(
    caller,
    clientIp(req),
    "read-one",
    RUN_READ_LIMITS(),
  );
  if (!limit.ok) return tooMany(limit.retryAfterSec);

  const run = await prisma.run.findUnique({ where: { id } });
  if (!run || !canRead(run, caller)) {
    // 404 (not 403) when the caller doesn't own the row: don't leak the
    // existence of someone else's saved run.
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: run.id,
    name: run.name,
    createdAt: run.createdAt,
    seed: run.seed,
    turn: run.turn,
    alive: run.alive,
    gini: run.gini,
    totalWealth: run.totalWealth,
    config: JSON.parse(run.config),
    history: JSON.parse(run.history),
    chronicle: JSON.parse(run.chronicle),
  });
}

export async function DELETE(req: Request, { params }: Context) {
  const { id } = await params;
  const caller = await getCaller(req);

  const limit = await checkRunsLimit(
    caller,
    clientIp(req),
    "write",
    RUN_WRITE_LIMITS(),
  );
  if (!limit.ok) return tooMany(limit.retryAfterSec);

  const run = await prisma.run.findUnique({
    where: { id },
    select: { ownerId: true, ownerKey: true },
  });
  if (!run || !canWrite(run, caller)) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  await prisma.run.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
