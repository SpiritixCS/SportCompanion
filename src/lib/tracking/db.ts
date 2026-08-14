import type Database from "better-sqlite3";

export type TrackingUnit = "reps" | "seconds";
export type TrackingExercise = { id: number; name: string; unit: TrackingUnit; createdAt: string };
export type TrackingSeance = { id: number; startedAt: string; completedAt: string | null; templateId: number | null };
export type TrackingSetWithExercise = {
  id: number;
  seanceId: number;
  exerciseId: number;
  exerciseName: string;
  exerciseUnit: TrackingUnit;
  exerciseOrder: number;
  setNumber: number;
  valeurActual: number;
  completedAt: string;
};
export type TrackingSeanceSummary = {
  id: number;
  startedAt: string;
  completedAt: string;
  totalReps: number;
  totalSeconds: number;
  exerciseCount: number;
};

export function findOrCreateExercise(db: Database.Database, name: string, unit: TrackingUnit = "reps"): TrackingExercise {
  const existing = db
    .prepare(`SELECT id, name, unit, created_at AS createdAt FROM tracking_exercises WHERE name = ?`)
    .get(name) as TrackingExercise | undefined;
  if (existing) return existing;

  const createdAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO tracking_exercises (name, unit, created_at) VALUES (?, ?, ?)`)
    .run(name, unit, createdAt);
  return { id: Number(result.lastInsertRowid), name, unit, createdAt };
}

export function listExercises(db: Database.Database): { name: string; unit: TrackingUnit }[] {
  return db.prepare(`SELECT name, unit FROM tracking_exercises ORDER BY name COLLATE NOCASE`).all() as {
    name: string;
    unit: TrackingUnit;
  }[];
}

function mapSeance(row: { id: number; started_at: string; completed_at: string | null; template_id: number | null }): TrackingSeance {
  return { id: row.id, startedAt: row.started_at, completedAt: row.completed_at, templateId: row.template_id };
}

export function getActiveSeance(db: Database.Database): TrackingSeance | null {
  const row = db
    .prepare(`SELECT * FROM tracking_seances WHERE completed_at IS NULL ORDER BY started_at DESC, id DESC LIMIT 1`)
    .get() as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function startSeance(db: Database.Database, templateId: number | null = null): TrackingSeance {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO tracking_seances (started_at, template_id) VALUES (?, ?)`)
    .run(startedAt, templateId);
  return { id: Number(result.lastInsertRowid), startedAt, completedAt: null, templateId };
}

// Resumes whatever seance is active, regardless of the templateId requested —
// only one seance is ever active at a time (product invariant). Callers that
// care whether the resumed seance actually matches their context must check
// its .templateId themselves (see loadTemplatePlayerState's "wrong-seance" phase).
export function getOrStartSeance(db: Database.Database, templateId: number | null = null): TrackingSeance {
  return getActiveSeance(db) ?? startSeance(db, templateId);
}

export function getSeanceById(db: Database.Database, id: number): TrackingSeance | null {
  const row = db.prepare(`SELECT * FROM tracking_seances WHERE id = ?`).get(id) as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function getSetsForSeance(db: Database.Database, seanceId: number): TrackingSetWithExercise[] {
  return db
    .prepare(
      `SELECT tsl.id, tsl.seance_id AS seanceId, tsl.exercise_id AS exerciseId, te.name AS exerciseName, te.unit AS exerciseUnit,
              tsl.exercise_order AS exerciseOrder, tsl.set_number AS setNumber, tsl.valeur_actual AS valeurActual,
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
  unit: TrackingUnit,
  valeurActual: number,
  count: number = 1,
  exerciseOrder?: number,
): TrackingSetWithExercise[] {
  const exercise = findOrCreateExercise(db, exerciseName, unit);
  const seanceSets = getSetsForSeance(db, seanceId);
  const existingForExercise = seanceSets.filter((s) => s.exerciseId === exercise.id);
  const resolvedOrder =
    exerciseOrder ??
    existingForExercise[0]?.exerciseOrder ??
    1 + seanceSets.reduce((max, s) => Math.max(max, s.exerciseOrder), -1);
  const existingAtOrder = seanceSets.filter((s) => s.exerciseOrder === resolvedOrder);

  const insert = db.prepare(
    `INSERT INTO tracking_sets_logged (seance_id, exercise_id, exercise_order, set_number, valeur_actual, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const created: TrackingSetWithExercise[] = [];
  let setNumber = existingAtOrder.length + 1;
  for (let i = 0; i < count; i++) {
    const completedAt = new Date().toISOString();
    const result = insert.run(seanceId, exercise.id, resolvedOrder, setNumber, valeurActual, completedAt);
    created.push({
      id: Number(result.lastInsertRowid),
      seanceId,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      exerciseUnit: exercise.unit,
      exerciseOrder: resolvedOrder,
      setNumber,
      valeurActual,
      completedAt,
    });
    setNumber++;
  }
  return created;
}

export function updateSet(db: Database.Database, setId: number, valeurActual: number): void {
  db.prepare(`UPDATE tracking_sets_logged SET valeur_actual = ? WHERE id = ?`).run(valeurActual, setId);
}

export function deleteSet(db: Database.Database, setId: number): void {
  db.prepare(`DELETE FROM tracking_sets_logged WHERE id = ?`).run(setId);
}

export function deleteSetsForExercise(db: Database.Database, seanceId: number, exerciseId: number): void {
  db.prepare(`DELETE FROM tracking_sets_logged WHERE seance_id = ? AND exercise_id = ?`).run(seanceId, exerciseId);
}

export function deleteSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`DELETE FROM tracking_sets_logged WHERE seance_id = ?`).run(seanceId);
  db.prepare(`DELETE FROM tracking_seances WHERE id = ?`).run(seanceId);
}

export function completeSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`UPDATE tracking_seances SET completed_at = ? WHERE id = ?`).run(new Date().toISOString(), seanceId);
}

export function listCompletedSeances(db: Database.Database): TrackingSeanceSummary[] {
  return db
    .prepare(
      `SELECT s.id, s.started_at AS startedAt, s.completed_at AS completedAt,
              COALESCE(SUM(CASE WHEN te.unit = 'reps' THEN sl.valeur_actual ELSE 0 END), 0) AS totalReps,
              COALESCE(SUM(CASE WHEN te.unit = 'seconds' THEN sl.valeur_actual ELSE 0 END), 0) AS totalSeconds,
              COUNT(DISTINCT sl.exercise_id) AS exerciseCount
       FROM tracking_seances s
       LEFT JOIN tracking_sets_logged sl ON sl.seance_id = s.id
       LEFT JOIN tracking_exercises te ON te.id = sl.exercise_id
       WHERE s.completed_at IS NOT NULL
       GROUP BY s.id
       ORDER BY s.completed_at DESC, s.id DESC`,
    )
    .all() as TrackingSeanceSummary[];
}

export function skipExercise(db: Database.Database, seanceId: number, exerciseOrder: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO tracking_skipped_exercises (seance_id, exercise_order, skipped_at) VALUES (?, ?, ?)`,
  ).run(seanceId, exerciseOrder, new Date().toISOString());
}

export function getSkippedExercises(db: Database.Database, seanceId: number): number[] {
  const rows = db
    .prepare(`SELECT exercise_order AS exerciseOrder FROM tracking_skipped_exercises WHERE seance_id = ?`)
    .all(seanceId) as { exerciseOrder: number }[];
  return rows.map((r) => r.exerciseOrder);
}
