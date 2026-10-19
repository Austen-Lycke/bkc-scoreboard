import { and, asc, eq } from "drizzle-orm";
import { formatBelgianDate } from "@/components/public/format";
import { toCsv } from "@/lib/csv";
import { getDb, schema } from "@/lib/db";
import { sessionWithRole } from "@/lib/server/auth-guard";
import { currentSeasonYear, rankDefs } from "@/lib/server/season";

/** The member list as CSV, in the same format the import accepts. */
export async function GET(request: Request) {
  const auth = await sessionWithRole(request, "admin");
  if (auth.error) return auth.error;
  const { shooters, shooterSeasonRanks } = schema;
  const [year, ranks] = await Promise.all([currentSeasonYear(), rankDefs()]);
  const rows = await getDb()
    .select({ s: shooters, rankCode: shooterSeasonRanks.rankCode })
    .from(shooters)
    .leftJoin(shooterSeasonRanks, and(eq(shooterSeasonRanks.shooterId, shooters.id), eq(shooterSeasonRanks.seasonYear, year)))
    .orderBy(asc(shooters.lastName), asc(shooters.firstName));
  const csv = toCsv([
    ["Voornaam", "Achternaam", "Geboortedatum", "Klasse", "Actief", "Notities"],
    ...rows.map(({ s, rankCode }) => [
      s.firstName,
      s.lastName,
      formatBelgianDate(s.birthdate),
      ranks.find((r) => r.code === rankCode)?.name ?? "",
      s.active ? "ja" : "nee",
      s.notes ?? "",
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bkc-schutters-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
