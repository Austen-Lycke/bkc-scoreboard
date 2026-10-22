import "server-only";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { WSA_LANES, WSA_V1, WSA_V2, wsaFormat, type CompetitionFormat, type Setup } from "@/lib/scoring";

/** The WSA choices on the new-competition and edit forms. */
export const wsaInput = z.object({
  lanes: z.coerce.number().int().min(1, "Minstens 1 schutter tegelijk").max(30, "Hoogstens 30 schutters tegelijk").default(WSA_LANES),
  round1: z.string().max(80).optional(),
  round2: z.string().max(80).optional(),
  semifinal: z.boolean(),
  final: z.boolean(),
});

export function readWsaForm(form: FormData) {
  return wsaInput.safeParse({
    lanes: form.get("lanes") || undefined,
    round1: form.get("setup:round1") || undefined,
    round2: form.get("setup:round2") || undefined,
    semifinal: form.get("semifinal") === "on",
    final: form.get("final") === "on",
  });
}

/**
 * A WSA day with the club's current setups (so edited points apply): round 1 on variant 1, round 2
 * and the knockout on variant 2, unless other setups were picked. Every rank gets the round-1 setup.
 */
export async function wsaCompetitionFormat(input: z.infer<typeof wsaInput>): Promise<{ format: CompetitionFormat; setupByRank: Record<string, Setup> }> {
  const db = getDb();
  const [setupRows, rankRows] = await Promise.all([db.select().from(schema.setups), db.select().from(schema.ranks)]);
  const setup = (id: string | undefined, fallback: Setup) => setupRows.find((s) => s.id === (id ?? fallback.id))?.definition ?? fallback;
  const round1 = setup(input.round1, WSA_V1);
  const format = wsaFormat(rankRows, { lanes: input.lanes, round1, round2: setup(input.round2, WSA_V2), semifinal: input.semifinal, final: input.final });
  return { format, setupByRank: Object.fromEntries(rankRows.map((r) => [r.code, round1])) };
}
