import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb, schema } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { NewCompetitionForm } from "./new-competition-form";
import { SignOutButton } from "./sign-out-button";
import { CLUB_TIME_ZONE } from "@/components/public/format";

export const metadata: Metadata = { title: "Wedstrijdleiding", robots: { index: false } };

const STATUS_LABEL: Record<string, string> = {
  draft: "Concept",
  prepared: "Klaar",
  warmup: "Opwarming",
  round1: "Ronde 1",
  break: "Pauze",
  round2: "Ronde 2",
  shootoff: "Afkamping",
  finished: "Afgelopen",
  published: "Gepubliceerd",
};

const dateFormat = new Intl.DateTimeFormat("nl-BE", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: CLUB_TIME_ZONE });

export default function OperatorHome() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-gold">BKC Wedstrijden</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Wedstrijdleiding</h1>
        </div>
        <Link
          href="/operator/live?c=demo"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-gold"
        >
          Demowedstrijd openen (oefenen)
        </Link>
      </header>
      <Suspense fallback={<p className="mt-10 text-muted">Wedstrijden laden…</p>}>
        <Competitions />
      </Suspense>
    </main>
  );
}

async function Competitions() {
  const session = await requireRole("admin", "operator");
  const db = getDb();
  const [rows, setups] = await Promise.all([
    db.select().from(schema.competitions).orderBy(desc(schema.competitions.date)).limit(30),
    db.select({ id: schema.setups.id, name: schema.setups.name }).from(schema.setups),
  ]);

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
      <section>
        <h2 className="text-lg font-semibold">Wedstrijden</h2>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-muted">
            Nog geen wedstrijden. Maak er rechts een aan, of oefen eerst met de demowedstrijd.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-sm text-muted">
                    {dateFormat.format(new Date(`${c.date}T12:00:00`))}
                    {c.location ? ` · ${c.location}` : ""} · {STATUS_LABEL[c.status]}
                  </p>
                </div>
                <Link
                  href={`/operator/live?c=${c.id}`}
                  className="shrink-0 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-gold dark:text-navy"
                >
                  Openen
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-sm text-muted">
          Aangemeld als {session.user.name}
          {session.user.role === "admin" && (
            <>
              {" · "}
              <Link href="/admin" className="underline underline-offset-4 hover:text-foreground">
                Beheer
              </Link>
            </>
          )}{" "}
          · <SignOutButton />
        </p>
      </section>
      <aside>
        <h2 className="text-lg font-semibold">Nieuwe wedstrijd</h2>
        <NewCompetitionForm setups={setups} />
      </aside>
    </div>
  );
}
