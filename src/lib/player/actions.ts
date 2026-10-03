"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import {
  logSet as logSetDb,
  skipExercise as skipExerciseDb,
  completeSeance as completeSeanceDb,
  resumeSeance as resumeSeanceDb,
  deleteSeance as deleteSeanceDb,
} from "./db";

async function db() {
  return getDbForUser(await currentUser());
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
  logSetDb(await db(), dbParams);
}

export async function skipExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipExerciseDb(await db(), seanceId, exerciseOrder);
}

export async function completeSeanceAction(seanceId: number): Promise<void> {
  completeSeanceDb(await db(), seanceId);
}

export async function resumeSeanceAction(seanceId: number): Promise<void> {
  resumeSeanceDb(await db(), seanceId);
}

export async function discardSeanceAction(seanceId: number): Promise<void> {
  deleteSeanceDb(await db(), seanceId);
}
