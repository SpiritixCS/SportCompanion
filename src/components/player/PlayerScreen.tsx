"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExerciseView } from "./ExerciseView";
import { RestView } from "./RestView";
import { SummaryView } from "./SummaryView";
import { Sheet } from "@/components/Sheet";
import { REST_BETWEEN_SETS_SECONDS, REST_BETWEEN_EXERCISES_SECONDS } from "@/lib/player/constants";
import { useWakeLock } from "@/lib/player/useWakeLock";
import { activeDurationSeconds, isInactive } from "@/lib/player/activeDuration";
import type { Accent } from "@/components/accent";
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
  | { kind: "summary" }
  | {
      kind: "rest";
      variant: "betweenSets" | "betweenExercises";
      durationSeconds: number;
      nextLabel: string;
      next: { index: number; setNumber: number } | null;
    };

function findNextIndex(day: TrainDay, fromExerciseOrder: number, skippedExerciseOrders: number[]): number | null {
  const skipped = new Set(skippedExerciseOrders);
  for (let i = fromExerciseOrder + 1; i < day.exercises.length; i++) {
    if (!skipped.has(i)) return i;
  }
  return null;
}

function findNextLabel(day: TrainDay, fromExerciseOrder: number, skippedExerciseOrders: number[]): string {
  const i = findNextIndex(day, fromExerciseOrder, skippedExerciseOrders);
  return i === null ? "Fin de séance" : day.exercises[i]!.name;
}

