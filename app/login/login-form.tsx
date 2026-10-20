"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) {
      setError("E-mailadres of wachtwoord klopt niet.");
      return;
    }
    router.push("/operator");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        E-mailadres
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus:border-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Wachtwoord
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus:border-ink"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-navy px-4 py-2.5 font-medium text-white transition hover:opacity-90 disabled:opacity-60 dark:bg-gold dark:text-navy"
      >
        {pending ? "Bezig…" : "Aanmelden"}
      </button>
    </form>
  );
}
