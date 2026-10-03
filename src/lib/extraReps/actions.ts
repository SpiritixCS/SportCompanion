"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { addExtraReps, deleteExtraReps } from "./db";

export async function addExtraRepsAction(cardId: string, amount: number): Promise<void> {
  addExtraReps(getDbForUser(await currentUser()), cardId, amount);
}

export async function deleteExtraRepsAction(id: number): Promise<void> {
  deleteExtraReps(getDbForUser(await currentUser()), id);
}
