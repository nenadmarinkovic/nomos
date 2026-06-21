import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { prisma } from "@/lib/db";

/**
 * Server-side Better Auth instance. The catch-all route at
 * `app/api/auth/[...all]/route.ts` exposes the handlers; pages and API
 * routes call `auth.api.getSession({ headers })` to resolve the current
 * user.
 *
 * v0.4 starts with email + password. OAuth providers (GitHub, Google) can
 * slot in later by adding `socialProviders` here — the `Account` table is
 * already shaped for it.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day of use
  },
});

export type Session = typeof auth.$Infer.Session;
