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
