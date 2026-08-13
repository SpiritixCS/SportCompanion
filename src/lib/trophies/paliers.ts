export const PALIERS = [100, 500, 1000, 5000, 10000, 25000] as const;

export function palierAtteint(total: number): number | null {
  const atteints = PALIERS.filter((p) => total >= p);
  return atteints.length > 0 ? atteints[atteints.length - 1]! : null;
}

export function prochainPalier(total: number): number | null {
  return PALIERS.find((p) => p > total) ?? null;
}
