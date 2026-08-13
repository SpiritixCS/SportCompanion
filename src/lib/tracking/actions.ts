"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import {
  getOrStartSeance,
  logSetForExercise,
  completeSeance as completeSeanceDb,
  listExerciseNames as listExerciseNamesDb,
  type TrackingSetWithExercise,
} from "./db";

async function db() {
  return getDbForUser(await currentUser());
}

export async function startTrackingSeanceAction(): Promise<number> {
  const seance = getOrStartSeance(await db());
  return seance.id;
}

export async function logTrackingSetAction(params: {
  seanceId: number;
  exerciseName: string;
  repsActual: number;
}): Promise<TrackingSetWithExercise> {
  return logSetForExercise(await db(), params.seanceId, params.exerciseName, params.repsActual);
}

export async function completeTrackingSeanceAction(seanceId: number): Promise<void> {
  completeSeanceDb(await db(), seanceId);
}

export async function listTrackingExerciseNamesAction(): Promise<string[]> {
  return listExerciseNamesDb(await db());
}
