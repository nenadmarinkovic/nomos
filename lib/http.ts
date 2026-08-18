export type BodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export async function readJsonBody<T>(
  req: Request,
  maxBytes: number,
): Promise<BodyResult<T>> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large" };
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, status: 400, error: "Could not read request body" };
  }

  if (byteLength(raw) > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large" };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body" };
  }
}

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function sanitizeLine(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
