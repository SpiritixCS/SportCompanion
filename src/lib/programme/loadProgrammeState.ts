import type Database from "better-sqlite3";
import { isDayValidated, getLatestCycleForLevel } from "./db";
import { estimateDurationMinutes } from "./estimateDuration";
import type { DayState } from "@/components/accent";
import type { ParcoursMeta } from "./parcours";

export type ProgrammeDayRow = {
  dayIndex: number;
  title: string;
  exerciseCount: number;
  durationEstimateMinutes: number;
  pastilleState: DayState;
};

export type ProgrammeLevelRow = {
  level: number;
  percentDone: number;
  pastilles: DayState[];
  days: ProgrammeDayRow[];
};

// currentCycle : le niveau en cours se lit sur le cycle de la position (après
// « Refaire ce niveau », le nouveau cycle n'a encore aucune séance).
export function loadProgrammeState(
  db: Database.Database,
  parcoursMeta: ParcoursMeta,
  currentCycle?: { level: number; cycle: number },
): ProgrammeLevelRow[] {
  return parcoursMeta.program.map((levelDays, level) => {
    const cycle =
      currentCycle && currentCycle.level === level ? currentCycle.cycle : getLatestCycleForLevel(db, parcoursMeta.id, level);
    const pastilles: DayState[] = levelDays.map((day, dayIndex) => {
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
