import type Database from "better-sqlite3";
import { getParcours } from "@/lib/programme/parcours";
import { computeBlock } from "@/lib/backpain/periode";
import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { ARBRE_EXERCISE_ID } from "@/lib/dos/bilan";

export type TrophyCard = {
  id: string;
  module: "programme" | "dos" | "tracking";
  name: string;
  total: number;
  firstAt: string;
  lastAt: string;
  byCran?: { cran: number; nom: string; total: number }[];
};

export function resolveTrophyCardId(exerciseId: string): string {
  const match = exerciseId.match(ARBRE_EXERCISE_ID);
  return match ? match[1]! : exerciseId;
}

export function isReplogEligible(exerciseId: string, countsInStats: boolean, semaine?: number): boolean {
  const match = exerciseId.match(ARBRE_EXERCISE_ID);
  if (!match) return countsInStats;
  // An arbre id with no known bloc context isn't verifiably reps-eligible —
  // treat it as ineligible rather than asserting semaine is defined.
  if (semaine === undefined) return false;
  const arbre = match[1] as ArbreId;
  const bloc = computeBlock(semaine);
  return ARBRES[arbre].prescriptions[bloc - 1]!.unite === "reps";
}

type Accumulator = {
  module: "programme" | "dos" | "tracking";
  name: string;
  total: number;
  firstAt: string;
  lastAt: string;
  byCran: Map<number, number>;
};

function touch(acc: Accumulator, amount: number, completedAt: string, cran?: number): void {
  acc.total += amount;
  if (completedAt < acc.firstAt) acc.firstAt = completedAt;
  if (completedAt > acc.lastAt) acc.lastAt = completedAt;
  if (cran !== undefined) acc.byCran.set(cran, (acc.byCran.get(cran) ?? 0) + amount);
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
    if (!isReplogEligible(exercise.id, exercise.countsInStats)) continue;

    const id = resolveTrophyCardId(exercise.id);
    let entry = acc.get(id);
    if (!entry) {
      entry = {
        module: "programme",
        name: exercise.name,
        total: 0,
        firstAt: row.completedAt,
        lastAt: row.completedAt,
        byCran: new Map(),
      };
      acc.set(id, entry);
    }
    touch(entry, row.repsActual, row.completedAt);
  }

  const dosRows = db
    .prepare(
      `SELECT dsl.exercise_id AS exerciseId, dsl.valeur_actual AS valeurActual, dsl.completed_at AS completedAt,
              ds.semaine
       FROM dos_sets_logged dsl JOIN dos_seances ds ON dsl.seance_id = ds.id`,
    )
    .all() as {
    exerciseId: string;
    valeurActual: number;
    completedAt: string;
    semaine: number;
  }[];

  for (const row of dosRows) {
    const match = row.exerciseId.match(ARBRE_EXERCISE_ID);
    if (!match) continue; // exercice fixe, jamais compté
    const arbre = match[1] as ArbreId;
    const cran = Number(match[2]);
    if (!isReplogEligible(row.exerciseId, true, row.semaine)) continue;

    let entry = acc.get(arbre);
    if (!entry) {
      entry = {
        module: "dos",
        name: ARBRES[arbre].nom,
        total: 0,
        firstAt: row.completedAt,
        lastAt: row.completedAt,
        byCran: new Map(),
      };
      acc.set(arbre, entry);
    }
    touch(entry, row.valeurActual, row.completedAt, cran);
  }

  const trackingRows = db
    .prepare(
      `SELECT tsl.exercise_id AS exerciseId, te.name AS exerciseName, tsl.reps_actual AS repsActual, tsl.completed_at AS completedAt
       FROM tracking_sets_logged tsl JOIN tracking_exercises te ON tsl.exercise_id = te.id`,
    )
    .all() as { exerciseId: number; exerciseName: string; repsActual: number; completedAt: string }[];

  for (const row of trackingRows) {
    const id = `tracking-${row.exerciseId}`;
    let entry = acc.get(id);
    if (!entry) {
      entry = {
        module: "tracking",
        name: row.exerciseName,
        total: 0,
        firstAt: row.completedAt,
        lastAt: row.completedAt,
        byCran: new Map(),
      };
      acc.set(id, entry);
    }
    touch(entry, row.repsActual, row.completedAt);
  }

  return [...acc.entries()].map(([id, entry]) => ({
    id,
    module: entry.module,
    name: entry.name,
    total: entry.total,
    firstAt: entry.firstAt,
    lastAt: entry.lastAt,
    byCran:
      entry.module === "dos"
        ? [...entry.byCran.entries()]
            .sort(([a], [b]) => a - b)
            .map(([cran, total]) => ({ cran, nom: ARBRES[id as ArbreId].crans[cran - 1]!.nom, total }))
        : undefined,
  }));
}
