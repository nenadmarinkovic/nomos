import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getCaller } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Is the caller allowed to act on this run? A signed-in user owns rows
 *  whose `ownerId` matches; an anonymous browser owns rows whose `ownerKey`
 *  matches and have no `ownerId`. Public runs (gallery) are visible to
 *  anyone for read, regardless of caller. */
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

export async function GET(req: Request, { params }: Context) {
  const { id } = await params;
  const caller = await getCaller(req);
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
