// src/lib/tracking/loadTrackingScreenState.ts
import type Database from "better-sqlite3";
import { getActiveSeance, getSetsForSeance, listCompletedSeances, type TrackingSeanceSummary, type TrackingSetWithExercise, type TrackingUnit } from "./db";
import { getPointer, getProgramDay, getProgramDays, type DayExercise, type TrackingProgramDay } from "./program";

type ActiveSeanceExercise = { name: string; unit: TrackingUnit; setsCount: number; totalValue: number };

export type TrackingScreenState = {
  programDay: TrackingProgramDay;
  // Aucun exercice sur les 7 jours : programme jamais composé (par défaut,
  // les 7 jours sont en repos) — Aujourd'hui invite à le composer.
  programEmpty: boolean;
  activeSeance: {
    id: number;
    dayOfWeek: number | null;
    dayLabel: string | null;
    plannedExercises: DayExercise[] | null;
    loggedExercises: ActiveSeanceExercise[];
  } | null;
  seances: TrackingSeanceSummary[];
};

function summarizeActiveSets(sets: TrackingSetWithExercise[]): ActiveSeanceExercise[] {
  const byExercise = new Map<number, ActiveSeanceExercise & { order: number }>();
  for (const set of sets) {
    const entry = byExercise.get(set.exerciseId) ?? {
      name: set.exerciseName,
      unit: set.exerciseUnit,
      setsCount: 0,
      totalValue: 0,
      order: set.exerciseOrder,
    };
    entry.setsCount += 1;
    entry.totalValue += set.valeurActual;
    byExercise.set(set.exerciseId, entry);
  }
  return [...byExercise.values()].sort((a, b) => a.order - b.order).map(({ order, ...rest }) => rest);
}

export function loadTrackingScreenState(db: Database.Database): TrackingScreenState {
  const active = getActiveSeance(db);
  const programDay = getProgramDay(db, getPointer(db));
  const activeDay =
    active && active.dayOfWeek !== null && active.dayOfWeek >= 0 && active.dayOfWeek <= 6
      ? getProgramDay(db, active.dayOfWeek)
      : null;

  return {
    programDay,
    programEmpty: getProgramDays(db).every((d) => d.exercises.length === 0),
    activeSeance: active
      ? {
          id: active.id,
          dayOfWeek: active.dayOfWeek,
          dayLabel: activeDay?.label ?? null,
          plannedExercises: activeDay?.exercises ?? null,
          loggedExercises: summarizeActiveSets(getSetsForSeance(db, active.id)),
        }
      : null,
    seances: listCompletedSeances(db),
  };
}
