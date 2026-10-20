/** Excel runs a cell that starts with one of these as a formula. Numbers and a lone "-" are fine. */
const FORMULA = /^[=+\-@\t\r]/;
const NUMBER = /^[+-]?\d+([.,]\d+)?$/;

/**
 * CSV for Belgian Excel: semicolon separated, UTF-8 with BOM. Names are typed in at the venue, so
 * a cell that would run as a formula ("=HYPERLINK(…)") gets a leading apostrophe; parseCsv drops
 * it again on import.
 */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const escape = (v: string | number | null | undefined) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (s.length > 1 && FORMULA.test(s) && !NUMBER.test(s)) s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return "\uFEFF" + rows.map((r) => r.map(escape).join(";")).join("\r\n") + "\r\n";
}

/**
 * Parses CSV as exported by Excel or Google Sheets: `;`, `,` or tab separated (detected from the
 * first line), quoted fields with doubled quotes, optional BOM, blank lines skipped.
 */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","].map((d) => ({ d, n: firstLine.split(d).length })).sort((a, b) => b.n - a.n)[0].d;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows.map((r) => r.map((f) => f.trim().replace(/^'(?=[=+\-@])/, "")));
}
