// Mode pyramide : on monte marche par marche jusqu'au sommet puis on redescend
// (classique 1 → N → 1), ou l'inverse (N → 1 → N). Logique pure.
export type PyramidShape = "classic" | "inverted";

export const PEAK_MIN = 2;
export const PEAK_MAX = 30;

export function clampPeak(peak: number): number {
  return Math.min(PEAK_MAX, Math.max(PEAK_MIN, Math.round(peak)));
}

export function pyramidSteps(shape: PyramidShape, peak: number): number[] {
  const p = clampPeak(peak);
  const up = Array.from({ length: p }, (_, i) => i + 1);
  const classic = [...up, ...up.slice(0, -1).reverse()];
  return shape === "classic" ? classic : classic.map((r) => p + 1 - r);
}

export function pyramidTotal(shape: PyramidShape, peak: number): number {
  return pyramidSteps(shape, peak).reduce((sum, r) => sum + r, 0);
}

// Repos après une marche : court en bas, 2 min au sommet, arrondi aux 15 s.
export function pyramidRestSeconds(reps: number, peak: number): number {
  const raw = 15 + 105 * Math.pow(Math.min(1, reps / peak), 1.5);
  return Math.min(120, Math.max(15, Math.round(raw / 15) * 15));
}

export function pyramidLabel(shape: PyramidShape, peak: number): string {
  return shape === "classic" ? `Pyramide 1→${peak}→1` : `Pyramide ${peak}→1→${peak}`;
}
