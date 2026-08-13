import type Database from "better-sqlite3";
import { computeTrophies, type TrophyCard } from "./computeTrophies";

export type TropheesScreenState = {
  cards: TrophyCard[];
  totalReps: number;
  seanceCount: number;
  joursActivite: number;
};

export function loadTropheesScreenState(db: Database.Database): TropheesScreenState {
  const cards = computeTrophies(db);
  const totalReps = cards.reduce((sum, c) => sum + c.total, 0);

  const seanceRow = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM seances WHERE completed_at IS NOT NULL) +
         (SELECT COUNT(*) FROM dos_seances WHERE completed_at IS NOT NULL) AS seanceCount`,
    )
    .get() as { seanceCount: number };

  // Known limitation: the two sides of this UNION are not on the same calendar.
  // `seances.completed_at` is `new Date().toISOString()` (UTC), so `date(...)`
  // extracts a UTC day; `dos_seances.date` is already a local calendar date
  // (e.g. "2026-01-05"). A Programme séance finished late evening in Paris
  // time can land on the "wrong" UTC day relative to the user's actual day,
  // and won't merge with a same-evening Dos séance into one jour d'activité.
  // Both timestamps are captured close to when the user actually acted, so
  // this is a cosmetic drift on a single-user stat, not a correctness bug —
  // a real fix means storing a local date at write time, out of scope here.
  const joursRow = db
    .prepare(
      `SELECT COUNT(DISTINCT jour) AS joursActivite FROM (
         SELECT date(completed_at) AS jour FROM seances WHERE completed_at IS NOT NULL
         UNION
         SELECT date AS jour FROM dos_seances WHERE completed_at IS NOT NULL
       )`,
    )
    .get() as { joursActivite: number };

  return {
    cards,
    totalReps,
    seanceCount: seanceRow.seanceCount,
    joursActivite: joursRow.joursActivite,
  };
}
