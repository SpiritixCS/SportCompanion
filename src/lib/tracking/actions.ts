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
  skipExercise as skipExerciseDb,
  type TrackingSetWithExercise,
  type TrackingUnit,
} from "./db";
import {
  createTemplate as createTemplateDb,
  updateTemplate as updateTemplateDb,
  deleteTemplate as deleteTemplateDb,
  getTemplate as getTemplateDb,
  type Template,
  type TemplateExerciseInput,
} from "./templates";
import { setRotation as setRotationDb, advancePointer, type Rotation } from "./program";

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

export async function createTemplateAction(nom: string, exercises: TemplateExerciseInput[]): Promise<Template> {
  return createTemplateDb(await db(), nom, exercises);
}

export async function updateTemplateAction(
  templateId: number,
  nom: string,
  exercises: TemplateExerciseInput[],
): Promise<Template> {
  return updateTemplateDb(await db(), templateId, nom, exercises);
}

export async function deleteTemplateAction(templateId: number): Promise<void> {
  deleteTemplateDb(await db(), templateId);
}

export async function setRotationAction(templateIds: number[]): Promise<Rotation> {
  return setRotationDb(await db(), templateIds);
}

// Bound with templateId via `.bind(null, templateId)` before being handed to
// PlayerScreen (a Client Component): a Server Component can only pass a
// Server Action reference across that boundary, never an inline closure —
// binding is how the player page attaches the template id to each callback.
export async function logTemplateSetAction(
  templateId: number,
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
  const template = getTemplateDb(database, templateId);
  const exercise = template?.exercises.find((e) => e.ordre === params.exerciseOrder);
  if (!exercise) throw new Error("Exercice introuvable pour ce modèle");
  logSetForExercise(database, params.seanceId, exercise.name, exercise.unit, params.repsActual, 1, params.exerciseOrder);
}

export async function skipTemplateExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipExerciseDb(await db(), seanceId, exerciseOrder);
}

export async function completeTemplateSeanceAction(templateId: number, seanceId: number): Promise<void> {
  const database = await db();
  completeSeanceDb(database, seanceId);
  advancePointer(database, templateId);
}
