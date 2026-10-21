"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overzicht" },
  { href: "/admin/schutters", label: "Schutters" },
  { href: "/admin/wedstrijden", label: "Wedstrijden" },
  { href: "/admin/seizoenen", label: "Seizoenen" },
  { href: "/admin/opstellingen", label: "Opstellingen" },
  { href: "/admin/gebruikers", label: "Gebruikers" },
];

/** Highlights the current section; reads the URL, so it renders inside Suspense. */
export function AdminNav() {
  return <NavLinks pathname={usePathname()} />;
}

/** Same links without highlighting: the static fallback while the URL is read. */
export function AdminNavFallback() {
  return <NavLinks pathname={null} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 px-4 pb-2.5 sm:px-8" aria-label="Beheer">
      {LINKS.map((l) => {
        const active = pathname !== null && (l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-[0.875rem] py-[0.4375rem] text-sm font-semibold transition ${active ? "bg-ink text-white" : "text-ink hover:bg-hover"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
