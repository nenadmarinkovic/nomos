export const UNKNOWN_IP = "unknown";

function hops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function clientIp(req: Request): string {
  const override = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (override) {
    const value = req.headers.get(override)?.split(",")[0]?.trim();
    return value || UNKNOWN_IP;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const picked = chain[chain.length - hops()];
    if (picked) return picked;
    return UNKNOWN_IP;
  }

  return (
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    UNKNOWN_IP
  );
}
