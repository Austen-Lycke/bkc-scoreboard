import { z } from "zod";
import { buildState, resultsCsv } from "@/lib/competition";
import { sessionWithRole } from "@/lib/server/auth-guard";
import { buildSnapshot } from "@/lib/server/snapshot";

/** Results with full names as CSV (admins only). */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/export/competitions/[id]">) {
  const auth = await sessionWithRole(request, "admin");
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Niet gevonden" }, { status: 404 });
  const snapshot = await buildSnapshot(id);
  if (!snapshot) return Response.json({ error: "Niet gevonden" }, { status: 404 });
  return new Response(resultsCsv(buildState(snapshot)), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${snapshot.competition.slug}-uitslag.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
