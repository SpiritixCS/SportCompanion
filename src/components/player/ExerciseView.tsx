"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Pastille, type PastilleState } from "@/components/Pastille";
import { RepsSheet } from "./RepsSheet";
import { formatTarget } from "@/lib/player/formatTarget";
import type { Exercise } from "@/lib/workout/types";

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
  onCompleteSet,
  onSkipExercise,
}: {
  exercise: Exercise;
  exerciseIndex: number;
  totalExercises: number;
  setNumber: number;
  onCompleteSet: (repsActual: number) => void;
  onSkipExercise: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="p-5 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <span className="text-13 text-graphite">
          Exercice {exerciseIndex + 1} / {totalExercises}
        </span>
      </div>

      <Card className="p-5 flex flex-col gap-4">
        <h1 className="font-archivo text-32 font-semibold">{exercise.name}</h1>
        <div className="font-archivo text-72 font-semibold tabular-nums">
          {formatTarget(exercise.sets, exercise.target)}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: exercise.sets }, (_, i) => {
            const state: PastilleState = i + 1 < setNumber ? "done" : i + 1 === setNumber ? "today" : "upcoming";
            return <Pastille key={i} state={state} accent="cobalt" />;
          })}
        </div>
      </Card>

      <Button variant="primary" accent="cobalt" onClick={() => setSheetOpen(true)}>
        Série terminée
      </Button>

      <div className="flex justify-between text-13">
        <button type="button" onClick={onSkipExercise} className="text-graphite">
          Passer l'exercice
        </button>
        <button type="button" onClick={() => setSheetOpen(true)} className="text-graphite">
          Ajuster les reps
        </button>
      </div>

      <RepsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialValue={targetDefaultReps(exercise)}
        onConfirm={(value) => {
          setSheetOpen(false);
          onCompleteSet(value);
        }}
      />
    </div>
  );
}
