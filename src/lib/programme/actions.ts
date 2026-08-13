"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { setCurrentPosition } from "./db";
import { getParcours } from "./parcours";

async function db() {
  return getDbForUser(await currentUser());
}

export async function setCurrentPositionAction(
  parcours: string,
  level: number,
  dayIndex: number,
): Promise<void> {
  setCurrentPosition(await db(), parcours, level, dayIndex);
}

export async function resolveLevelUpAction(
  choice: "advance" | "redo",
  parcours: string,
  level: number,
): Promise<void> {
  const levelCount = getParcours(parcours)?.levelCount ?? level + 1;
  const nextLevel = choice === "advance" ? Math.min(level + 1, levelCount - 1) : level;
  setCurrentPosition(await db(), parcours, nextLevel, 0);
}
