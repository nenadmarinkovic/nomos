export const DEFAULT_NEXT = "/";

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT;

  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return DEFAULT_NEXT;
  }

  value = value.trim();
  if (!value.startsWith("/")) return DEFAULT_NEXT;
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_NEXT;
  if (/[\u0000-\u001f\u007f]/.test(value)) return DEFAULT_NEXT;

  return value;
}
