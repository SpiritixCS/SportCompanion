"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExerciseView } from "./ExerciseView";
import { RestView } from "./RestView";
import { SummaryView } from "./SummaryView";
import { Sheet } from "@/components/Sheet";
import { REST_BETWEEN_SETS_SECONDS, REST_BETWEEN_EXERCISES_SECONDS } from "@/lib/player/constants";
import type { Accent } from "@/components/Pastille";
import type { TrainDay } from "@/lib/workout/types";
import type { PlayerState } from "@/lib/player/loadPlayerState";
import type { SetLoggedRecord } from "@/lib/player/db";

type LogSetParams = {
  seanceId: number;
  exerciseOrder: number;
  exerciseId: string;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
};

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

function elapsedSecondsSince(startedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
}

// Anchored on the seance's DB `startedAt`, never a client-only counter —
// a full reload still shows the real elapsed time (CLAUDE.md §2 lesson).
// Seeded at 0 (not computed from Date.now()) so SSR and hydration agree;
// the real value lands a tick later, client-side only, via the effect below.
function useElapsedSeconds(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    setElapsed(elapsedSecondsSince(startedAt));
    const id = setInterval(() => setElapsed(elapsedSecondsSince(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

export function PlayerScreen({
  day,
  state,
  setsLogged,
  allTimeTotals = [],
  accent = "cobalt",
  restBetweenSetsSeconds = REST_BETWEEN_SETS_SECONDS,
  restBetweenExercisesSeconds = REST_BETWEEN_EXERCISES_SECONDS,
  onLogSet,
  onSkipExercise,
  onSeanceFinish,
}: {
  day: TrainDay;
  state: PlayerState;
  setsLogged: SetLoggedRecord[];
  allTimeTotals?: (number | undefined)[];
  accent?: Accent;
  restBetweenSetsSeconds?: number;
  restBetweenExercisesSeconds?: number;
  onLogSet: (params: LogSetParams) => Promise<void>;
  onSkipExercise: (seanceId: number, exerciseOrder: number) => Promise<void>;
  onSeanceFinish: (seanceId: number) => Promise<void>;
}) {
  const router = useRouter();
  const [localPhase, setLocalPhase] = useState<LocalPhase>({ kind: "exercise" });
  const [quitOpen, setQuitOpen] = useState(false);
  const elapsedSeconds = useElapsedSeconds(state.phase !== "completed" ? state.startedAt : null);

  if (state.phase === "pending-validation") {
    return (
      <SummaryView
        exercises={day.exercises}
        setsLogged={setsLogged}
        durationSeconds={elapsedSeconds}
        allTimeTotals={allTimeTotals}
        accent={accent}
        onFinish={async () => {
          await onSeanceFinish(state.seanceId);
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
    const restSeconds = isLastSetOfExercise ? restBetweenExercisesSeconds : restBetweenSetsSeconds;
    await onLogSet({
      seanceId,
      exerciseOrder,
      exerciseId: exercise.id,
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
    await onSkipExercise(seanceId, exerciseOrder);
    router.refresh();
  }

  if (localPhase.kind === "rest") {
    return (
      <RestView
        durationSeconds={localPhase.durationSeconds}
        nextLabel={localPhase.nextLabel}
        variant={localPhase.variant}
        accent={accent}
        onComplete={() => {
          setLocalPhase({ kind: "exercise" });
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <ExerciseView
        exercise={exercise}
        exerciseIndex={exerciseOrder}
        totalExercises={day.exercises.length}
        setNumber={setNumber}
        elapsedSeconds={elapsedSeconds}
        accent={accent}
        onCompleteSet={handleCompleteSet}
        onSkipExercise={handleSkipExercise}
        onQuit={() => setQuitOpen(true)}
      />
      <Sheet open={quitOpen} onClose={() => setQuitOpen(false)} title="Quitter la séance ?">
        <p className="text-15 text-graphite leading-relaxed">
          Elle est enregistrée où tu t&apos;es arrêté. Tu pourras la reprendre depuis Aujourd&apos;hui.
        </p>
        <div className="flex flex-col gap-2.5 mt-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="h-14 rounded-pill border border-alert text-alert font-archivo text-15 font-semibold"
          >
            Quitter et reprendre plus tard
          </button>
          <button
            type="button"
            onClick={() => setQuitOpen(false)}
            className="h-14 rounded-pill bg-ink text-paper font-archivo text-15 font-semibold"
          >
            Continuer la séance
          </button>
        </div>
      </Sheet>
    </>
  );
}
