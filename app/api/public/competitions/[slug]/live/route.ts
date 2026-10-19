import { getLiveView } from "@/lib/server/public-data";

/**
 * Live data for the public competition page, polled every few seconds by every viewer.
 * The CDN keeps each response for a few seconds, so the database sees at most a handful of
 * requests per competition no matter how many people follow along.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/public/competitions/[slug]/live">) {
  const { slug } = await ctx.params;
  const view = await getLiveView(slug);
  if (!view) return Response.json({ error: "Wedstrijd niet gevonden" }, { status: 404 });
  return Response.json(view, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=15" },
  });
}
