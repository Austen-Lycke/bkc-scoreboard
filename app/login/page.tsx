import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Aanmelden", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted">BKC Wedstrijden</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Aanmelden</h1>
        <p className="mt-1 text-sm text-muted">Voor beheerders en wedstrijdleiding.</p>
        <LoginForm />
      </div>
    </main>
  );
}
