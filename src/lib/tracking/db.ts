import type Database from "better-sqlite3";
import { clampPeak, type PyramidShape } from "@/lib/pyramide/pyramid";
import type { CatalogExercise } from "@/lib/pyramide/catalog";

export type TrackingUnit = "reps" | "seconds";
export type TrackingExercise = { id: number; name: string; unit: TrackingUnit; createdAt: string };
export type TrackingSeance = { id: number; startedAt: string; resumedAt: string | null; completedAt: string | null; dayOfWeek: number | null };
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
export type PyramidConfig = { exerciseName: string; shape: PyramidShape; peak: number };
export type TrackingSeanceSummary = {
  id: number;
  startedAt: string;
  completedAt: string;
  totalReps: number;
  totalSeconds: number;
  exerciseCount: number;
  pyramid: PyramidConfig | null;
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

// Exercice Tracking lié à un exercice du catalogue : retrouvé par son lien,
// sinon on adopte la ligne libre du même nom (ses séries rejoignent la carte
// du catalogue), sinon on la crée.
export function findOrCreateLinkedExercise(db: Database.Database, catalog: CatalogExercise): TrackingExercise {
  return db.transaction(() => {
    const select = `SELECT id, name, unit, created_at AS createdAt FROM tracking_exercises`;
    const linked = db.prepare(`${select} WHERE catalog_id = ?`).get(catalog.id) as TrackingExercise | undefined;
    if (linked) return linked;
    const sameName = db.prepare(`${select} WHERE name = ? AND catalog_id IS NULL`).get(catalog.name) as TrackingExercise | undefined;
    if (sameName) {
      db.prepare(`UPDATE tracking_exercises SET catalog_id = ? WHERE id = ?`).run(catalog.id, sameName.id);
      return sameName;
    }
    const createdAt = new Date().toISOString();
    const result = db
      .prepare(`INSERT INTO tracking_exercises (name, unit, created_at, catalog_id) VALUES (?, 'reps', ?, ?)`)
      .run(catalog.name, createdAt, catalog.id);
    return { id: Number(result.lastInsertRowid), name: catalog.name, unit: "reps" as const, createdAt };
  })();
}

export function listExercises(db: Database.Database): { name: string; unit: TrackingUnit }[] {
  return db.prepare(`SELECT name, unit FROM tracking_exercises ORDER BY name COLLATE NOCASE`).all() as {
    name: string;
    unit: TrackingUnit;
  }[];
}

function mapSeance(row: { id: number; started_at: string; resumed_at: string | null; completed_at: string | null; program_day_of_week: number | null }): TrackingSeance {
  return { id: row.id, startedAt: row.started_at, resumedAt: row.resumed_at, completedAt: row.completed_at, dayOfWeek: row.program_day_of_week };
}

export function getActiveSeance(db: Database.Database): TrackingSeance | null {
  const row = db
    .prepare(`SELECT * FROM tracking_seances WHERE completed_at IS NULL ORDER BY started_at DESC, id DESC LIMIT 1`)
    .get() as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function startSeance(db: Database.Database, dayOfWeek: number | null = null): TrackingSeance {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO tracking_seances (started_at, program_day_of_week) VALUES (?, ?)`)
    .run(startedAt, dayOfWeek);
  return { id: Number(result.lastInsertRowid), startedAt, resumedAt: null, completedAt: null, dayOfWeek };
}

// Resumes whatever seance is active, regardless of the dayOfWeek requested —
// only one seance is ever active at a time (product invariant). Callers that
// care whether the resumed seance actually matches their context must check
// its .dayOfWeek themselves (see loadDayPlayerState's "wrong-seance" phase).
export function getOrStartSeance(db: Database.Database, dayOfWeek: number | null = null): TrackingSeance {
  return getActiveSeance(db) ?? startSeance(db, dayOfWeek);
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
  catalog?: CatalogExercise,
): TrackingSetWithExercise[] {
  const exercise = catalog ? findOrCreateLinkedExercise(db, catalog) : findOrCreateExercise(db, exerciseName, unit);
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
  db.prepare(`DELETE FROM tracking_pyramids WHERE seance_id = ?`).run(seanceId);
  db.prepare(`DELETE FROM tracking_sets_logged WHERE seance_id = ?`).run(seanceId);
  db.prepare(`DELETE FROM tracking_skipped_exercises WHERE seance_id = ?`).run(seanceId);
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
              COUNT(DISTINCT sl.exercise_id) AS exerciseCount,
              tp.exercise_name AS pyramidName, tp.shape AS pyramidShape, tp.peak AS pyramidPeak
       FROM tracking_seances s
       LEFT JOIN tracking_pyramids tp ON tp.seance_id = s.id
       LEFT JOIN tracking_sets_logged sl ON sl.seance_id = s.id
       LEFT JOIN tracking_exercises te ON te.id = sl.exercise_id
       WHERE s.completed_at IS NOT NULL
       GROUP BY s.id
       ORDER BY s.completed_at DESC, s.id DESC`,
    )
    .all()
    .map((row) => {
      const { pyramidName, pyramidShape, pyramidPeak, ...rest } = row as Omit<TrackingSeanceSummary, "pyramid"> & {
        pyramidName: string | null;
        pyramidShape: PyramidShape | null;
        pyramidPeak: number | null;
      };
      return {
        ...rest,
        pyramid: pyramidName !== null ? { exerciseName: pyramidName, shape: pyramidShape!, peak: pyramidPeak! } : null,
      };
    });
}

export function startPyramidSeance(db: Database.Database, config: PyramidConfig): TrackingSeance {
  return db.transaction(() => {
    if (getActiveSeance(db)) throw new Error("Une séance Tracking est déjà en cours");
    const seance = startSeance(db, null);
    db.prepare(`INSERT INTO tracking_pyramids (seance_id, exercise_name, shape, peak) VALUES (?, ?, ?, ?)`).run(
      seance.id,
      config.exerciseName.trim(),
      config.shape,
      clampPeak(config.peak),
    );
    return seance;
  })();
}

export function getPyramid(db: Database.Database, seanceId: number): PyramidConfig | null {
  const row = db
    .prepare(`SELECT exercise_name AS exerciseName, shape, peak FROM tracking_pyramids WHERE seance_id = ?`)
    .get(seanceId) as PyramidConfig | undefined;
  return row ?? null;
}

// Préremplissage du lancement : sommet de la dernière pyramide terminée pour cet exercice.
export function lastPeakFor(db: Database.Database, exerciseName: string): number | null {
  const row = db
    .prepare(
      `SELECT tp.peak FROM tracking_pyramids tp JOIN tracking_seances s ON s.id = tp.seance_id
       WHERE s.completed_at IS NOT NULL AND lower(trim(tp.exercise_name)) = lower(trim(?))
       ORDER BY s.completed_at DESC, s.id DESC LIMIT 1`,
    )
    .get(exerciseName) as { peak: number } | undefined;
  return row?.peak ?? null;
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

export function resumeSeance(db: Database.Database, seanceId: number): void {
  db.prepare(`UPDATE tracking_seances SET resumed_at = ? WHERE id = ?`).run(new Date().toISOString(), seanceId);
}

// « Effacer » / « Abandonner » depuis le player : comme deleteSeance, mais
// jamais sur une séance déjà validée (onglet périmé sur un autre appareil).
// deleteSeance reste sans garde : l'historique Tracking s'en sert pour
// supprimer volontairement une séance validée.
export function deleteActiveSeance(db: Database.Database, seanceId: number): void {
  db.transaction(() => {
    const row = db.prepare(`SELECT completed_at FROM tracking_seances WHERE id = ?`).get(seanceId) as
      | { completed_at: string | null }
      | undefined;
    if (!row || row.completed_at !== null) return;
    deleteSeance(db, seanceId);
  })();
}
