import type Database from "better-sqlite3";
import { syncPosition, LAST_DAY_INDEX } from "./syncPosition";
import { isDayValidated, getLatestCompletedSeanceId, getCurrentPosition } from "./db";
import { estimateDurationMinutes } from "./estimateDuration";
import { formatTarget } from "@/lib/player/formatTarget";
import { getActiveSeance, getSetsForSeance, getSkippedExercises } from "@/lib/player/db";
import { deriveState } from "@/lib/player/deriveState";
import type { PastilleState } from "@/components/Pastille";
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
      exercisesPreview: { name: string; dose: string }[];
      exercisesRestCount: number;
      totalExercises: number;
      durationEstimateMinutes: number;
      pastilles: PastilleState[];
      done: boolean;
      doneReps: number | null;
      resume: { exerciseName: string } | null;
    };

export function loadTodayState(db: Database.Database, allParcours: ParcoursMeta[]): TodayState {
  const currentPosition = getCurrentPosition(db);
  if (!currentPosition) return { phase: "empty" };

  const parcoursMeta = allParcours.find((p) => p.id === currentPosition.parcours);
  if (!parcoursMeta) return { phase: "empty" };

  const currentLevelDays = parcoursMeta.program[currentPosition.level] ?? [];
  const currentDay = currentLevelDays[currentPosition.dayIndex];

  // If already at a training day (not day 0), use current position as-is
  // Otherwise, sync forward to find the next day that needs work
  const position =
    currentDay && currentDay.kind === "train" && currentPosition.dayIndex !== 0
      ? currentPosition
      : syncPosition(db, (parcours, level, dayIndex) => {
          const meta = allParcours.find((p) => p.id === parcours);
          return meta?.program[level]?.[dayIndex]?.kind;
        });

  if (!position) return { phase: "empty" };

  if (position.dayIndex === LAST_DAY_INDEX) {
    return {
      phase: "level-up",
      parcours: position.parcours,
      parcoursLabel: parcoursMeta.label,
      level: position.level,
    };
  }

  const levelDays = parcoursMeta.program[position.level] ?? [];
  const day = levelDays[position.dayIndex];
  if (!day || day.kind !== "train") return { phase: "empty" };

  const pastilles: PastilleState[] = levelDays.map((d, i) => {
    if (d.kind === "rest") return "restOrWalk";
    if (isDayValidated(db, position.parcours, position.level, i)) return "done";
    if (i === position.dayIndex) return "today";
    return "upcoming";
  });

  const done = isDayValidated(db, position.parcours, position.level, position.dayIndex);

  let doneReps: number | null = null;
  let resume: { exerciseName: string } | null = null;

  if (done) {
    const seanceId = getLatestCompletedSeanceId(db, position.parcours, position.level, position.dayIndex);
    if (seanceId) {
      doneReps = getSetsForSeance(db, seanceId).reduce((sum, s) => sum + s.repsActual, 0);
    }
  } else {
    const activeSeance = getActiveSeance(db, position.parcours, position.level, position.dayIndex);
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
    exercisesPreview: day.exercises.slice(0, 3).map((e) => ({ name: e.name, dose: formatTarget(e.sets, e.target) })),
    exercisesRestCount: Math.max(0, day.exercises.length - 3),
    totalExercises: day.exercises.length,
    durationEstimateMinutes: estimateDurationMinutes(day.exercises.length),
    pastilles,
    done,
    doneReps,
    resume,
  };
}
