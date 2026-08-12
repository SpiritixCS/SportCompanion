import type Database from "better-sqlite3";

export type CurrentPosition = {
  parcours: string;
  level: number;
  dayIndex: number;
  updatedAt: string;
};

export function getCurrentPosition(db: Database.Database): CurrentPosition | null {
  const row = db
    .prepare(
      `SELECT parcours, level, day_index AS dayIndex, updated_at AS updatedAt
       FROM current_position WHERE id = 1`,
    )
    .get() as CurrentPosition | undefined;
  return row ?? null;
}

export function setCurrentPosition(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
): CurrentPosition {
  const updatedAt = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO current_position (id, parcours, level, day_index, updated_at)
     VALUES (1, ?, ?, ?, ?)`,
  ).run(parcours, level, dayIndex, updatedAt);
  return { parcours, level, dayIndex, updatedAt };
}

export function isDayValidated(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM seances
       WHERE parcours = ? AND level = ? AND day_index = ? AND completed_at IS NOT NULL LIMIT 1`,
    )
    .get(parcours, level, dayIndex);
  return row !== undefined;
}

export function countValidatedDaysInLevel(db: Database.Database, parcours: string, level: number): number {
  const rows = db
    .prepare(
      `SELECT DISTINCT day_index FROM seances
       WHERE parcours = ? AND level = ? AND completed_at IS NOT NULL`,
    )
    .all(parcours, level) as { day_index: number }[];
  return rows.length;
}

export function getLatestCompletedSeanceId(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
): number | null {
  const row = db
    .prepare(
      `SELECT id FROM seances
       WHERE parcours = ? AND level = ? AND day_index = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC, id DESC LIMIT 1`,
    )
    .get(parcours, level, dayIndex) as { id: number } | undefined;
  return row ? row.id : null;
}
