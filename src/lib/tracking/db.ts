import type Database from "better-sqlite3";

export type TrackingExercise = { id: number; name: string; createdAt: string };
export type TrackingSeance = { id: number; startedAt: string; completedAt: string | null };
export type TrackingSetWithExercise = {
  id: number;
  seanceId: number;
  exerciseId: number;
  exerciseName: string;
  exerciseOrder: number;
  setNumber: number;
  repsActual: number;
  completedAt: string;
};
export type TrackingSeanceSummary = {
  id: number;
  startedAt: string;
  completedAt: string;
  totalReps: number;
  exerciseCount: number;
};

export function findOrCreateExercise(db: Database.Database, name: string): TrackingExercise {
  const existing = db.prepare(`SELECT id, name, created_at AS createdAt FROM tracking_exercises WHERE name = ?`).get(name) as
    | TrackingExercise
    | undefined;
  if (existing) return existing;

  const createdAt = new Date().toISOString();
  const result = db.prepare(`INSERT INTO tracking_exercises (name, created_at) VALUES (?, ?)`).run(name, createdAt);
  return { id: Number(result.lastInsertRowid), name, createdAt };
}

export function listExerciseNames(db: Database.Database): string[] {
  const rows = db.prepare(`SELECT name FROM tracking_exercises ORDER BY name COLLATE NOCASE`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

function mapSeance(row: { id: number; started_at: string; completed_at: string | null }): TrackingSeance {
  return { id: row.id, startedAt: row.started_at, completedAt: row.completed_at };
}

export function getActiveSeance(db: Database.Database): TrackingSeance | null {
  const row = db
    .prepare(`SELECT * FROM tracking_seances WHERE completed_at IS NULL ORDER BY started_at DESC, id DESC LIMIT 1`)
    .get() as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function startSeance(db: Database.Database): TrackingSeance {
  const startedAt = new Date().toISOString();
  const result = db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run(startedAt);
  return { id: Number(result.lastInsertRowid), startedAt, completedAt: null };
}

export function getOrStartSeance(db: Database.Database): TrackingSeance {
  return getActiveSeance(db) ?? startSeance(db);
}

export function getSeanceById(db: Database.Database, id: number): TrackingSeance | null {
  const row = db.prepare(`SELECT * FROM tracking_seances WHERE id = ?`).get(id) as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function getSetsForSeance(db: Database.Database, seanceId: number): TrackingSetWithExercise[] {
  return db
    .prepare(
      `SELECT tsl.id, tsl.seance_id AS seanceId, tsl.exercise_id AS exerciseId, te.name AS exerciseName,
              tsl.exercise_order AS exerciseOrder, tsl.set_number AS setNumber, tsl.valeur_actual AS repsActual,
              tsl.completed_at AS completedAt
       FROM tracking_sets_logged tsl JOIN tracking_exercises te ON tsl.exercise_id = te.id
       WHERE tsl.seance_id = ? ORDER BY tsl.id ASC`,
    )
    .all(seanceId) as TrackingSetWithExercise[];
}

export function logSetForExercise(
  db: Database.Database,
  seanceId: number,
  exerciseName: string,
  repsActual: number,
): TrackingSetWithExercise {
  const exercise = findOrCreateExercise(db, exerciseName);
  const seanceSets = getSetsForSeance(db, seanceId);
  const exerciseSets = seanceSets.filter((s) => s.exerciseId === exercise.id);
  const exerciseOrder =
    exerciseSets[0]?.exerciseOrder ?? 1 + seanceSets.reduce((max, s) => Math.max(max, s.exerciseOrder), -1);
  const setNumber = exerciseSets.length + 1;

  const completedAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO tracking_sets_logged (seance_id, exercise_id, exercise_order, set_number, valeur_actual, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(seanceId, exercise.id, exerciseOrder, setNumber, repsActual, completedAt);

  return {
    id: Number(result.lastInsertRowid),
    seanceId,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    exerciseOrder,
    setNumber,
    repsActual,
    completedAt,
  };
}

export function completeSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`UPDATE tracking_seances SET completed_at = ? WHERE id = ?`).run(new Date().toISOString(), seanceId);
}

export function listCompletedSeances(db: Database.Database): TrackingSeanceSummary[] {
  return db
    .prepare(
      `SELECT s.id, s.started_at AS startedAt, s.completed_at AS completedAt,
              COALESCE(SUM(sl.valeur_actual), 0) AS totalReps,
              COUNT(DISTINCT sl.exercise_id) AS exerciseCount
       FROM tracking_seances s
       LEFT JOIN tracking_sets_logged sl ON sl.seance_id = s.id
       WHERE s.completed_at IS NOT NULL
       GROUP BY s.id
       ORDER BY s.completed_at DESC, s.id DESC`,
    )
    .all() as TrackingSeanceSummary[];
}
