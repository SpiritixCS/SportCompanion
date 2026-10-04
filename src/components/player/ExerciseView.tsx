"use client";

import { useState } from "react";
import { IconClose } from "@/components/icons/IconClose";
import { FillButton } from "@/components/FillButton";
import { ExerciseGlyph } from "@/components/glyphs/ExerciseGlyph";
import { InitialTile } from "@/components/glyphs/InitialTile";
import type { Accent } from "@/components/accent";
import { RepsSheet } from "./RepsSheet";
import { PyramidBars } from "./PyramidBars";
import { setTarget } from "@/lib/pyramide/pyramid";
import { formatTarget } from "@/lib/player/formatTarget";
import { formatClock } from "@/lib/player/formatClock";
import type { Exercise } from "@/lib/workout/types";
import type { MovementFamily } from "@/lib/trophies/movementFamily";

const DONE: Record<Accent, string> = { cobalt: "bg-cobalt", sage: "bg-sage", brass: "bg-brass" };
const CURRENT: Record<Accent, string> = {
  cobalt: "bg-cobalt opacity-35",
  sage: "bg-sage opacity-35",
  brass: "bg-brass opacity-35",
};
const SOFT: Record<Accent, string> = { cobalt: "bg-cobalt-soft", sage: "bg-sage-soft", brass: "bg-brass-soft" };

function targetDefaultReps(exercise: Exercise): number {
  const { target } = exercise;
  if (target.maxEffort || target.value === null) return 0;
  return Array.isArray(target.value) ? target.value[0] : target.value;
}

// « 4 × 12 / côté » → objectif en grand, suffixe en petit ; taille réduite
// pour les objectifs longs (« 3 × 20-40 ») afin de tenir sur un iPhone.
function splitTarget(label: string): { main: string; suffix: string; size: string } {
  const m = label.match(/^(\d+ × \S+)(.*)$/);
  const main = m ? m[1]! : label;
  const suffix = m ? m[2]!.trim() : "";
  const size = main.length <= 6 ? "text-112" : main.length <= 8 ? "text-[88px]" : "text-72";
  return { main, suffix, size };
}

export function ExerciseView({
  exercise,
  exerciseIndex,
  totalExercises,
  setNumber,
  elapsedSeconds,
  accent = "cobalt",
  nextExerciseName,
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
  nextExerciseName?: string | null;
  onCompleteSet: (repsActual: number) => void;
  onSkipExercise: () => void;
  onQuit: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const target = splitTarget(formatTarget(exercise.sets, exercise.target));
  const stepTarget = setTarget(exercise, setNumber);
  const pyramid = exercise.pyramid;
  const setWord = pyramid ? "Marche" : "Série";
  const isTracking = accent === "sage";

  return (
    <div className="h-dvh flex flex-col bg-canvas overflow-hidden">
      <div className="flex-none grid grid-cols-[44px_1fr_auto] items-center gap-3 px-[18px] pt-[18px]">
        <button
          type="button"
          onClick={onQuit}
          aria-label="Quitter la séance"
          className="w-11 h-11 rounded-pill border border-hairline bg-paper flex items-center justify-center text-ink"
        >
          <IconClose size={18} />
        </button>
        <div>
          <span className="block font-mono text-11 uppercase tracking-[0.14em] text-graphite tabular-nums">
            Exercice {exerciseIndex + 1} / {totalExercises}
          </span>
          <div className="flex gap-1 mt-2">
            {Array.from({ length: totalExercises }, (_, i) => (
              <span
                key={i}
                className={`flex-1 h-1 rounded-pill transition-colors duration-300 ${
                  i < exerciseIndex ? DONE[accent] : i === exerciseIndex ? CURRENT[accent] : "bg-hairline"
                }`}
              />
            ))}
          </div>
        </div>
        <span className="font-mono text-13 tabular-nums" aria-label="Durée active">
          {formatClock(elapsedSeconds)}
        </span>
      </div>

      <div className="flex-1 flex flex-col px-[18px] pt-[22px] overflow-y-auto">
        <div key={exercise.id} className="ex-slide flex-1 flex flex-col items-start bg-paper rounded-[28px] px-5 py-[22px]">
          <div data-testid="exercise-hero">
            {isTracking ? (
              <InitialTile name={exercise.name} size="lg" />
            ) : (
              <ExerciseGlyph exerciseId={exercise.id} family={exercise.movementFamily as MovementFamily} size="lg" />
            )}
          </div>
          <h1 className="font-display font-extrabold text-44 uppercase leading-[0.92] mt-[18px] [text-wrap:balance]">
            {exercise.name}
          </h1>

          <div className="mt-auto pt-6 w-full">
            {pyramid ? (
              <div className="font-display font-extrabold leading-[0.8] tracking-[-0.01em] tabular-nums text-112">
                <span data-testid="pyramid-target">{stepTarget}</span>
                <span className="text-[32px] text-graphite ml-1.5">reps</span>
              </div>
            ) : (
              <div className={`font-display font-extrabold leading-[0.8] tracking-[-0.01em] tabular-nums ${target.size}`}>
                {target.main}
                {target.suffix && <span className="text-[32px] text-graphite ml-1.5">{target.suffix}</span>}
              </div>
            )}
            {pyramid ? (
              <PyramidBars shape={pyramid.shape} peak={pyramid.peak} setNumber={setNumber} accent={accent} />
            ) : (
              <div className="flex gap-1.5 mt-4">
                {Array.from({ length: exercise.sets }, (_, i) => {
                  const state = i + 1 < setNumber ? "done" : i + 1 === setNumber ? "current" : "upcoming";
                  return (
                    <span
                      key={i}
                      data-testid="set-bar"
                      data-state={state}
                      className={`relative flex-1 h-2 rounded-pill overflow-hidden ${
                        state === "done" ? DONE[accent] : state === "current" ? SOFT[accent] : "bg-hairline"
                      }`}
                    >
                      {state === "current" && <span className={`set-pulse absolute inset-0 ${DONE[accent]}`} />}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="flex justify-between gap-3 mt-2.5 font-mono text-11 uppercase tracking-[0.14em] text-graphite">
              <span className="tabular-nums">
                {setWord} {setNumber} / {exercise.sets}
              </span>
              <span className="truncate">{nextExerciseName ? `Puis ${nextExerciseName}` : "Dernier exercice"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-none flex flex-col gap-1.5 px-[18px] pt-3.5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <FillButton accent={accent} onClick={() => setSheetOpen(true)}>
          {setWord} terminée
        </FillButton>
        <button type="button" onClick={onSkipExercise} className="h-11 font-body text-15 font-medium text-graphite">
          Passer l&apos;exercice
        </button>
      </div>

      <RepsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialValue={stepTarget ?? targetDefaultReps(exercise)}
        accent={accent}
        title={exercise.target.unit === "seconds" ? "Secondes tenues" : "Reps faites"}
        onConfirm={(value) => {
          setSheetOpen(false);
          onCompleteSet(value);
        }}
      />
    </div>
  );
}
