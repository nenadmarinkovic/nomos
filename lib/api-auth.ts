import { ANON_ID_HEADER } from "@/lib/anon-id";
import { auth } from "@/lib/auth";

/**
 * Who is making this API request? `user` when a Better Auth session cookie
 * resolves, otherwise `anon` if an `x-nomos-anon-id` header is present,
 * otherwise `none`.
 *
 * The two-mode invariant the DB enforces (exactly one of `ownerId` /
 * `ownerKey`) is mirrored here as a tagged union. Routes can ship the result
 * straight into Prisma `where` / `data` clauses.
 */
export type Caller =
  | { kind: "user"; userId: string }
  | { kind: "anon"; key: string }
  | { kind: "none" };

/** Resolve the caller from request headers. */
export async function getCaller(req: Request): Promise<Caller> {
  // Authenticated session wins over an anon header — a signed-in user might
  // still have `nomos-anon-id` in localStorage from before they signed up.
  const session = await auth.api.getSession({ headers: req.headers });
  if (session?.user?.id) {
    return { kind: "user", userId: session.user.id };
  }
  const anon = req.headers.get(ANON_ID_HEADER);
  if (anon && anon.length > 0 && anon.length <= 64) {
    return { kind: "anon", key: anon };
  }
  return { kind: "none" };
}

/** A Prisma `where` fragment scoping a row to the current caller's runs.
 *  Returns null for unauthenticated read-only callers (they get nothing). */
export function ownerWhere(caller: Caller) {
  if (caller.kind === "user") return { ownerId: caller.userId };
  if (caller.kind === "anon") return { ownerKey: caller.key, ownerId: null };
  return null;
}

/** The ownership fields to stamp on a new row. */
export function ownerData(caller: Caller):
  | { ownerId: string; ownerKey: null }
  | { ownerId: null; ownerKey: string }
  | null {
  if (caller.kind === "user") {
    return { ownerId: caller.userId, ownerKey: null };
  }
  if (caller.kind === "anon") {
    return { ownerId: null, ownerKey: caller.key };
  }
  return null;
}
