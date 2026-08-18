import { NextResponse } from "next/server";

import { ANON_ID_HEADER } from "@/lib/anon-id";
import { getCaller } from "@/lib/api-auth";
import { clientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { RUN_CLAIM_LIMITS, checkRunsLimit } from "@/lib/runs-limits";

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

  const limit = await checkRunsLimit(
    caller,
    clientIp(req),
    "claim",
    RUN_CLAIM_LIMITS(),
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly.", code: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
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
