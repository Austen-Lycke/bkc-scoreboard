import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { pillClass } from "@/components/styles";
import { readFlash } from "@/lib/server/flash";
import { requireRole } from "@/lib/session";
import { AdminNav, AdminNavFallback } from "./admin-nav";
import { FlashBar } from "./flash-bar";

export const metadata: Metadata = { title: { default: "Beheer", template: "%s · Beheer · BKC" }, robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky from a tablet up; on a phone it would take half the screen, so it scrolls away. */}
      <div className="z-10 bg-background sm:sticky sm:top-0 print:hidden">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 pb-3 pt-[1.125rem] sm:px-8">
          <Link href="/admin" className="flex items-baseline gap-2.5">
            <span className="text-[0.8125rem] font-bold tracking-[0.2em]">BKC</span>
            <span className="text-[0.9375rem] text-muted">Beheer</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/operator" className={pillClass("outline", "sm")}>
              Wedstrijdleiding
            </Link>
            <Link href="/" className={pillClass("outline", "sm")}>
              Website
            </Link>
          </div>
        </header>
        <Suspense fallback={<AdminNavFallback />}>
          <AdminNav />
        </Suspense>
      </div>
      <main className="w-full flex-1 px-4 pb-8 pt-2 sm:px-8 print:p-0">
        <div className="flex max-w-[75rem] flex-col gap-4 print:max-w-none">
          <Suspense fallback={<p className="px-1 text-muted">Laden…</p>}>
            <AdminOnly>
              <Flash />
              {children}
            </AdminOnly>
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function AdminOnly({ children }: { children: React.ReactNode }) {
  await requireRole("admin");
  return children;
}

async function Flash() {
  const flash = await readFlash();
  return flash && <FlashBar key={flash.id} message={flash.message} />;
}
