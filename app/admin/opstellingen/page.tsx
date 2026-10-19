import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb, schema } from "@/lib/db";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Opstellingen" };

export default async function SetupsPage() {
  const setups = await getDb().select().from(schema.setups).orderBy(asc(schema.setups.name));
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Opstellingen</h1>
      <p className="max-w-2xl text-muted">
        De knockdowns met hun doelen. De naam is wat de scheidsrechter roept bij afkamping. Wijzigingen gelden voor nieuwe wedstrijden;
        een wedstrijd houdt de opstelling waarmee ze aangemaakt is.
      </p>
      <div className="grid gap-6 xl:grid-cols-2">
        {setups.map((s) => (
          <SetupForm key={s.id} id={s.id} setup={s.definition} />
        ))}
      </div>
    </div>
  );
}
