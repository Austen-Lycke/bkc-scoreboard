import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { shooterIdsWithEntries } from "@/lib/server/admin";
import { currentSeasonYear, rankDefs } from "@/lib/server/season";
import { requireRole } from "@/lib/session";
import { ShooterForm } from "../shooter-form";

export const metadata: Metadata = { title: "Schutter bewerken" };

export default async function EditShooterPage({ params }: PageProps<"/admin/schutters/[id]">) {
  await requireRole("admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [year, ranks, shooter] = await Promise.all([currentSeasonYear(), rankDefs(), db.query.shooters.findFirst({ where: eq(schema.shooters.id, id) })]);
  if (!shooter) notFound();
  const [seasonRank, withEntries] = await Promise.all([
    db.query.shooterSeasonRanks.findFirst({ where: and(eq(schema.shooterSeasonRanks.shooterId, id), eq(schema.shooterSeasonRanks.seasonYear, year)) }),
    shooterIdsWithEntries([id]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/schutters" className="text-sm text-muted hover:text-foreground">
          ← Schutters
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {shooter.firstName} {shooter.lastName}
        </h1>
        <Link href={`/schutter/${id}`} className="text-sm text-gold hover:underline">
          Publiek profiel bekijken
        </Link>
      </div>
      <ShooterForm
        values={{ id, firstName: shooter.firstName, lastName: shooter.lastName, birthdate: shooter.birthdate, active: shooter.active, notes: shooter.notes ?? "", rankCode: seasonRank?.rankCode ?? "" }}
        ranks={ranks}
        seasonYear={year}
        canDelete={!withEntries.has(id)}
      />
    </div>
  );
}
