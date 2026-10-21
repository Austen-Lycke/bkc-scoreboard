"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { pillClass } from "@/components/styles";
import { Pill, Tag } from "@/components/ui";
import { validateImport, type ImportRow } from "@/lib/admin/import";
import type { RankDef } from "@/lib/scoring";
import { TableCard, tableHeadClass, tableRowClass } from "../../kit";
import { importShooters } from "../actions";

const COLS = "grid-cols-[4rem_minmax(0,1fr)_12rem_14rem]";
const STATUS: Record<ImportRow["status"], "good" | "fill" | "error"> = { new: "good", duplicate: "fill", error: "error" };
const plural = (n: number) => `${n} ${n === 1 ? "schutter" : "schutters"}`;

export function ImportForm({ ranks, existingKeys }: { ranks: RankDef[]; existingKeys: string[] }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ error?: string; created?: number; skipped?: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const keys = useMemo(() => new Set(existingKeys), [existingKeys]);
  const preview = useMemo(() => (text.trim() ? validateImport(text, { ranks, existingKeys: keys }) : null), [text, ranks, keys]);
  const rows = preview?.rows ?? [];
  const fresh = rows.filter((r) => r.status === "new");
  const errors = rows.filter((r) => r.status === "error").length;
  const rankName = (code: string | null) => ranks.find((r) => r.code === code)?.name;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setResult(null);
    setText(await file.text());
  }

  function submit() {
    startTransition(async () => {
      const r = await importShooters(fresh.map(({ firstName, lastName, rankCode }) => ({ firstName, lastName, rankCode })));
      setResult(r);
      if (!r.error) setText("");
    });
  }

  if (result && !result.error) {
    return (
      <div className="flex max-w-[36rem] flex-col gap-4 rounded-[1.5rem] border border-border bg-surface px-[1.625rem] py-6">
        <p className="text-[1.0625rem] font-semibold">
          {plural(result.created ?? 0)} geïmporteerd{result.skipped ? ` · ${result.skipped} overgeslagen` : ""}.
        </p>
        <div className="flex gap-2">
          <Link href="/admin/schutters" className={pillClass("ink")}>
            Naar de schutters
          </Link>
          <Pill onClick={() => setResult(null)}>Nog een bestand</Pill>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-[0.875rem] rounded-[1.5rem] border border-border bg-surface px-6 py-[1.375rem]">
        <div className="flex flex-wrap items-center gap-3">
          <label className={`${pillClass("ink")} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink`}>
            CSV-bestand kiezen
            <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <span className="text-sm text-muted">of plak de inhoud hieronder</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => (setText(e.target.value), setResult(null))}
          rows={7}
          placeholder="Voornaam;Achternaam;Klasse"
          aria-label="CSV-inhoud"
          className="w-full resize-y rounded-[0.875rem] border-[0.09375rem] border-border bg-background px-[0.875rem] py-3 font-mono text-[0.8125rem] leading-[1.6] outline-none focus:border-ink"
        />
        {preview?.error && <p className="text-[0.8125rem] font-semibold text-error">{preview.error}</p>}
        {result?.error && <p className="text-[0.8125rem] font-semibold text-error">{result.error}</p>}
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="good" size="lg">
              {fresh.length} nieuw
            </Tag>
            <Tag size="lg">{rows.filter((r) => r.status === "duplicate").length} bestaan al</Tag>
            {errors > 0 && (
              <Tag tone="error" size="lg">
                {errors} met fouten · worden overgeslagen
              </Tag>
            )}
            <Pill tone="yellow" size="lg" className="ml-auto" disabled={!fresh.length || pending} onClick={submit}>
              {pending ? "Importeren…" : `${plural(fresh.length)} importeren`}
            </Pill>
          </div>
          <TableCard>
            <div className={`${tableHeadClass} ${COLS}`}>
              <span>Rij</span>
              <span>Naam</span>
              <span>Klasse</span>
              <span>Status</span>
            </div>
            {rows.map((r) => (
              <div key={r.line} className={`${tableRowClass} ${COLS} py-2 text-sm ${r.status === "new" ? "" : "text-faint"}`}>
                <span className="font-mono text-xs text-faint">{r.line}</span>
                <span className="truncate font-semibold">{`${r.firstName} ${r.lastName}`.trim() || "–"}</span>
                <span>
                  {rankName(r.rankCode) ?? r.rankText}
                  {r.rankSource === "default" && <span className="text-xs text-faint"> · standaard</span>}
                </span>
                <span>
                  <Tag tone={STATUS[r.status]}>{r.status === "new" ? "nieuw" : r.message}</Tag>
                </span>
              </div>
            ))}
          </TableCard>
        </>
      )}
    </>
  );
}
