"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { IconClose } from "@/components/icons/IconClose";
import { ACCENT_BG, ACCENT_BORDER, type Accent } from "@/components/Pastille";
import { RepsSheet } from "./RepsSheet";
import { formatTarget } from "@/lib/player/formatTarget";
import { formatClock } from "@/lib/player/formatClock";
import type { Exercise } from "@/lib/workout/types";

const ACCENT_OPACITY_CURRENT: Record<Accent, string> = {
  cobalt: "bg-cobalt opacity-[.55]",
  sage: "bg-sage opacity-[.55]",
  brass: "bg-brass opacity-[.55]",
};

function targetDefaultReps(exercise: Exercise): number {
  const { target } = exercise;
  if (target.maxEffort || target.value === null) return 0;
  return Array.isArray(target.value) ? target.value[0] : target.value;
}

export function ExerciseView({
  exercise,
  exerciseIndex,
  totalExercises,
  setNumber,
  elapsedSeconds,
  accent = "cobalt",
  onCompleteSet,
  onSkipExercise,
  onQuit,
}: {
  exercise: Exercise;
  exerciseIndex: number;
  totalExercises: number;
  setNumber: number;
  elapsedSeconds: number;
  accent?: Accent;
  onCompleteSet: (repsActual: number) => void;
  onSkipExercise: () => void;
  onQuit: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="h-dvh flex flex-col bg-canvas overflow-hidden">
      <div className="flex-none px-5 pt-4">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onQuit}
            aria-label="Quitter la séance"
            className="w-11 h-11 rounded-pill border border-hairline bg-paper flex items-center justify-center text-ink"
          >
            <IconClose size={18} />
          </button>
          <span className="font-display text-11 font-medium uppercase tracking-[0.08em] text-graphite tabular-nums">
            Exercice {exerciseIndex + 1} / {totalExercises}
          </span>
          <span className="font-display text-15 font-medium text-graphite tabular-nums w-11 text-right">
            {formatClock(elapsedSeconds)}
          </span>
        </div>
        <div className="flex gap-1 mt-4">
          {Array.from({ length: totalExercises }, (_, i) => (
            <div
              key={i}
              className={`flex-1 h-[3px] rounded-pill ${
                i < exerciseIndex
                  ? ACCENT_BG[accent]
                  : i === exerciseIndex
                    ? ACCENT_OPACITY_CURRENT[accent]
                    : "bg-hairline"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="aspect-[4/3] rounded-card border border-hairline bg-paper overflow-hidden">
          {!imageFailed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/exercises/${exercise.id}.jpg`}
              alt={exercise.name}
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          )}
        </div>

        <h1 className="font-display text-32 font-semibold mt-6">{exercise.name}</h1>
        <div className="font-display text-72 font-semibold tabular-nums mt-4">
          {formatTarget(exercise.sets, exercise.target)}
        </div>

        <div className="flex gap-2 mt-6">
          {Array.from({ length: exercise.sets }, (_, i) => (
            <div
              key={i}
              className={`flex-1 h-2.5 rounded-pill border ${
                i + 1 < setNumber
                  ? `${ACCENT_BG[accent]} ${ACCENT_BORDER[accent]}`
                  : "bg-paper border-hairline"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-none px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-paper border-t border-hairline shadow-[0_-12px_24px_rgba(17,19,16,0.04)]">
        <Button variant="primary" accent={accent} onClick={() => setSheetOpen(true)}>
          Série terminée
        </Button>
        <div className="flex justify-between mt-2">
          <button type="button" onClick={onSkipExercise} className="h-11 px-2 text-15 text-graphite">
            Passer l&apos;exercice
          </button>
          <button type="button" onClick={() => setSheetOpen(true)} className="h-11 px-2 text-15 text-graphite">
            Ajuster les reps
          </button>
        </div>
      </div>

      <RepsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialValue={targetDefaultReps(exercise)}
        accent={accent}
        onConfirm={(value) => {
          setSheetOpen(false);
          onCompleteSet(value);
        }}
      />
    </div>
  );
}
