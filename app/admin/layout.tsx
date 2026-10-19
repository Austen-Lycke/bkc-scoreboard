import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireRole } from "@/lib/session";
import { AdminNav, AdminNavFallback } from "./admin-nav";

export const metadata: Metadata = { title: { default: "Beheer", template: "%s · Beheer · BKC" }, robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-navy text-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-4 sm:px-6">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-[0.2em] text-gold">BKC</span>
            <span className="font-medium text-white/85">Beheer</span>
          </Link>
          <div className="flex gap-4 text-sm text-white/70">
            <Link href="/operator" className="hover:text-white">
              Wedstrijdleiding
            </Link>
            <Link href="/" className="hover:text-white">
              Website
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-2 sm:px-4">
          <Suspense fallback={<AdminNavFallback />}>
            <AdminNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-muted">Laden…</p>}>
          <AdminOnly>{children}</AdminOnly>
        </Suspense>
      </main>
    </div>
  );
}

async function AdminOnly({ children }: { children: React.ReactNode }) {
  await requireRole("admin");
  return children;
}
