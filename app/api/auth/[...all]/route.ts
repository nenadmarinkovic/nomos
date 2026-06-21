import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

/**
 * Catch-all Better Auth handler. Mounts /api/auth/sign-in,
 * /api/auth/sign-up, /api/auth/sign-out, /api/auth/get-session and the
 * rest of Better Auth's routes under one Next handler.
 */
export const runtime = "nodejs";
export const { GET, POST } = toNextJsHandler(auth);
