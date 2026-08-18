import { ANON_ID_HEADER } from "@/lib/anon-id";
import { auth } from "@/lib/auth";

export type Caller =
  | { kind: "user"; userId: string }
  | { kind: "anon"; key: string }
  | { kind: "none" };

export async function getCaller(req: Request): Promise<Caller> {
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

export function ownerWhere(caller: Caller) {
  if (caller.kind === "user") return { ownerId: caller.userId };
  if (caller.kind === "anon") return { ownerKey: caller.key, ownerId: null };
  return null;
}

export function ownerData(
  caller: Caller,
):
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
