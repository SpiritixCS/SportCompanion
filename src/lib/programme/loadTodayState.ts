import type Database from "better-sqlite3";
import { syncPosition, LAST_DAY_INDEX } from "./syncPosition";
import { isDayValidated, getLatestCompletedSeanceId } from "./db";
import { estimateDurationMinutes } from "./estimateDuration";
import { formatTarget } from "@/lib/player/formatTarget";
import { getActiveSeance, getSetsForSeance, getSkippedExercises } from "@/lib/player/db";
import { deriveState } from "@/lib/player/deriveState";
import type { DayState } from "@/components/accent";
import type { ParcoursMeta } from "./parcours";

export type TodayState =
  | { phase: "empty" }
  | { phase: "level-up"; parcours: string; parcoursLabel: string; level: number }
  | {
      phase: "normal";
      parcours: string;
      parcoursLabel: string;
      level: number;
      dayIndex: number;
      dayTitle: string;
      // family = movementFamily brut du programme (le picto retombe sur « other » si inconnu)
      exercises: { id: string; family: string; sets: number; name: string; dose: string }[];
      totalExercises: number;
      durationEstimateMinutes: number;
      pastilles: DayState[];
      done: boolean;
      doneReps: number | null;
      resume: { exerciseName: string } | null;
    };

export function loadTodayState(db: Database.Database, allParcours: ParcoursMeta[]): TodayState {
  const position = syncPosition(db, (parcours, level, dayIndex) => {
    const meta = allParcours.find((p) => p.id === parcours);
    return meta?.program[level]?.[dayIndex]?.kind;
  });
  if (!position) return { phase: "empty" };

  const parcoursMeta = allParcours.find((p) => p.id === position.parcours);
  if (!parcoursMeta) return { phase: "empty" };

  const levelDays = parcoursMeta.program[position.level] ?? [];

  if (position.dayIndex === LAST_DAY_INDEX) {
    const lastDay = levelDays[LAST_DAY_INDEX];
    const lastDayDone =
      !lastDay ||
      lastDay.kind === "rest" ||
      isDayValidated(db, position.parcours, position.level, LAST_DAY_INDEX, position.cycle);
    if (lastDayDone) {
      return {
        phase: "level-up",
        parcours: position.parcours,
        parcoursLabel: parcoursMeta.label,
        level: position.level,
      };
    }
  }

  const day = levelDays[position.dayIndex];
  if (!day || day.kind !== "train") return { phase: "empty" };

  const pastilles: DayState[] = levelDays.map((d, i) => {
    if (d.kind === "rest") return "restOrWalk";
    if (isDayValidated(db, position.parcours, position.level, i, position.cycle)) return "done";
    if (i === position.dayIndex) return "today";
    return "upcoming";
  });

  const done = isDayValidated(db, position.parcours, position.level, position.dayIndex, position.cycle);

  let doneReps: number | null = null;
  let resume: { exerciseName: string } | null = null;

  // done is structurally unreachable here in practice — syncPosition always walks past a
  // validated day before this runs. Kept for forward-compatibility if that contract ever changes.
  if (done) {
    const seanceId = getLatestCompletedSeanceId(db, position.parcours, position.level, position.dayIndex, position.cycle);
    if (seanceId) {
      doneReps = getSetsForSeance(db, seanceId).reduce((sum, s) => sum + s.repsActual, 0);
    }
  } else {
    const activeSeance = getActiveSeance(db, position.parcours, position.level, position.dayIndex, position.cycle);
    if (activeSeance) {
      const sets = getSetsForSeance(db, activeSeance.id);
      const skipped = getSkippedExercises(db, activeSeance.id);
      const progress = deriveState(day, sets, new Set(skipped));
      if (!progress.allSetsDone) {
        resume = { exerciseName: day.exercises[progress.next.exerciseOrder]!.name };
      }
    }
  }

  return {
    phase: "normal",
    parcours: position.parcours,
    parcoursLabel: parcoursMeta.label,
    level: position.level,
    dayIndex: position.dayIndex,
    dayTitle: `Jour ${position.dayIndex + 1}`,
    exercises: day.exercises.map((e) => ({
      id: e.id,
      family: e.movementFamily,
      sets: e.sets,
      name: e.name,
      dose: formatTarget(e.sets, e.target),
    })),
    totalExercises: day.exercises.length,
    durationEstimateMinutes: estimateDurationMinutes(day.exercises.length),
    pastilles,
    done,
    doneReps,
    resume,
  };
}
