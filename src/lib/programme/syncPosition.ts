import type Database from "better-sqlite3";
import { getCurrentPosition, setCurrentPosition, isDayValidated, type CurrentPosition } from "./db";

export const LAST_DAY_INDEX = 6;

export type DayKindLookup = (
  parcours: string,
  level: number,
  dayIndex: number,
) => "train" | "rest" | undefined;

export function syncPosition(db: Database.Database, getDayKind: DayKindLookup): CurrentPosition | null {
  let position = getCurrentPosition(db);
  if (!position) return null;

  while (position.dayIndex < LAST_DAY_INDEX) {
    const kind = getDayKind(position.parcours, position.level, position.dayIndex);
    const skippable =
      kind === "rest" || isDayValidated(db, position.parcours, position.level, position.dayIndex, position.cycle);
    if (!skippable) break;
    position = setCurrentPosition(db, position.parcours, position.level, position.dayIndex + 1, position.cycle);
  }

  return position;
}
