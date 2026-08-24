import type Database from "better-sqlite3";
import { isDayValidated, getLatestCycleForLevel } from "./db";
import { estimateDurationMinutes } from "./estimateDuration";
import type { PastilleState } from "@/components/Pastille";
import type { ParcoursMeta } from "./parcours";

export type ProgrammeDayRow = {
  dayIndex: number;
  title: string;
  exerciseCount: number;
  durationEstimateMinutes: number;
  pastilleState: PastilleState;
};

export type ProgrammeLevelRow = {
  level: number;
  percentDone: number;
  pastilles: PastilleState[];
  days: ProgrammeDayRow[];
};

export function loadProgrammeState(db: Database.Database, parcoursMeta: ParcoursMeta): ProgrammeLevelRow[] {
  return parcoursMeta.program.map((levelDays, level) => {
    const cycle = getLatestCycleForLevel(db, parcoursMeta.id, level);
    const pastilles: PastilleState[] = levelDays.map((day, dayIndex) => {
      if (day.kind === "rest") return "restOrWalk";
      return isDayValidated(db, parcoursMeta.id, level, dayIndex, cycle) ? "done" : "upcoming";
    });

    const trainingDayIndices = levelDays
      .map((day, i) => (day.kind === "train" ? i : null))
      .filter((i): i is number => i !== null);
    const doneTrainingDays = trainingDayIndices.filter((i) => pastilles[i] === "done").length;
    const percentDone =
      trainingDayIndices.length === 0 ? 0 : Math.round((doneTrainingDays / trainingDayIndices.length) * 100);

    const days: ProgrammeDayRow[] = levelDays.map((day, dayIndex) => {
      const exerciseCount = day.kind === "train" ? day.exercises.length : 0;
      return {
        dayIndex,
        title: `Jour ${dayIndex + 1}`,
        exerciseCount,
        durationEstimateMinutes: estimateDurationMinutes(exerciseCount),
        pastilleState: pastilles[dayIndex]!,
      };
    });

    return { level, percentDone, pastilles, days };
  });
}
