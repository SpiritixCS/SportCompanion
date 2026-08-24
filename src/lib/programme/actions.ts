"use server";

import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { setCurrentPosition, resolveCycleForJump } from "./db";
import { getParcours } from "./parcours";

async function db() {
  return getDbForUser(await currentUser());
}

export async function setCurrentPositionAction(
  parcours: string,
  level: number,
  dayIndex: number,
): Promise<void> {
  const database = await db();
  setCurrentPosition(database, parcours, level, dayIndex, resolveCycleForJump(database, parcours, level, dayIndex));
}

export async function resolveLevelUpAction(
  choice: "advance" | "redo",
  parcours: string,
  level: number,
): Promise<void> {
  const database = await db();
  const levelCount = getParcours(parcours)?.levelCount ?? level + 1;
  const nextLevel = choice === "advance" ? Math.min(level + 1, levelCount - 1) : level;
  setCurrentPosition(database, parcours, nextLevel, 0, resolveCycleForJump(database, parcours, nextLevel, 0));
}
