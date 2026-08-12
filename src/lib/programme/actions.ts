"use server";

import type Database from "better-sqlite3";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { setCurrentPosition } from "./db";
import { getParcours } from "./parcours";

let dbInstance: Database.Database | null = null;

function db(): Database.Database {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
    dbInstance = getDb(dbPath);
  }
  return dbInstance;
}

export async function setCurrentPositionAction(
  parcours: string,
  level: number,
  dayIndex: number,
): Promise<void> {
  setCurrentPosition(db(), parcours, level, dayIndex);
}

export async function resolveLevelUpAction(
  choice: "advance" | "redo",
  parcours: string,
  level: number,
): Promise<void> {
  const levelCount = getParcours(parcours)?.levelCount ?? level + 1;
  const nextLevel = choice === "advance" ? Math.min(level + 1, levelCount - 1) : level;
  setCurrentPosition(db(), parcours, nextLevel, 0);
}
