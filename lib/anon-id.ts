/**
 * Per-browser opaque id used to scope anonymous saves.
 *
 * v0.4 dual-mode persistence: a run is owned by either a `User` (signed in)
 * or an `ownerKey` (anonymous). The `ownerKey` lives here, in localStorage,
 * generated on first save. When the browser later signs up we POST it to
 * `/api/runs/claim` so the user's anonymous runs follow them.
 *
 * The id is sent on every API call as the `x-nomos-anon-id` header; the
 * server only reads it when no authenticated session is present.
 */

const STORAGE_KEY = "nomos-anon-id";
export const ANON_ID_HEADER = "x-nomos-anon-id";

/** Read the current anonymous id without creating one. SSR-safe. */
export function peekAnonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Read or create the anonymous id. Idempotent; the same browser always
 *  resolves to the same id. SSR-safe (returns null on the server). */
export function ensureAnonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = generateAnonId();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/** Drop the anonymous id. Called after a successful claim so the next
 *  anonymous save (e.g. after sign-out) gets a fresh bucket. */
export function clearAnonId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Headers helper: returns `{ [ANON_ID_HEADER]: id }` or `{}` if no id yet
 *  (lets read-only first visits go through without minting one). */
export function anonIdHeaders(create: boolean = false): HeadersInit {
  const id = create ? ensureAnonId() : peekAnonId();
  return id ? { [ANON_ID_HEADER]: id } : {};
}

/**
 * Compact url-safe id roughly cuid-shaped: timestamp prefix + 16 chars of
 * entropy. Not cryptographically derived (an attacker who guesses your id
 * can read your anonymous runs), but they have no other vector to obtain
 * one — and the moment the user signs up, ownership becomes proper.
 */
function generateAnonId(): string {
  const ts = Date.now().toString(36);
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return `anon_${ts}${rand}`;
}
