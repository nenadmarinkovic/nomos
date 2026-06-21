"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Client-side Better Auth bindings. Exposes `signIn`, `signUp`, `signOut`,
 * `useSession`, and the rest of the React hooks. Same-origin by default —
 * the catch-all handler lives at `/api/auth/*`.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, getSession } = authClient;
