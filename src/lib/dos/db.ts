import type Database from "better-sqlite3";
import type { SetLoggedRecord } from "@/lib/player/db";

export type DosSeance = {
  id: number;
  date: string;
  jourSemaine: string;
  semaine: number;
  startedAt: string;
  completedAt: string | null;
  genePendant: number | null;
};

export type DosSetLoggedRecord = {
  id: number;
  seanceId: number;
  exerciseOrder: number;
  exerciseId: string;
  setNumber: number;
  valeurTarget: string;
  valeurActual: number;
  restSeconds: number;
  completedAt: string;
};

function mapSeance(row: {
  id: number; date: string; jour_semaine: string; semaine: number;
  started_at: string; completed_at: string | null; gene_pendant: number | null;
}): DosSeance {
  return {
    id: row.id, date: row.date, jourSemaine: row.jour_semaine, semaine: row.semaine,
    startedAt: row.started_at, completedAt: row.completed_at, genePendant: row.gene_pendant,
  };
}

export function getDosSeanceByDate(db: Database.Database, date: string): DosSeance | null {
  const row = db.prepare(`SELECT * FROM dos_seances WHERE date = ?`).get(date) as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function getDosSeanceById(db: Database.Database, id: number): DosSeance | null {
  const row = db.prepare(`SELECT * FROM dos_seances WHERE id = ?`).get(id) as Parameters<typeof mapSeance>[0] | undefined;
  return row ? mapSeance(row) : null;
}

export function startDosSeance(
  db: Database.Database,
  date: string,
  jourSemaine: string,
  semaine: number,
): DosSeance {
  const startedAt = new Date().toISOString();
  const result = db
    .prepare(`INSERT INTO dos_seances (date, jour_semaine, semaine, started_at) VALUES (?, ?, ?, ?)`)
    .run(date, jourSemaine, semaine, startedAt);
  return {
    id: Number(result.lastInsertRowid), date, jourSemaine, semaine,
    startedAt, completedAt: null, genePendant: null,
  };
}

export function getOrStartDosSeance(
  db: Database.Database,
  date: string,
  jourSemaine: string,
  semaine: number,
): DosSeance {
  return getDosSeanceByDate(db, date) ?? startDosSeance(db, date, jourSemaine, semaine);
}

export function getSetsForDosSeance(db: Database.Database, seanceId: number): DosSetLoggedRecord[] {
  return db
    .prepare(
      `SELECT id, seance_id AS seanceId, exercise_order AS exerciseOrder, exercise_id AS exerciseId, set_number AS setNumber,
              valeur_target AS valeurTarget, valeur_actual AS valeurActual, rest_seconds AS restSeconds,
              completed_at AS completedAt
       FROM dos_sets_logged WHERE seance_id = ? ORDER BY id ASC`,
    )
    .all(seanceId) as DosSetLoggedRecord[];
}

export function logDosSet(
  db: Database.Database,
  params: {
    seanceId: number;
    exerciseOrder: number;
    exerciseId: string;
    setNumber: number;
    valeurTarget: string;
    valeurActual: number;
    restSeconds: number;
  },
): DosSetLoggedRecord {
  const completedAt = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO dos_sets_logged (seance_id, exercise_order, exercise_id, set_number, valeur_target, valeur_actual, rest_seconds, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(params.seanceId, params.exerciseOrder, params.exerciseId, params.setNumber, params.valeurTarget, params.valeurActual, params.restSeconds, completedAt);
  return { ...params, id: Number(result.lastInsertRowid), completedAt };
}

export function skipDosExercise(db: Database.Database, seanceId: number, exerciseOrder: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO dos_skipped_exercises (seance_id, exercise_order, skipped_at) VALUES (?, ?, ?)`,
  ).run(seanceId, exerciseOrder, new Date().toISOString());
}

export function getSkippedDosExercises(db: Database.Database, seanceId: number): number[] {
  const rows = db
    .prepare(`SELECT exercise_order AS exerciseOrder FROM dos_skipped_exercises WHERE seance_id = ?`)
    .all(seanceId) as { exerciseOrder: number }[];
  return rows.map((r) => r.exerciseOrder);
}

export function completeDosSeance(db: Database.Database, seanceId: number, genePendant: number): void {
  db.prepare(`UPDATE dos_seances SET completed_at = ?, gene_pendant = ? WHERE id = ?`).run(
    new Date().toISOString(), genePendant, seanceId,
  );
}

export function toPlayerSetsLogged(rows: DosSetLoggedRecord[]): SetLoggedRecord[] {
  return rows.map((r) => ({
    id: r.id, seanceId: r.seanceId, exerciseOrder: r.exerciseOrder, setNumber: r.setNumber,
    repsTarget: r.valeurTarget, repsActual: r.valeurActual, restSeconds: r.restSeconds, completedAt: r.completedAt,
  }));
}
