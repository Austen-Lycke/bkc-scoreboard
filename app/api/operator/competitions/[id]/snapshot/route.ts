import { sessionWithRole } from "@/lib/server/auth-guard";
import { buildSnapshot } from "@/lib/server/snapshot";

export async function GET(request: Request, ctx: RouteContext<"/api/operator/competitions/[id]/snapshot">) {
  const auth = await sessionWithRole(request, "admin", "operator");
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  const snapshot = await buildSnapshot(id);
  if (!snapshot) return Response.json({ error: "Wedstrijd niet gevonden" }, { status: 404 });
  return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
