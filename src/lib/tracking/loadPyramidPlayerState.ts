import type Database from "better-sqlite3";
import type { TrainDay } from "@/lib/workout/types";
import type { SetLoggedRecord } from "@/lib/player/db";
import { deriveState } from "@/lib/player/deriveState";
import { findCatalogByName, type CatalogExercise } from "@/lib/pyramide/catalog";
import { pyramidSteps, setTarget } from "@/lib/pyramide/pyramid";
import { getActiveSeance, getPyramid, getSetsForSeance, getSkippedExercises, type PyramidConfig } from "./db";
import type { DayPlayerState } from "./loadDayPlayerState";

export type PyramidPlayer = {
  config: PyramidConfig;
  catalog: CatalogExercise | null;
  day: TrainDay;
  state: Exclude<DayPlayerState, { phase: "wrong-seance" } | { phase: "completed" }>;
  setsLogged: SetLoggedRecord[];
};

// La pyramide libre active, servie au player comme un jour d'un seul exercice.
// Lue depuis la DB à chaque chargement (CLAUDE.md §2) : reprise à la bonne marche.
export function loadPyramidPlayerState(db: Database.Database): PyramidPlayer | null {
  const seance = getActiveSeance(db);
  const config = seance ? getPyramid(db, seance.id) : null;
  if (!seance || !config) return null;

  const catalog = findCatalogByName(config.exerciseName);
  const pyramid = { shape: config.shape, peak: config.peak };
  const day: TrainDay = {
    kind: "train",
    label: "Pyramide",
    exercises: [
      {
        id: catalog?.id ?? `pyramide-${seance.id}`,
        name: config.exerciseName,
        movementFamily: catalog?.movementFamily ?? "other",
        countsInStats: true,
        videoId: null,
        sets: pyramidSteps(pyramid.shape, pyramid.peak).length,
        target: { unit: "reps", value: pyramid.peak, maxEffort: false, eachSide: false },
        pyramid,
      },
    ],
  };

  const sets = getSetsForSeance(db, seance.id);
  const skipped = getSkippedExercises(db, seance.id);
  const progress = deriveState(day, sets, new Set(skipped));
  const setsLogged = sets.map((s) => ({
    id: s.id,
    seanceId: s.seanceId,
    exerciseOrder: s.exerciseOrder,
    setNumber: s.setNumber,
    repsTarget: String(setTarget(day.exercises[0]!, s.setNumber) ?? ""),
    repsActual: s.valeurActual,
    restSeconds: 0,
    completedAt: s.completedAt,
  }));
  const base = { seanceId: seance.id, startedAt: seance.startedAt, resumedAt: seance.resumedAt };
  const state: PyramidPlayer["state"] = progress.allSetsDone
    ? { phase: "pending-validation", ...base }
    : { phase: "in-progress", ...base, next: progress.next, skippedExerciseOrders: skipped };

  return { config, catalog, day, state, setsLogged };
}
