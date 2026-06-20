import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  const { id } = await params;
  const run = await prisma.run.findUnique({ where: { id } });
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  // Stored JSON columns are rehydrated into the shapes the client expects.
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

export async function DELETE(_req: Request, { params }: Context) {
  const { id } = await params;
  try {
    await prisma.run.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
