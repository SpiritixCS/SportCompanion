import type Database from "better-sqlite3";
import { getCurrentPosition, setCurrentPosition, isDayValidated, type CurrentPosition } from "./db";

export const LAST_DAY_INDEX = 6;

export type DayKindLookup = (
  parcours: string,
  level: number,
  dayIndex: number,
) => "train" | "rest" | undefined;

// Où la position avancerait (jours de repos et jours validés sautés), sans
// rien écrire : la page Programme, en consultation libre, en a besoin.
export function resolvePosition(db: Database.Database, getDayKind: DayKindLookup): CurrentPosition | null {
  const position = getCurrentPosition(db);
  if (!position) return null;

  let dayIndex = position.dayIndex;
  while (dayIndex < LAST_DAY_INDEX) {
    const kind = getDayKind(position.parcours, position.level, dayIndex);
    const skippable = kind === "rest" || isDayValidated(db, position.parcours, position.level, dayIndex, position.cycle);
    if (!skippable) break;
    dayIndex++;
  }
  return { ...position, dayIndex };
}

export function syncPosition(db: Database.Database, getDayKind: DayKindLookup): CurrentPosition | null {
  const current = getCurrentPosition(db);
  const resolved = resolvePosition(db, getDayKind);
  if (!current || !resolved) return null;
  if (resolved.dayIndex === current.dayIndex) return current;
  return setCurrentPosition(db, resolved.parcours, resolved.level, resolved.dayIndex, resolved.cycle);
}
