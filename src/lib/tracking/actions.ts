"use server";

import { getDbForUser } from "@/lib/db/client";
import { findCatalogByName } from "@/lib/pyramide/catalog";
import { clampPeak, type PyramidShape } from "@/lib/pyramide/pyramid";
import { currentUser } from "@/lib/auth/currentUser";
import {
  getOrStartSeance,
  logSetForExercise,
  updateSet as updateSetDb,
  deleteSet as deleteSetDb,
  deleteSetsForExercise as deleteSetsForExerciseDb,
  deleteSeance as deleteSeanceDb,
  completeSeance as completeSeanceDb,
  skipExercise as skipExerciseDb,
  resumeSeance as resumeSeanceDb,
  deleteActiveSeance,
  getActiveSeance,
  getPyramid,
  startPyramidSeance,
  type TrackingSetWithExercise,
  type TrackingUnit,
} from "./db";
import {
  getProgramDay,
  setDayRest as setDayRestDb,
  setDayExercises as setDayExercisesDb,
  saveDay as saveDayDb,
  advancePointer,
  type TrackingProgramDay,
  type DayExerciseInput,
} from "./program";

async function db() {
  return getDbForUser(await currentUser());
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

export async function setDayRestAction(dayOfWeek: number, isRest: boolean): Promise<TrackingProgramDay> {
  return setDayRestDb(await db(), dayOfWeek, isRest);
}

export async function setDayExercisesAction(dayOfWeek: number, exercises: DayExerciseInput[]): Promise<TrackingProgramDay> {
  return setDayExercisesDb(await db(), dayOfWeek, exercises);
}

export async function saveDayAction(
  dayOfWeek: number,
  isRest: boolean,
  exercises: DayExerciseInput[],
): Promise<TrackingProgramDay> {
  return saveDayDb(await db(), dayOfWeek, isRest, exercises);
}

// Avance le pointeur sans passer par une séance — utilisée par le bouton
// « Jour suivant » sur un jour repos, qui n'a rien à valider.
export async function advanceProgramDayAction(): Promise<number> {
  return advancePointer(await db());
}

// Bound with dayOfWeek via `.bind(null, dayOfWeek)` before being handed to
// PlayerScreen (a Client Component): a Server Component can only pass a
// Server Action reference across that boundary, never an inline closure —
// binding is how the player page attaches the day of week to each callback.
export async function logDaySetAction(
  dayOfWeek: number,
  params: {
    seanceId: number;
    exerciseOrder: number;
    exerciseId: string;
    setNumber: number;
    repsTarget: string;
    repsActual: number;
    restSeconds: number;
  },
): Promise<void> {
  const database = await db();
  const day = getProgramDay(database, dayOfWeek);
  const exercise = day.exercises.find((e) => e.ordre === params.exerciseOrder);
  if (!exercise) throw new Error("Exercice introuvable pour ce jour");
  // Une pyramide sur un exercice du catalogue crédite sa carte Trophées.
  const catalog = exercise.pyramid ? (findCatalogByName(exercise.name) ?? undefined) : undefined;
  logSetForExercise(database, params.seanceId, exercise.name, exercise.unit, params.repsActual, 1, params.exerciseOrder, catalog);
}

export async function skipDayExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipExerciseDb(await db(), seanceId, exerciseOrder);
}

export async function completeDaySeanceAction(seanceId: number): Promise<void> {
  const database = await db();
  completeSeanceDb(database, seanceId);
  advancePointer(database);
}

export async function resumeDaySeanceAction(seanceId: number): Promise<void> {
  resumeSeanceDb(await db(), seanceId);
}

// N'avance pas le pointeur : le jour reste à faire.
export async function discardDaySeanceAction(seanceId: number): Promise<void> {
  deleteActiveSeance(await db(), seanceId);
}

// Pyramide libre : une seule séance Tracking active à la fois (startPyramidSeance refuse sinon).
export async function startPyramidAction(input: { exerciseName: string; shape: PyramidShape; peak: number }): Promise<void> {
  const exerciseName = input.exerciseName.trim();
  if (!exerciseName) throw new Error("Nom d'exercice requis");
  if (input.shape !== "classic" && input.shape !== "inverted") throw new Error("Forme inconnue");
  startPyramidSeance(await db(), { exerciseName, shape: input.shape, peak: clampPeak(input.peak) });
}

export async function logPyramidSetAction(params: {
  seanceId: number;
  exerciseOrder: number;
  exerciseId: string;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
}): Promise<void> {
  const database = await db();
  const config = getPyramid(database, params.seanceId);
  if (!config || getActiveSeance(database)?.id !== params.seanceId) throw new Error("Pyramide introuvable");
  const catalog = findCatalogByName(config.exerciseName) ?? undefined;
  logSetForExercise(database, params.seanceId, config.exerciseName, "reps", params.repsActual, 1, 0, catalog);
}

// N'avance pas le pointeur du programme : une pyramide libre est hors semaine.
export async function completePyramidAction(seanceId: number): Promise<void> {
  completeSeanceDb(await db(), seanceId);
}
