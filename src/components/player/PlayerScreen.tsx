"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExerciseView } from "./ExerciseView";
import { RestView } from "./RestView";
import { SummaryView } from "./SummaryView";
import { logSetAction, skipExerciseAction, completeSeanceAction } from "@/lib/player/actions";
import { REST_BETWEEN_SETS_SECONDS, REST_BETWEEN_EXERCISES_SECONDS } from "@/lib/player/constants";
import type { TrainDay } from "@/lib/workout/types";
import type { PlayerState } from "@/lib/player/loadPlayerState";
import type { SetLoggedRecord } from "@/lib/player/db";

type LocalPhase =
  | { kind: "exercise" }
  | {
      kind: "rest";
      variant: "betweenSets" | "betweenExercises";
      durationSeconds: number;
      nextLabel: string;
    };

function findNextLabel(day: TrainDay, fromExerciseOrder: number, skippedExerciseOrders: number[]): string {
  const skipped = new Set(skippedExerciseOrders);
  for (let i = fromExerciseOrder + 1; i < day.exercises.length; i++) {
    if (!skipped.has(i)) return day.exercises[i]!.name;
  }
  return "Fin de séance";
}

export function PlayerScreen({
  day,
  state,
  setsLogged,
}: {
  day: TrainDay;
  state: PlayerState;
  setsLogged: SetLoggedRecord[];
}) {
  const router = useRouter();
  const [localPhase, setLocalPhase] = useState<LocalPhase>({ kind: "exercise" });

  if (state.phase === "pending-validation") {
    return (
      <SummaryView
        exercises={day.exercises}
        setsLogged={setsLogged}
        durationSeconds={0}
        onFinish={async () => {
          await completeSeanceAction(state.seanceId);
          router.refresh();
        }}
      />
    );
  }

  if (state.phase === "completed") {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Séance déjà validée.</p>
      </main>
    );
  }

  const { exerciseOrder, setNumber, isLastSetOfExercise } = state.next;
  const { skippedExerciseOrders, seanceId } = state;
  const exercise = day.exercises[exerciseOrder]!;

  async function handleCompleteSet(repsActual: number) {
    const restSeconds = isLastSetOfExercise ? REST_BETWEEN_EXERCISES_SECONDS : REST_BETWEEN_SETS_SECONDS;
    await logSetAction({
      seanceId,
      exerciseOrder,
      setNumber,
      repsTarget: JSON.stringify(exercise.target.value),
      repsActual,
      restSeconds,
    });
    setLocalPhase({
      kind: "rest",
      variant: isLastSetOfExercise ? "betweenExercises" : "betweenSets",
      durationSeconds: restSeconds,
      nextLabel: isLastSetOfExercise
        ? findNextLabel(day, exerciseOrder, skippedExerciseOrders)
        : exercise.name,
    });
  }

  async function handleSkipExercise() {
    await skipExerciseAction(seanceId, exerciseOrder);
    router.refresh();
  }

  if (localPhase.kind === "rest") {
    return (
      <RestView
        durationSeconds={localPhase.durationSeconds}
        nextLabel={localPhase.nextLabel}
        variant={localPhase.variant}
        onComplete={() => {
          setLocalPhase({ kind: "exercise" });
          router.refresh();
        }}
      />
    );
  }

  return (
    <ExerciseView
      exercise={exercise}
      exerciseIndex={exerciseOrder}
      totalExercises={day.exercises.length}
      setNumber={setNumber}
      onCompleteSet={handleCompleteSet}
      onSkipExercise={handleSkipExercise}
    />
  );
}
