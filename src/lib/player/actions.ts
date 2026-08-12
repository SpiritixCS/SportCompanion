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
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
}): Promise<void> {
  logSetDb(db(), params);
}

export async function skipExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipExerciseDb(db(), seanceId, exerciseOrder);
}

export async function completeSeanceAction(seanceId: number): Promise<void> {
  completeSeanceDb(db(), seanceId);
}
