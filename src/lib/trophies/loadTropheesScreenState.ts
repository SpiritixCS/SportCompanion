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
  const totalReps = cards.filter((c) => c.unit === "reps").reduce((sum, c) => sum + c.total, 0);

  const seanceRow = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM seances WHERE completed_at IS NOT NULL) +
         (SELECT COUNT(*) FROM tracking_seances WHERE completed_at IS NOT NULL) AS seanceCount`,
    )
    .get() as { seanceCount: number };

  const joursRow = db
    .prepare(
      `SELECT COUNT(DISTINCT jour) AS joursActivite FROM (
         SELECT date(completed_at) AS jour FROM seances WHERE completed_at IS NOT NULL
         UNION
         SELECT date(completed_at) AS jour FROM tracking_seances WHERE completed_at IS NOT NULL
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
