export function addLocalListCourt<T extends { id: string }>(
  courts: T[],
  court: T,
): T[] {
  if (courts.some((row) => row.id === court.id)) return courts;
  if (courts.length >= 5)
    throw new Error("You can add up to 5 courts to LocalList.");
  return [...courts, court];
}

export function orderLocalList<T extends { id: string }>(
  courts: T[],
  defaultId: string | null,
  extras: boolean,
): T[] {
  const first = courts.find((court) => court.id === defaultId) ?? courts[0];
  if (!first) return [];
  return extras
    ? [first, ...courts.filter((court) => court.id !== first.id)]
    : [first];
}
