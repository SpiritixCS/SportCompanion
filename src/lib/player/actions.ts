"use server";

import type Database from "better-sqlite3";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import {
  logSet as logSetDb,
  skipExercise as skipExerciseDb,
  completeSeance as completeSeanceDb,
} from "./db";

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
    dbInstance = getDb(dbPath);
  }
  return dbInstance;
}

export async function logSetAction(params: {
  seanceId: number;
  exerciseOrder: number;
  exerciseId: string;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
}): Promise<void> {
  // exerciseId is discarded here: Programme's sets_logged table has no
  // exercise_id column and doesn't need one — a Programme day's composition
  // is static, so exercise_order alone always replays the right exercise.
  const { exerciseId: _exerciseId, ...dbParams } = params;
  logSetDb(db(), dbParams);
}

export async function skipExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipExerciseDb(db(), seanceId, exerciseOrder);
}

export async function completeSeanceAction(seanceId: number): Promise<void> {
  completeSeanceDb(db(), seanceId);
}
