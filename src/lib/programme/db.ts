import type Database from "better-sqlite3";

export type CurrentPosition = {
  parcours: string;
  level: number;
  dayIndex: number;
  cycle: number;
  updatedAt: string;
};

export function getCurrentPosition(db: Database.Database): CurrentPosition | null {
  const row = db
    .prepare(
      `SELECT parcours, level, day_index AS dayIndex, cycle, updated_at AS updatedAt
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
  cycle = 0,
): CurrentPosition {
  const updatedAt = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO current_position (id, parcours, level, day_index, cycle, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)`,
  ).run(parcours, level, dayIndex, cycle, updatedAt);
  return { parcours, level, dayIndex, cycle, updatedAt };
}

export function isDayValidated(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
  cycle = 0,
): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM seances
       WHERE parcours = ? AND level = ? AND day_index = ? AND cycle = ? AND completed_at IS NOT NULL LIMIT 1`,
    )
    .get(parcours, level, dayIndex, cycle);
  return row !== undefined;
}

export function countValidatedDaysInLevel(db: Database.Database, parcours: string, level: number, cycle = 0): number {
  const rows = db
    .prepare(
      `SELECT DISTINCT day_index FROM seances
       WHERE parcours = ? AND level = ? AND cycle = ? AND completed_at IS NOT NULL`,
    )
    .all(parcours, level, cycle) as { day_index: number }[];
  return rows.length;
}

export function getLatestCompletedSeanceId(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
  cycle = 0,
): number | null {
  const row = db
    .prepare(
      `SELECT id FROM seances
       WHERE parcours = ? AND level = ? AND day_index = ? AND cycle = ? AND completed_at IS NOT NULL
       ORDER BY completed_at DESC, id DESC LIMIT 1`,
    )
    .get(parcours, level, dayIndex, cycle) as { id: number } | undefined;
  return row ? row.id : null;
}

// Le plus grand cycle jamais tenté pour ce niveau (0 si jamais commencé) —
// utilisé pour savoir quel passage regarder quand on n'est pas positionné
// dessus (grille du programme, reprise d'un niveau déjà terminé).
export function getLatestCycleForLevel(db: Database.Database, parcours: string, level: number): number {
  const row = db
    .prepare(`SELECT MAX(cycle) AS cycle FROM seances WHERE parcours = ? AND level = ?`)
    .get(parcours, level) as { cycle: number | null };
  return row.cycle ?? 0;
}

// Cycle à utiliser pour démarrer/reprendre une séance à cette position. Reste
// sur le cycle en cours tant que ce jour n'y est pas déjà validé ; en ouvre un
// nouveau sinon (redémarrage d'un niveau déjà fait en partie ou en totalité —
// cf. LevelUpPrompt "Refaire ce niveau" et la reprise manuelle d'un niveau terminé).
export function resolveCycleForJump(db: Database.Database, parcours: string, level: number, dayIndex: number): number {
  const latest = getLatestCycleForLevel(db, parcours, level);
  return isDayValidated(db, parcours, level, dayIndex, latest) ? latest + 1 : latest;
}
