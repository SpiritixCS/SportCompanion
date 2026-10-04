import { PARCOURS } from "@/lib/programme/parcours";
import type { MovementFamily } from "@/lib/trophies/movementFamily";

export type CatalogExercise = { id: string; name: string; movementFamily: MovementFamily };

const normalize = (name: string) => name.trim().toLowerCase();

let cache: CatalogExercise[] | null = null;

// Exercices Caliathletics jouables en pyramide : en reps et comptés dans les Trophées.
export function catalogExercises(): CatalogExercise[] {
  if (cache) return cache;
  const byId = new Map<string, CatalogExercise>();
  for (const p of PARCOURS)
    for (const level of p.program)
      for (const day of level) {
        if (day.kind !== "train") continue;
        for (const e of day.exercises) {
          if (!e.countsInStats || e.target.unit !== "reps" || byId.has(e.id)) continue;
          byId.set(e.id, { id: e.id, name: e.name, movementFamily: e.movementFamily as MovementFamily });
        }
      }
  cache = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return cache;
}

export function findCatalogByName(name: string): CatalogExercise | null {
  const n = normalize(name);
  return catalogExercises().find((e) => normalize(e.name) === n) ?? null;
}

export function findCatalogById(id: string): CatalogExercise | null {
  return catalogExercises().find((e) => e.id === id) ?? null;
}
