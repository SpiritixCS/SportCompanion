import type Database from "better-sqlite3";
import type { EvalRow } from "./progression";
import type { ArbreId } from "./arbres";

export function getStartDate(db: Database.Database): string | null {
  const row = db.prepare("SELECT start_date FROM dos_start_date WHERE id = 1").get() as
    | { start_date: string }
    | undefined;
  return row ? row.start_date : null;
}

export function setStartDate(db: Database.Database, date: string): void {
  db.prepare(
    `INSERT OR REPLACE INTO dos_start_date (id, start_date, set_at) VALUES (1, ?, ?)`,
  ).run(date, new Date().toISOString());
}

export function recordEvaluation(db: Database.Database, row: EvalRow): void {
  db.prepare(
    `INSERT INTO dos_evaluations (arbre, semaine, cran_apres, resultat, horodatage)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(row.arbre, row.semaine, row.cranApres, row.resultat, row.horodatage);
}

export function getEvaluations(db: Database.Database, arbre?: ArbreId): EvalRow[] {
  const rows = (
    arbre
      ? db
          .prepare(
            `SELECT arbre, semaine, cran_apres AS cranApres, resultat, horodatage
             FROM dos_evaluations WHERE arbre = ? ORDER BY id ASC`,
          )
          .all(arbre)
      : db
          .prepare(
            `SELECT arbre, semaine, cran_apres AS cranApres, resultat, horodatage
             FROM dos_evaluations ORDER BY id ASC`,
          )
          .all()
  ) as EvalRow[];
  return rows;
}
