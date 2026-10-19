"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Badge, Button } from "@/components/ui";
import { formatBelgianDate } from "@/components/public/format";
import { validateImport } from "@/lib/admin/import";
import type { RankDef } from "@/lib/scoring";
import { importShooters } from "../actions";

const EXAMPLE = "Voornaam;Achternaam;Geboortedatum;Klasse\nJan;Peeters;14/03/1979;2de klasse\nLotte;Maes;02/09/2012;";

export function ImportForm({ ranks, seasonYear, existingKeys }: { ranks: RankDef[]; seasonYear: number; existingKeys: string[] }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ error?: string; created?: number; skipped?: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const keys = useMemo(() => new Set(existingKeys), [existingKeys]);
  const preview = useMemo(() => (text.trim() ? validateImport(text, { ranks, existingKeys: keys, seasonYear }) : null), [text, ranks, keys, seasonYear]);
  const fresh = preview?.rows.filter((r) => r.status === "new") ?? [];
  const errors = preview?.rows.filter((r) => r.status === "error") ?? [];
  const rankName = (code: string | null) => ranks.find((r) => r.code === code)?.name ?? "";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setText(await file.text());
  }

  function submit() {
    startTransition(async () => {
      const r = await importShooters(fresh.map(({ firstName, lastName, birthdate, rankCode }) => ({ firstName, lastName, birthdate, rankCode })));
      setResult(r);
      if (!r.error) setText("");
    });
  }

  if (result && !result.error) {
    return (
      <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-border bg-surface p-6">
        <p className="text-lg font-semibold">{result.created} schutter(s) geïmporteerd.</p>
        {!!result.skipped && <p className="text-muted">{result.skipped} overgeslagen omdat ze intussen al bestonden.</p>}
        <div className="flex gap-2">
          <Link href="/admin/schutters" className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white dark:bg-gold dark:text-navy">
            Naar de schutters
          </Link>
          <Button onClick={() => setResult(null)}>Nog een bestand</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-gold dark:text-navy">
          CSV-bestand kiezen
          <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <span className="text-sm text-muted">of plak de inhoud hieronder</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => (setText(e.target.value), setResult(null))}
        rows={6}
        placeholder={EXAMPLE}
        className="w-full rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus:border-gold"
        aria-label="CSV-inhoud"
      />

      {preview?.error && <p className="text-sm text-red-600">{preview.error}</p>}
      {result?.error && <p className="text-sm text-red-600">{result.error}</p>}

      {preview && !preview.error && preview.rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="green">{fresh.length} nieuw</Badge>
            <Badge>{preview.rows.filter((r) => r.status === "duplicate").length} bestaan al</Badge>
            {errors.length > 0 && <Badge tone="red">{errors.length} met fouten (worden overgeslagen)</Badge>}
            <Button tone="primary" className="ml-auto" disabled={!fresh.length || pending} onClick={submit}>
              {pending ? "Importeren…" : `${fresh.length} schutter(s) importeren`}
            </Button>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-3 py-2">Rij</th>
                  <th className="px-3 py-2">Naam</th>
                  <th className="px-3 py-2">Geboren</th>
                  <th className="px-3 py-2">Klasse</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className={`border-b border-border last:border-0 ${r.status === "new" ? "" : "text-muted"}`}>
                    <td className="px-3 py-1.5 tabular-nums">{r.line}</td>
                    <td className="px-3 py-1.5">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">{/^\d{4}-\d{2}-\d{2}$/.test(r.birthdate) ? formatBelgianDate(r.birthdate) : r.birthdate}</td>
                    <td className="px-3 py-1.5">
                      {rankName(r.rankCode)}
                      {r.rankCode && r.rankSource === "age" && <span className="ml-1 text-xs text-muted">(op leeftijd)</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.status === "new" ? <Badge tone="green">nieuw</Badge> : r.status === "duplicate" ? <Badge>bestaat al</Badge> : <Badge tone="red">{r.message}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
