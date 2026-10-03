import type Database from "better-sqlite3";
import { getParcours } from "@/lib/programme/parcours";
import type { MovementFamily } from "./movementFamily";

export type TrophyCard = {
  id: string;
  module: "programme" | "tracking";
  name: string;
  unit: "reps" | "seconds";
  movementFamily: MovementFamily;
  total: number;
  firstAt: string;
  lastAt: string;
};

type Accumulator = {
  module: "programme" | "tracking";
  name: string;
  unit: "reps" | "seconds";
  movementFamily: MovementFamily;
  total: number;
  firstAt: string;
  lastAt: string;
};

function touch(acc: Accumulator, amount: number, completedAt: string): void {
  acc.total += amount;
  if (completedAt < acc.firstAt) acc.firstAt = completedAt;
  if (completedAt > acc.lastAt) acc.lastAt = completedAt;
}

export function computeTrophies(db: Database.Database): TrophyCard[] {
  const acc = new Map<string, Accumulator>();

  const programmeRows = db
    .prepare(
      `SELECT sl.exercise_order AS exerciseOrder, sl.reps_actual AS repsActual, sl.completed_at AS completedAt,
              s.parcours, s.level, s.day_index AS dayIndex
       FROM sets_logged sl JOIN seances s ON sl.seance_id = s.id`,
    )
    .all() as {
    exerciseOrder: number;
    repsActual: number;
    completedAt: string;
    parcours: string;
    level: number;
    dayIndex: number;
  }[];

  for (const row of programmeRows) {
    const parcoursMeta = getParcours(row.parcours);
    const day = parcoursMeta?.program[row.level]?.[row.dayIndex];
    if (!day || day.kind !== "train") continue;
    const exercise = day.exercises[row.exerciseOrder];
    if (!exercise) continue;
    if (!exercise.countsInStats) continue;

    const id = exercise.id;
    let entry = acc.get(id);
    if (!entry) {
      entry = {
        module: "programme",
        name: exercise.name,
        unit: "reps",
        movementFamily: exercise.movementFamily as MovementFamily,
        total: 0,
        firstAt: row.completedAt,
        lastAt: row.completedAt,
      };
      acc.set(id, entry);
    }
    touch(entry, row.repsActual, row.completedAt);
  }

  const trackingRows = db
    .prepare(
      `SELECT tsl.exercise_id AS exerciseId, te.name AS exerciseName, te.unit AS unit,
              tsl.valeur_actual AS valeurActual, tsl.completed_at AS completedAt
       FROM tracking_sets_logged tsl JOIN tracking_exercises te ON tsl.exercise_id = te.id`,
    )
    .all() as { exerciseId: number; exerciseName: string; unit: "reps" | "seconds"; valeurActual: number; completedAt: string }[];

  for (const row of trackingRows) {
    const id = `tracking-${row.exerciseId}`;
    let entry = acc.get(id);
    if (!entry) {
      entry = {
        module: "tracking",
        name: row.exerciseName,
        unit: row.unit,
        movementFamily: "other",
        total: 0,
        firstAt: row.completedAt,
        lastAt: row.completedAt,
      };
      acc.set(id, entry);
    }
    touch(entry, row.valeurActual, row.completedAt);
  }

  // Reps hors séance : ajoutées seulement à une carte déjà alimentée par des
  // séances (une carte n'existe jamais par ses seuls ajouts).
  const extraRows = db
    .prepare(`SELECT card_id AS cardId, amount, logged_at AS loggedAt FROM extra_reps`)
    .all() as { cardId: string; amount: number; loggedAt: string }[];
  for (const row of extraRows) {
    const entry = acc.get(row.cardId);
    if (entry) touch(entry, row.amount, row.loggedAt);
  }

  return [...acc.entries()].map(([id, entry]) => ({
    id,
    module: entry.module,
    name: entry.name,
    unit: entry.unit,
    movementFamily: entry.movementFamily,
    total: entry.total,
    firstAt: entry.firstAt,
    lastAt: entry.lastAt,
  }));
}
