// src/components/today/TrackingCard.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { advanceProgramDayAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

function doseLabel(exercise: { setsCount: number; targetValue: number; unit: "reps" | "seconds" }): string {
  return `${exercise.setsCount} × ${exercise.targetValue}${exercise.unit === "seconds" ? " s" : ""}`;
}

export function TrackingCard({ state }: { state: TrackingScreenState }) {
  const router = useRouter();
  const [advancing, setAdvancing] = useState(false);

  async function handleAdvance() {
    if (advancing) return;
    setAdvancing(true);
    try {
      await advanceProgramDayAction();
      router.refresh();
    } finally {
      setAdvancing(false);
    }
  }

  if (state.activeSeance !== null) {
    const { activeSeance } = state;
    const href =
      activeSeance.dayOfWeek !== null ? `/player/tracking?day=${activeSeance.dayOfWeek}` : `/tracking/${activeSeance.id}`;
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-18 font-semibold mt-3">{activeSeance.dayLabel ?? "Séance en cours"}</div>

        {activeSeance.plannedExercises !== null ? (
          activeSeance.plannedExercises.length > 0 && (
            <div className="flex flex-col gap-2.5 mt-5">
              {activeSeance.plannedExercises.map((exercise) => (
                <div key={exercise.ordre} className="flex items-baseline justify-between gap-4">
                  <span className="text-15">{exercise.name}</span>
                  <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                    {doseLabel(exercise)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          activeSeance.loggedExercises.length > 0 && (
            <div className="flex flex-col gap-2.5 mt-5">
              {activeSeance.loggedExercises.map((exercise) => (
                <div key={exercise.name} className="flex items-baseline justify-between gap-4">
                  <span className="text-15">{exercise.name}</span>
                  <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                    {exercise.totalValue}
                    {exercise.unit === "seconds" ? " s" : ""}
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        <Link
          href={href}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Reprendre
        </Link>
      </Card>
    );
  }

  const { programDay } = state;

  if (programDay.isRest) {
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-18 font-semibold mt-3">{programDay.label} · Repos</div>
        <button
          type="button"
          onClick={handleAdvance}
          disabled={advancing}
          className="mt-5 w-full h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold disabled:opacity-40"
        >
          Jour suivant
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
      <div className="font-archivo text-24 font-semibold mt-3.5">{programDay.label}</div>

      {programDay.exercises.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-5">
          {programDay.exercises.map((exercise) => (
            <div key={exercise.ordre} className="flex items-baseline justify-between gap-4">
              <span className="text-15">{exercise.name}</span>
              <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                {doseLabel(exercise)}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link
        href={`/player/tracking?day=${programDay.dayOfWeek}`}
        className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
      >
        Commencer
      </Link>
    </Card>
  );
}
