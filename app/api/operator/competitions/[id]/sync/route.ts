import { revalidateTag } from "next/cache";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { sessionWithRole } from "@/lib/server/auth-guard";
import { applySync } from "@/lib/server/sync";

const body = z.object({
  deviceId: z.string().min(1).max(100),
  takeover: z.boolean().optional(),
  events: z.array(z.unknown()).max(500),
});

/** The operator laptop pushes its event log here (in batches) whenever it has a connection. */
export async function POST(request: Request, ctx: RouteContext<"/api/operator/competitions/[id]/sync">) {
  const auth = await sessionWithRole(request, "admin", "operator");
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Wedstrijd niet gevonden" }, { status: 404 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ongeldige aanvraag" }, { status: 400 });

  const result = await applySync({
    competitionId: id,
    deviceId: parsed.data.deviceId,
    takeover: parsed.data.takeover ?? false,
    events: parsed.data.events,
    mayEditClosedSeason: hasRole(auth.session.user.role, "admin"),
  });
  if (result.kind === "not_found") return Response.json({ error: "Wedstrijd niet gevonden" }, { status: 404 });
  if (result.kind === "lease") {
    return Response.json({ error: "Een ander toestel beheert deze wedstrijd", holder: result.holder, since: result.since }, { status: 409 });
  }
  if (result.kind === "closed") {
    return Response.json({ error: `Seizoen ${result.seasonYear} is afgesloten: alleen een beheerder kan deze wedstrijd nog aanpassen` }, { status: 423 });
  }
  // Public pages for this competition, its season and the shooters: fresh on the next visit.
  for (const tag of result.tags) revalidateTag(tag, { expire: 0 });
  const { accepted, invalid, rejected, status } = result;
  return Response.json({ accepted, invalid, rejected, status }, { headers: { "Cache-Control": "no-store" } });
}
