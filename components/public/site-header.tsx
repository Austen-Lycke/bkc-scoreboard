"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useClubClock } from "@/components/use-now";

const NAV = [
  { href: "/", label: "Live", dot: true },
  { href: "/kalender", label: "Kalender", dot: false },
  { href: "/klassement", label: "Klassement", dot: false },
] as const;

/** Which tab is lit: a competition belongs to Live, a shooter to the ranking. */
function activeHref(path: string) {
  if (path.startsWith("/kalender")) return "/kalender";
  if (path.startsWith("/klassement") || path.startsWith("/schutter")) return "/klassement";
  return "/";
}

/** On a phone only "BKC" and the tabs: no club name, no clock. */
export function SiteHeader() {
  const time = useClubClock();
  return (
    <header className="border-b-2 border-border">
      <div className="mx-auto box-border flex max-w-[75rem] items-center gap-[clamp(0.75rem,3cqw,2.5rem)] px-[clamp(1rem,4cqw,2.5rem)] py-3">
        <Link href="/" className="text-[clamp(1.25rem,2cqw,1.625rem)] font-bold leading-none tracking-[0.2em]">
          BKC
        </Link>
        <span className="whitespace-nowrap text-xl text-muted max-md:hidden">Brugse Katapultclub</span>
        {/* The path is only known at request time: the tabs light up once it streams in. */}
        <Suspense fallback={<Nav active={null} />}>
          <PathNav />
        </Suspense>
        <span className="min-w-[2.75rem] font-mono text-[1.0625rem] text-muted max-md:hidden">{time}</span>
      </div>
    </header>
  );
}

function PathNav() {
  return <Nav active={activeHref(usePathname())} />;
}

function Nav({ active }: { active: string | null }) {
  return (
    <nav className="ml-auto flex gap-1">
      {NAV.map((n) => {
        const on = n.href === active;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`inline-flex min-h-11 items-center gap-2 rounded-pill px-[clamp(0.75rem,1.6cqw,1.125rem)] text-[clamp(0.9375rem,1.4cqw,1.0625rem)] font-semibold ${
              on ? "bg-ink text-white" : "hover:bg-fill"
            }`}
          >
            {n.dot && <span className="size-2 rounded-full bg-live" />}
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
