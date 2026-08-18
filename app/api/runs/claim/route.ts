import { NextResponse } from "next/server";

import { ANON_ID_HEADER } from "@/lib/anon-id";
import { getCaller } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const caller = await getCaller(req);
  if (caller.kind !== "user") {
    return NextResponse.json(
      { error: "Sign in to claim runs." },
      { status: 401 },
    );
  }

  const anonKey = req.headers.get(ANON_ID_HEADER);
  if (!anonKey) return NextResponse.json({ claimed: 0 });

  const result = await prisma.run.updateMany({
    where: { ownerKey: anonKey, ownerId: null },
    data: { ownerId: caller.userId, ownerKey: null },
  });

  return NextResponse.json({ claimed: result.count });
}
