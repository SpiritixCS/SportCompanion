import type Database from "better-sqlite3";

export type Seance = {
  id: number;
  parcours: string;
  level: number;
  dayIndex: number;
  startedAt: string;
  completedAt: string | null;
};

export type SetLoggedRecord = {
  id: number;
  seanceId: number;
  exerciseOrder: number;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
  completedAt: string;
};

export function getActiveSeance(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
): Seance | null {
  const row = db
    .prepare(
      `SELECT id, parcours, level, day_index AS dayIndex, started_at AS startedAt, completed_at AS completedAt
       FROM seances
       WHERE parcours = ? AND level = ? AND day_index = ? AND completed_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
    )
    .get(parcours, level, dayIndex) as Seance | undefined;
  return row ?? null;
}

export function startSeance(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
): Seance {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO seances (parcours, level, day_index, started_at) VALUES (?, ?, ?, ?)`)
    .run(parcours, level, dayIndex, startedAt);
  return {
    id: Number(result.lastInsertRowid),
    parcours,
    level,
    dayIndex,
    startedAt,
    completedAt: null,
  };
}

export function getOrStartSeance(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
): Seance {
  return getActiveSeance(db, parcours, level, dayIndex) ?? startSeance(db, parcours, level, dayIndex);
}

export function getSetsForSeance(db: Database.Database, seanceId: number): SetLoggedRecord[] {
  return db
    .prepare(
      `SELECT id, seance_id AS seanceId, exercise_order AS exerciseOrder, set_number AS setNumber,
              reps_target AS repsTarget, reps_actual AS repsActual, rest_seconds AS restSeconds,
              completed_at AS completedAt
       FROM sets_logged WHERE seance_id = ? ORDER BY id ASC`,
    )
    .all(seanceId) as SetLoggedRecord[];
}

export function logSet(
  db: Database.Database,
  params: {
    seanceId: number;
    exerciseOrder: number;
    setNumber: number;
    repsTarget: string;
    repsActual: number;
    restSeconds: number;
  },
): SetLoggedRecord {
  const completedAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO sets_logged (seance_id, exercise_order, set_number, reps_target, reps_actual, rest_seconds, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.seanceId,
      params.exerciseOrder,
      params.setNumber,
      params.repsTarget,
      params.repsActual,
      params.restSeconds,
      completedAt,
    );
  return { ...params, id: Number(result.lastInsertRowid), completedAt };
}

export function skipExercise(db: Database.Database, seanceId: number, exerciseOrder: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO skipped_exercises (seance_id, exercise_order, skipped_at) VALUES (?, ?, ?)`,
  ).run(seanceId, exerciseOrder, new Date().toISOString());
}

export function getSkippedExercises(db: Database.Database, seanceId: number): number[] {
  const rows = db
    .prepare(`SELECT exercise_order AS exerciseOrder FROM skipped_exercises WHERE seance_id = ?`)
    .all(seanceId) as { exerciseOrder: number }[];
  return rows.map((r) => r.exerciseOrder);
}

export function completeSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`UPDATE seances SET completed_at = ? WHERE id = ?`).run(new Date().toISOString(), seanceId);
}
