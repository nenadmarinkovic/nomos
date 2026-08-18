"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { clearAnonId } from "@/lib/anon-id";
import { signIn } from "@/lib/auth-client";
import { claimAnonRuns } from "@/lib/runs-api";

export default function SignInPage() {
  // useSearchParams() forces client-side rendering, so the form must sit
  // inside a Suspense boundary for the route to prerender.
  return (
    <Suspense fallback={<AuthFormFallback />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await signIn.email({ email, password });
    if (res.error) {
      setPending(false);
      setError(res.error.message ?? "Sign-in failed.");
      return;
    }

    try {
      const claimed = await claimAnonRuns();
      if (claimed > 0) clearAnonId();
    } catch {}

    setPending(false);
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-7">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">
          Welcome back
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sign in to access your saved runs and the Chronicle.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          required
          minLength={8}
        />

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/[0.05] px-3 py-2 text-sm leading-snug text-destructive"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="mt-1 h-11 w-full text-sm"
        >
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <Link
          href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

function AuthFormFallback() {
  return (
    <div className="space-y-7" aria-hidden>
      <div className="space-y-2 text-center">
        <div className="mx-auto h-7 w-40 rounded bg-foreground/[0.06]" />
        <div className="mx-auto h-4 w-64 rounded bg-foreground/[0.04]" />
      </div>
      <div className="space-y-4">
        <div className="h-[68px] rounded-md bg-foreground/[0.04]" />
        <div className="h-[68px] rounded-md bg-foreground/[0.04]" />
        <div className="h-11 rounded-md bg-foreground/[0.06]" />
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  minLength,
}: {
  label: string;
  type: "email" | "password" | "text";
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground/85">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="block h-11 w-full rounded-md border border-foreground/15 bg-card/50 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:bg-card"
      />
    </label>
  );
}
