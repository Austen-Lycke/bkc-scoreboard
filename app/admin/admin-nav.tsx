"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollRow } from "@/components/scroll-row";

const LINKS = [
  { href: "/admin", label: "Overzicht" },
  { href: "/admin/schutters", label: "Schutters" },
  { href: "/admin/wedstrijden", label: "Wedstrijden" },
  { href: "/admin/seizoenen", label: "Seizoenen" },
  { href: "/admin/opstellingen", label: "Opstellingen" },
  { href: "/admin/gebruikers", label: "Gebruikers", ownerOnly: true },
];

/** Highlights the current section; reads the URL, so it renders inside Suspense. */
export function AdminNav({ owner }: { owner: boolean }) {
  return <NavLinks pathname={usePathname()} owner={owner} />;
}

/** Same links without highlighting: the static fallback while the URL and session are read. */
export function AdminNavFallback() {
  return <NavLinks pathname={null} owner={false} />;
}

function NavLinks({ pathname, owner }: { pathname: string | null; owner: boolean }) {
  return (
    // Phone: one line that scrolls sideways instead of three wrapped lines.
    <ScrollRow as="nav" active={pathname} className="flex items-center gap-1 px-4 pb-2.5 sm:flex-wrap sm:px-8" aria-label="Beheer">
      {LINKS.filter((l) => owner || !l.ownerOnly).map((l) => {
        const active = pathname !== null && (l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex-none whitespace-nowrap rounded-full px-[0.875rem] py-[0.4375rem] text-sm font-semibold transition ${active ? "bg-ink text-white" : "text-ink hover:bg-hover"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </ScrollRow>
  );
}
