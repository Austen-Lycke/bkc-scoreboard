import { and, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { textLinkClass } from "@/components/styles";
import { getDb, schema } from "@/lib/db";
import { currentSeasonYear, rankDefs } from "@/lib/server/season";
import { requireRole } from "@/lib/session";
import { PageHead } from "../../kit";
import { ShooterForm } from "../shooter-form";

export const metadata: Metadata = { title: "Schutter bewerken" };

export default async function EditShooterPage({ params }: PageProps<"/admin/schutters/[id]">) {
  await requireRole("admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [year, ranks, shooter] = await Promise.all([currentSeasonYear(), rankDefs(), db.query.shooters.findFirst({ where: eq(schema.shooters.id, id) })]);
  if (!shooter) notFound();
  const [seasonRank, [{ n: competitions }]] = await Promise.all([
    db.query.shooterSeasonRanks.findFirst({ where: and(eq(schema.shooterSeasonRanks.shooterId, id), eq(schema.shooterSeasonRanks.seasonYear, year)) }),
    db.select({ n: count() }).from(schema.entries).where(eq(schema.entries.shooterId, id)),
  ]);

  return (
    <>
      <PageHead back={{ href: "/admin/schutters", label: "Schutters" }} title={`${shooter.firstName} ${shooter.lastName}`}>
        <Link href={`/schutter/${id}`} className={`self-start ${textLinkClass}`}>
          Publiek profiel bekijken
        </Link>
      </PageHead>
      <ShooterForm
        values={{ id, firstName: shooter.firstName, lastName: shooter.lastName, active: shooter.active, notes: shooter.notes ?? "", rankCode: seasonRank?.rankCode ?? "" }}
        ranks={ranks.map(({ code, name }) => ({ code, name }))}
        seasonYear={year}
        competitions={competitions}
      />
    </>
  );
}
