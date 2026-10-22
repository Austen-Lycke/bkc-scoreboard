/** Juniors are minors: online they're shown as "Voornaam L.". The venue TV may use full names. */
export function publicDisplayName(
  person: { firstName: string; lastName: string },
  isJunior: boolean,
): string {
  const first = person.firstName.trim();
  const last = person.lastName.trim();
  if (!isJunior) return `${first} ${last}`.trim();
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName.trim()} ${person.lastName.trim()}`.trim();
}

/** Particles that stay lowercase inside a Flemish surname: "Van den Broeck", "Van der Linden". */
const PARTICLES = new Set(["den", "der", "de", "het", "ten", "ter", "la", "le"]);

/**
 * Tidies a name typed at the table: spaces collapsed and, when it was typed all in lower or upper
 * case, capitals at the start of each part ("van den broeck" → "Van den Broeck", "d'hondt" →
 * "D'Hondt"). A name typed with its own capitals is kept as typed.
 */
export function tidyName(input: string): string {
  const name = input.trim().replace(/\s+/g, " ");
  if (name !== name.toLowerCase() && name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .split(" ")
    .map((word, i) => (i > 0 && PARTICLES.has(word) ? word : word.replace(/(^|['’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())))
    .join(" ");
}

/** For comparing names: lowercase, no accents, no spaces or punctuation. */
const nameKey = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/**
 * Known people whose name is almost the one typed (a typo, a missing letter, other spacing or an
 * apostrophe left out), most alike first; the same name exactly is not "almost".
 */
export function similarNames<T extends { firstName: string; lastName: string }>(typed: { firstName: string; lastName: string }, people: readonly T[]): T[] {
  const full = fullName(typed).toLowerCase();
  const key = nameKey(full);
  if (key.length < 5) return [];
  return people
    .filter((p) => fullName(p).toLowerCase() !== full)
    .map((p) => ({ p, d: editDistance(key, nameKey(fullName(p))) }))
    .filter(({ d }) => d <= 2)
    .sort((a, b) => a.d - b.d)
    .map(({ p }) => p);
}
