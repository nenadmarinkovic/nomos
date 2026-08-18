const STORAGE_KEY = "nomos-anon-id";
export const ANON_ID_HEADER = "x-nomos-anon-id";

export function peekAnonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

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

export function clearAnonId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

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
