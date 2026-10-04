export const PALIERS = [100, 500, 1000, 5000, 10000, 25000] as const;

export function palierAtteint(total: number): number | null {
  const atteints = PALIERS.filter((p) => total >= p);
  return atteints.length > 0 ? atteints[atteints.length - 1]! : null;
}

export function prochainPalier(total: number): number | null {
  return PALIERS.find((p) => p > total) ?? null;
}

export type PalierProgress = { prev: number; next: number; fraction: number };

// Avancement entre le palier atteint (ou 0) et le suivant ; null quand tout est atteint.
export function palierProgress(total: number): PalierProgress | null {
  const next = prochainPalier(total);
  if (next === null) return null;
  const prev = palierAtteint(total) ?? 0;
  return { prev, next, fraction: (total - prev) / (next - prev) };
}

// L'exercice en reps le plus proche de son palier suivant (carte « Prochain palier »).
export function closestPalier<C extends { total: number; unit: "reps" | "seconds" }>(
  cards: C[],
): { card: C; left: number; progress: PalierProgress } | null {
  let best: { card: C; left: number; progress: PalierProgress } | null = null;
  for (const card of cards) {
    if (card.unit !== "reps") continue;
    const progress = palierProgress(card.total);
    if (!progress) continue;
    const left = progress.next - card.total;
    if (!best || left < best.left) best = { card, left, progress };
  }
  return best;
}
