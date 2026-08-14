"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import {
  getOrStartSeance,
  logSetForExercise,
  updateSet as updateSetDb,
  deleteSet as deleteSetDb,
  deleteSetsForExercise as deleteSetsForExerciseDb,
  deleteSeance as deleteSeanceDb,
  completeSeance as completeSeanceDb,
  type TrackingSetWithExercise,
  type TrackingUnit,
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
  unit: TrackingUnit;
  valeurActual: number;
  count?: number;
}): Promise<TrackingSetWithExercise[]> {
  return logSetForExercise(await db(), params.seanceId, params.exerciseName, params.unit, params.valeurActual, params.count ?? 1);
}

export async function updateTrackingSetAction(setId: number, valeurActual: number): Promise<void> {
  updateSetDb(await db(), setId, valeurActual);
}

export async function deleteTrackingSetAction(setId: number): Promise<void> {
  deleteSetDb(await db(), setId);
}

export async function deleteTrackingExerciseAction(seanceId: number, exerciseId: number): Promise<void> {
  deleteSetsForExerciseDb(await db(), seanceId, exerciseId);
}

export async function deleteTrackingSeanceAction(seanceId: number): Promise<void> {
  deleteSeanceDb(await db(), seanceId);
}

export async function completeTrackingSeanceAction(seanceId: number): Promise<void> {
  completeSeanceDb(await db(), seanceId);
}
