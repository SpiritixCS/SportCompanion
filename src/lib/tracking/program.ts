// src/lib/tracking/program.ts
import type Database from "better-sqlite3";
import type { TrackingUnit } from "./db";
import { clampPeak, pyramidSteps, type PyramidShape } from "@/lib/pyramide/pyramid";

export const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

// restSeconds null (ou absent) : réglage global « Repos entre séries ».
export type DayExerciseInput = {
  name: string;
  unit: TrackingUnit;
  setsCount: number;
  targetValue: number;
  restSeconds?: number | null;
  // Présent : l'exercice se joue en pyramide (reps, une série par marche).
  pyramid?: { shape: PyramidShape; peak: number } | null;
};
export type DayExercise = DayExerciseInput & {
  ordre: number;
  restSeconds: number | null;
  pyramid: { shape: PyramidShape; peak: number } | null;
};
export type TrackingProgramDay = { dayOfWeek: number; label: string; isRest: boolean; exercises: DayExercise[] };

function getDayExercises(db: Database.Database, dayOfWeek: number): DayExercise[] {
  return db
    .prepare(
      `SELECT ordre, exercise_name AS name, unit, sets_count AS setsCount, target_value AS targetValue,
              rest_seconds AS restSeconds, pyramid_shape AS pyramidShape, pyramid_peak AS pyramidPeak
       FROM tracking_program_day_exercises WHERE day_of_week = ? ORDER BY ordre ASC`,
    )
    .all(dayOfWeek)
    .map((row) => {
      const { pyramidShape, pyramidPeak, ...rest } = row as Omit<DayExercise, "pyramid"> & {
        pyramidShape: PyramidShape | null;
        pyramidPeak: number | null;
      };
      return { ...rest, pyramid: pyramidShape ? { shape: pyramidShape, peak: pyramidPeak! } : null };
    });
}

export function getProgramDay(db: Database.Database, dayOfWeek: number): TrackingProgramDay {
  const row = db.prepare(`SELECT is_rest AS isRest FROM tracking_program_days WHERE day_of_week = ?`).get(dayOfWeek) as
    | { isRest: number }
    | undefined;
  if (!row) throw new Error(`Jour de semaine inconnu : ${dayOfWeek}`);
  return {
    dayOfWeek,
    label: WEEKDAY_LABELS[dayOfWeek]!,
    isRest: row.isRest === 1,
    exercises: getDayExercises(db, dayOfWeek),
  };
}

export function getProgramDays(db: Database.Database): TrackingProgramDay[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => getProgramDay(db, dayOfWeek));
}

export function setDayRest(db: Database.Database, dayOfWeek: number, isRest: boolean): TrackingProgramDay {
  db.prepare(`UPDATE tracking_program_days SET is_rest = ? WHERE day_of_week = ?`).run(isRest ? 1 : 0, dayOfWeek);
  return getProgramDay(db, dayOfWeek);
}

export function setDayExercises(db: Database.Database, dayOfWeek: number, exercises: DayExerciseInput[]): TrackingProgramDay {
  const apply = db.transaction(() => {
    db.prepare(`DELETE FROM tracking_program_day_exercises WHERE day_of_week = ?`).run(dayOfWeek);
    const insert = db.prepare(
      `INSERT INTO tracking_program_day_exercises
         (day_of_week, ordre, exercise_name, unit, sets_count, target_value, rest_seconds, pyramid_shape, pyramid_peak)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    exercises.forEach((exercise, ordre) => {
      if (exercise.pyramid) {
        // Pyramide : reps, une série par marche, le sommet en cible ; le moteur décide du repos.
        const peak = clampPeak(exercise.pyramid.peak);
        const steps = pyramidSteps(exercise.pyramid.shape, peak).length;
        insert.run(dayOfWeek, ordre, exercise.name, "reps", steps, peak, null, exercise.pyramid.shape, peak);
      } else {
        insert.run(dayOfWeek, ordre, exercise.name, exercise.unit, exercise.setsCount, exercise.targetValue, exercise.restSeconds ?? null, null, null);
      }
    });
  });
  apply();
  return getProgramDay(db, dayOfWeek);
}

// Enregistrement de la feuille « Modifier le jour ». Passer en repos garde les
// exercices du jour (on les retrouve en repassant en séance).
export function saveDay(
  db: Database.Database,
  dayOfWeek: number,
  isRest: boolean,
  exercises: DayExerciseInput[],
): TrackingProgramDay {
  db.transaction(() => {
    setDayRest(db, dayOfWeek, isRest);
    if (!isRest) setDayExercises(db, dayOfWeek, exercises);
  })();
  return getProgramDay(db, dayOfWeek);
}

export function getPointer(db: Database.Database): number {
  const row = db.prepare(`SELECT pointer_day_of_week AS pointerDayOfWeek FROM tracking_program_state WHERE id = 1`).get() as {
    pointerDayOfWeek: number;
  };
  return row.pointerDayOfWeek;
}

export function advancePointer(db: Database.Database): number {
  const next = (getPointer(db) + 1) % 7;
  db.prepare(`UPDATE tracking_program_state SET pointer_day_of_week = ? WHERE id = 1`).run(next);
  return next;
}
