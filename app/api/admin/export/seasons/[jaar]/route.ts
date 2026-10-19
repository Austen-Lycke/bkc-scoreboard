import { toCsv } from "@/lib/csv";
import { fullName, nextRank, PROMOTE_COUNT } from "@/lib/scoring";
import { sessionWithRole } from "@/lib/server/auth-guard";
import { computeSeason, RULE_LABEL } from "@/lib/server/season";

/** Season ranking with full names as CSV (admins only). */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/export/seasons/[jaar]">) {
  const auth = await sessionWithRole(request, "admin");
  if (auth.error) return auth.error;
  const year = Number((await ctx.params).jaar);
  if (!Number.isInteger(year)) return Response.json({ error: "Ongeldig seizoen" }, { status: 400 });
  const { rule, ranks, standings, people } = await computeSeason(year);
  const rows: (string | number)[][] = [[`Klassement ${year}`, RULE_LABEL(rule)], [], ["Klasse", "Plaats", "Naam", "Wedstrijden", "Punten", "Opmerking"]];
  for (const rank of ranks) {
    const promotes = !rank.isJunior && nextRank(ranks, rank.code) !== null;
    for (const row of standings.get(rank.code) ?? []) {
      const p = people.get(row.shooterId);
      rows.push([
        rank.name,
        row.position ?? "",
        p ? fullName(p) : "",
        row.participations,
        String(Math.round(row.points * 10) / 10).replace(".", ","),
        !row.eligible ? "te weinig wedstrijden" : promotes && row.position !== null && row.position <= PROMOTE_COUNT ? "promotie" : "",
      ]);
    }
  }
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bkc-klassement-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
