import { NextResponse } from "next/server";

import { ANON_ID_HEADER } from "@/lib/anon-id";
import { getCaller } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Transfer ownership of all runs tagged with the caller's anonymous
 * `ownerKey` (sent as `x-nomos-anon-id`) to the caller's authenticated user.
 *
 * Called from the sign-up and sign-in flows so a browser that has been
 * saving anonymously doesn't lose its library the moment it gets an
 * account. Idempotent — runs already owned by a user are not touched, and
 * a missing anon header just returns `{ claimed: 0 }`.
 */
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
