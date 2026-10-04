import type { PyramidConfig } from "./db";

// Où reprendre une séance Tracking active : pyramide, jour du programme, ou séance libre héritée.
export function activeSeanceHref(active: { id: number; dayOfWeek: number | null; pyramid?: PyramidConfig | null }): string {
  if (active.pyramid) return "/player/pyramide";
  if (active.dayOfWeek !== null) return `/player/tracking?day=${active.dayOfWeek}`;
  return `/tracking/${active.id}`;
}
