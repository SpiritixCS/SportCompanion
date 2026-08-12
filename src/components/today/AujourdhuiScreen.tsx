"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { ResumeBanner } from "./ResumeBanner";
import { ProgrammeCard } from "./ProgrammeCard";
import { LevelUpPrompt } from "./LevelUpPrompt";
import { SetupFlow } from "@/components/setup/SetupFlow";
import type { TodayState } from "@/lib/programme/loadTodayState";

function playerHref(parcours: string, level: number, dayIndex: number): string {
  return `/player?parcours=${parcours}&level=${level}&day=${dayIndex}`;
}

export function AujourdhuiScreen({ state }: { state: TodayState }) {
  const router = useRouter();
  const [setupOpen, setSetupOpen] = useState(false);

  if (setupOpen) {
    return <SetupFlow onClose={() => setSetupOpen(false)} />;
  }

  if (state.phase === "empty") {
    return (
      <div className="p-5">
        <Card className="p-6">
          <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite">
            Premier jour
          </span>
          <div className="font-archivo text-24 font-semibold mt-3 leading-[1.15]">
            Choisis ton point de départ pour commencer à suivre le programme.
          </div>
          <div className="text-15 text-graphite mt-3">
            Parcours, niveau, jour. Trois choix, modifiables à tout moment.
          </div>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="mt-6 w-full h-14 rounded-pill bg-cobalt text-paper font-archivo text-15 font-semibold"
          >
            Définir mon point de départ
          </button>
        </Card>
      </div>
    );
  }

  if (state.phase === "level-up") {
    return (
      <div className="p-5 flex flex-col gap-8">
        <LevelUpPrompt
          parcours={state.parcours}
          parcoursLabel={state.parcoursLabel}
          level={state.level}
          onResolved={() => router.refresh()}
        />
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-8">
      {state.resume && (
        <ResumeBanner
          exerciseName={state.resume.exerciseName}
          href={playerHref(state.parcours, state.level, state.dayIndex)}
        />
      )}

      <ProgrammeCard
        parcoursLabel={state.parcoursLabel}
        level={state.level}
        dayTitle={state.dayTitle}
        pastilles={state.pastilles}
        exercisesPreview={state.exercisesPreview}
        exercisesRestCount={state.exercisesRestCount}
        durationEstimateMinutes={state.durationEstimateMinutes}
        done={state.done}
        doneReps={state.doneReps}
        href={playerHref(state.parcours, state.level, state.dayIndex)}
      />

      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
        <div className="font-archivo text-24 font-semibold mt-3.5">Arrive en phase 4</div>
      </Card>
    </div>
  );
}
