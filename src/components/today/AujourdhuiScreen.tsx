"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { ResumeBanner } from "./ResumeBanner";
import { ProgrammeCard } from "./ProgrammeCard";
import { LevelUpPrompt } from "./LevelUpPrompt";
import { SetupFlow } from "@/components/setup/SetupFlow";
import { AujourdhuiHeader } from "./AujourdhuiHeader";
import { ReglagesScreen } from "@/components/settings/ReglagesScreen";
import { TrackingCard } from "./TrackingCard";
import type { TodayState } from "@/lib/programme/loadTodayState";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

function playerHref(parcours: string, level: number, dayIndex: number): string {
  return `/player?parcours=${parcours}&level=${level}&day=${dayIndex}`;
}

export function AujourdhuiScreen({
  state,
  trackingState,
  user,
}: {
  state: TodayState;
  trackingState: TrackingScreenState;
  user: { label: string };
}) {
  const router = useRouter();
  const [setupOpen, setSetupOpen] = useState(false);
  const [reglagesOpen, setReglagesOpen] = useState(false);

  if (setupOpen) {
    return <SetupFlow onClose={() => setSetupOpen(false)} />;
  }

  if (reglagesOpen) {
    return (
      <ReglagesScreen
        onClose={() => setReglagesOpen(false)}
        onChangePointDepart={() => {
          setReglagesOpen(false);
          setSetupOpen(true);
        }}
        programmePosition={
          state.phase === "normal"
            ? { parcoursLabel: state.parcoursLabel, level: state.level, dayIndex: state.dayIndex }
            : state.phase === "level-up"
              ? { parcoursLabel: state.parcoursLabel, level: state.level, dayIndex: null }
              : null
        }
      />
    );
  }

  if (state.phase === "empty") {
    return (
      <div className="p-5 flex flex-col gap-8">
        <AujourdhuiHeader userLabel={user.label} onOpenReglages={() => setReglagesOpen(true)} />
        <Card className="p-6">
          <span className="font-display text-11 font-medium uppercase tracking-[0.08em] text-graphite">
            Premier jour
          </span>
          <div className="font-display text-24 font-semibold mt-3 leading-[1.15]">
            Choisis ton point de départ pour commencer à suivre le programme.
          </div>
          <div className="text-15 text-graphite mt-3">
            Parcours, niveau, jour. Trois choix, modifiables à tout moment.
          </div>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="mt-6 w-full h-14 rounded-pill bg-cobalt text-paper font-display text-15 font-semibold"
          >
            Définir mon point de départ
          </button>
        </Card>
        <TrackingCard state={trackingState} />
      </div>
    );
  }

  if (state.phase === "level-up") {
    return (
      <div className="p-5 flex flex-col gap-8">
        <AujourdhuiHeader userLabel={user.label} onOpenReglages={() => setReglagesOpen(true)} />
        <LevelUpPrompt
          parcours={state.parcours}
          parcoursLabel={state.parcoursLabel}
          level={state.level}
          onResolved={() => router.refresh()}
        />
        <TrackingCard state={trackingState} />
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-8">
      <AujourdhuiHeader userLabel={user.label} onOpenReglages={() => setReglagesOpen(true)} />
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
        exercises={state.exercises}
        durationEstimateMinutes={state.durationEstimateMinutes}
        done={state.done}
        doneReps={state.doneReps}
        href={playerHref(state.parcours, state.level, state.dayIndex)}
      />

      <TrackingCard state={trackingState} />
    </div>
  );
}