// Ancré sur les horodatages DB (début, reprise, séries) — jamais un compteur
// client seul (CLAUDE.md §2). Démarre à 0 pour que SSR et hydratation
// concordent ; la vraie valeur arrive au premier tick côté client.
function useActiveSeconds(events: (string | null | undefined)[]): number {
  const [seconds, setSeconds] = useState(0);
  const key = events.join("|");
  useEffect(() => {
    if (events.length === 0) return;
    setSeconds(activeDurationSeconds(events, Date.now()));
    const id = setInterval(() => setSeconds(activeDurationSeconds(events, Date.now())), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return seconds;
}

export function PlayerScreen({
  day,
  state,
  setsLogged,
  allTimeTotals = [],
  accent = "cobalt",
  restBetweenSetsSeconds = REST_BETWEEN_SETS_SECONDS,
  restBetweenExercisesSeconds = REST_BETWEEN_EXERCISES_SECONDS,
  keepScreenAwakeEnabled = true,
  onLogSet,
  onSkipExercise,
  onSeanceFinish,
  onResume,
  onDiscard,
}: {
  day: TrainDay;
  state: PlayerState;
  setsLogged: SetLoggedRecord[];
  allTimeTotals?: (number | undefined)[];
  accent?: Accent;
  restBetweenSetsSeconds?: number;
  restBetweenExercisesSeconds?: number;
  keepScreenAwakeEnabled?: boolean;
  onLogSet: (params: LogSetParams) => Promise<void>;
  onSkipExercise: (seanceId: number, exerciseOrder: number) => Promise<void>;
  onSeanceFinish: (seanceId: number) => Promise<void>;
  onResume: (seanceId: number) => Promise<void>;
  onDiscard: (seanceId: number) => Promise<void>;
}) {
  const router = useRouter();
  useWakeLock(keepScreenAwakeEnabled);
  const [localPhase, setLocalPhase] = useState<LocalPhase>({ kind: "exercise" });
  const [quitOpen, setQuitOpen] = useState(false);
  // Séries loggées depuis le dernier refresh serveur + reprise locale : le
  // chrono et la détection d'inactivité les voient sans attendre la DB.
  const [localSetEvents, setLocalSetEvents] = useState<string[]>([]);
  const [localResumeAt, setLocalResumeAt] = useState<string | null>(null);
  const events =
    state.phase === "completed"
      ? []
      : [state.startedAt, state.resumedAt, localResumeAt, ...setsLogged.map((s) => s.completedAt), ...localSetEvents];
  const elapsedSeconds = useActiveSeconds(events);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const setsDoneCount = setsLogged.length + localSetEvents.length;
  // Vidées seulement quand les props serveur portent les nouvelles séries :
  // router.refresh() est asynchrone, vider plus tôt ferait croire à une
  // inactivité (feuille de pause intempestive) le temps du rechargement.
  useEffect(() => {
    setLocalSetEvents([]);
  }, [setsLogged.length]);

  useEffect(() => {
    if (state.phase !== "in-progress") return;
    function check() {
      if (document.visibilityState === "visible" && isInactive(events, Date.now())) setPauseOpen(true);
    }
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, events.join("|")]);

  async function handleResume() {
    if (state.phase === "completed") return;
    await onResume(state.seanceId);
    setLocalResumeAt(new Date().toISOString());
    setPauseOpen(false);
  }

  async function handleDiscard() {
    if (state.phase === "completed") return;
    await onDiscard(state.seanceId);
    router.push("/");
  }

  function handleFinishEarly() {
    setPauseOpen(false);
    setQuitOpen(false);
    setLocalPhase({ kind: "summary" });
  }

  if (localPhase.kind === "summary" && state.phase === "in-progress") {
    return (
      <SummaryView
        exercises={day.exercises}
        setsLogged={setsLogged}
        durationSeconds={elapsedSeconds}
        allTimeTotals={allTimeTotals}
        accent={accent}
        onFinish={async () => {
          await onSeanceFinish(state.seanceId);
          router.push("/");
        }}
        onBack={() => setLocalPhase({ kind: "exercise" })}
      />
    );
  }

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
          router.push("/");
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
    const restSeconds = isLastSetOfExercise
      ? restBetweenExercisesSeconds
      : (exercise.restSeconds ?? restBetweenSetsSeconds);
    await onLogSet({
      seanceId,
      exerciseOrder,
      exerciseId: exercise.id,
      setNumber,
      repsTarget: JSON.stringify(exercise.target.value),
      repsActual,
      restSeconds,
    });
    setLocalSetEvents((prev) => [...prev, new Date().toISOString()]);
    setLocalPhase({
      kind: "rest",
      variant: isLastSetOfExercise ? "betweenExercises" : "betweenSets",
      durationSeconds: restSeconds,
      nextLabel: isLastSetOfExercise
        ? findNextLabel(day, exerciseOrder, skippedExerciseOrders)
        : exercise.name,
      next: isLastSetOfExercise
        ? (() => {
            const i = findNextIndex(day, exerciseOrder, skippedExerciseOrders);
            return i === null ? null : { index: i, setNumber: 1 };
          })()
        : { index: exerciseOrder, setNumber: setNumber + 1 },
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
        next={
          localPhase.next
            ? (() => {
                const e = day.exercises[localPhase.next.index]!;
                return { exercise: e, setNumber: localPhase.next.setNumber };
              })()
            : null
        }
        variant={localPhase.variant}
        exerciseIndex={exerciseOrder}
        totalExercises={day.exercises.length}
        setNumber={setNumber}
        totalSets={exercise.sets}
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
        nextExerciseName={(() => {
          const i = findNextIndex(day, exerciseOrder, skippedExerciseOrders);
          return i === null ? null : day.exercises[i]!.name;
        })()}
        onCompleteSet={handleCompleteSet}
        onSkipExercise={handleSkipExercise}
        onQuit={() => setQuitOpen(true)}
      />
      <Sheet open={quitOpen} onClose={() => setQuitOpen(false)} title="Quitter la séance ?">
        <p className="text-15 text-graphite leading-relaxed">
          {setsDoneCount > 0
            ? "Tu peux la valider avec ce qui est fait, ou la reprendre plus tard depuis Aujourd'hui."
            : "Aucune série n'est enregistrée."}
        </p>
        <div className="flex flex-col gap-2.5 mt-6">
          {setsDoneCount > 0 ? (
            <>
              <button type="button" onClick={handleFinishEarly} className="h-14 rounded-pill border border-hairline text-ink font-body text-15 font-semibold">
                Terminer avec ce qui est fait
              </button>
              <button type="button" onClick={() => router.push("/")} className="h-14 rounded-pill border border-hairline text-ink font-body text-15 font-semibold">
                Quitter et reprendre plus tard
              </button>
            </>
          ) : (
            <button type="button" onClick={handleDiscard} className="h-14 rounded-pill border border-alert text-alert font-body text-15 font-semibold">
              Abandonner
            </button>
          )}
          <button type="button" onClick={() => setQuitOpen(false)} className="h-14 rounded-pill bg-ink text-paper font-body text-15 font-semibold">
            Continuer la séance
          </button>
        </div>
      </Sheet>
      <Sheet open={pauseOpen && !discardConfirmOpen} onClose={handleResume} title="Séance en pause depuis longtemps">
        <p className="text-15 text-graphite leading-relaxed">
          Le temps de pause ne compte pas dans la durée.
        </p>
        <div className="flex flex-col gap-2.5 mt-6">
          <button type="button" onClick={handleResume} className="h-14 rounded-pill bg-ink text-paper font-body text-15 font-semibold">
            Reprendre
          </button>
          {setsDoneCount > 0 && (
            <button type="button" onClick={handleFinishEarly} className="h-14 rounded-pill border border-hairline text-ink font-body text-15 font-semibold">
              Terminer avec ce qui est fait
            </button>
          )}
          <button type="button" onClick={() => setDiscardConfirmOpen(true)} className="h-14 rounded-pill border border-alert text-alert font-body text-15 font-semibold">
            Effacer la séance
          </button>
        </div>
      </Sheet>
      <Sheet open={discardConfirmOpen} onClose={() => setDiscardConfirmOpen(false)} title="Effacer la séance ?">
        <p className="text-15 text-graphite leading-relaxed">
          {setsDoneCount === 1
            ? "Effacer 1 série ? Elle sort des Trophées."
            : `Effacer ${setsDoneCount} séries ? Elles sortent des Trophées.`}
        </p>
        <div className="flex flex-col gap-2.5 mt-6">
          <button type="button" onClick={handleDiscard} className="h-14 rounded-pill border border-alert text-alert font-body text-15 font-semibold">
            Effacer
          </button>
          <button type="button" onClick={() => setDiscardConfirmOpen(false)} className="h-14 rounded-pill bg-ink text-paper font-body text-15 font-semibold">
            Annuler
          </button>
        </div>
      </Sheet>
    </>
  );
}
