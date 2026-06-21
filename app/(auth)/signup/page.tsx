"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { clearAnonId } from "@/lib/anon-id";
import { signUp } from "@/lib/auth-client";
import { claimAnonRuns } from "@/lib/runs-api";

export default function SignUpPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await signUp.email({
      email,
      password,
      name: name.trim() || email.split("@")[0],
    });
    if (res.error) {
      setPending(false);
      setError(res.error.message ?? "Sign-up failed.");
      return;
    }

    // Auto-signed-in by Better Auth. Try to migrate this browser's anonymous
    // runs into the new account; best-effort — if it fails we still continue.
    try {
      const claimed = await claimAnonRuns();
      if (claimed > 0) clearAnonId();
    } catch {
      /* claim is best-effort; sign-up succeeded */
    }

    setPending(false);
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 text-center">
        <h1 className="font-serif text-3xl leading-tight tracking-tight">
          Create an account
        </h1>
        <p className="font-serif text-[14px] leading-relaxed text-muted-foreground">
          Keep your runs across devices and revisit the Chronicle.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field
          label="Name (optional)"
          type="text"
          autoComplete="name"
          value={name}
          onChange={setName}
        />
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
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          required
          minLength={8}
        />

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/[0.05] px-3 py-2 font-sans text-[12px] leading-snug text-destructive"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          className="h-10 w-full px-3 text-[14px]"
        >
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center font-sans text-[13px] text-muted-foreground">
        Already have one?{" "}
        <Link
          href={`/signin${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
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
      <span className="block font-sans text-[12px] font-medium text-foreground/85">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="mt-1 block h-10 w-full rounded-md border border-foreground/15 bg-card/50 px-3 font-sans text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40 focus:bg-card"
      />
    </label>
  );
}
