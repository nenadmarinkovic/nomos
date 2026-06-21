import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getCaller, ownerData, ownerWhere } from "@/lib/api-auth";
import type { SaveRunInput } from "@/lib/runs-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fields returned for the library list — metadata only, no heavy payload. */
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

export async function GET(req: Request) {
  const caller = await getCaller(req);
  const where = ownerWhere(caller);
  // Unidentified caller (no auth, no anon id): returns an empty list rather
  // than every run in the database. The library UI will render "no runs yet"
  // and the first save will mint an anon id on the client side.
  if (!where) return NextResponse.json([]);

  const runs = await prisma.run.findMany({
    where,
    select: SUMMARY_SELECT,
    orderBy: { createdAt: "desc" },
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

  let body: Partial<SaveRunInput>;
  try {
    body = (await req.json()) as Partial<SaveRunInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { config, turn, alive, gini, totalWealth, history, chronicle } = body;
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "A name is required" }, { status: 400 });
  }
  if (!config || typeof config.seed !== "number") {
    return NextResponse.json(
      { error: "Missing or malformed config" },
      { status: 400 },
    );
  }

  const run = await prisma.run.create({
    data: {
      ...owner,
      name,
      seed: config.seed,
      turn: turn ?? 0,
      alive: alive ?? 0,
      gini: gini ?? 0,
      totalWealth: totalWealth ?? 0,
      config: JSON.stringify(config),
      history: JSON.stringify(history ?? []),
      chronicle: JSON.stringify(chronicle ?? []),
    },
    select: SUMMARY_SELECT,
  });

  return NextResponse.json(run, { status: 201 });
}
