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
      <div className="px-[18px] pt-5 pb-4 flex flex-col gap-4">
        <div className="mb-2"><AujourdhuiHeader userLabel={user.label} onOpenReglages={() => setReglagesOpen(true)} /></div>
        <Card className="rounded-[28px] p-6">
          <span className="font-mono text-11 uppercase tracking-[0.14em] text-cobalt">
            Premier jour
          </span>
          <div className="font-display font-extrabold text-32 uppercase mt-3 leading-[0.95]">
            Choisis ton point de départ pour commencer à suivre le programme.
          </div>
          <div className="text-15 text-graphite mt-3">
            Parcours, niveau, jour. Trois choix, modifiables à tout moment.
          </div>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="mt-6 w-full h-14 rounded-pill bg-ink text-paper font-body text-15 font-semibold"
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
      <div className="px-[18px] pt-5 pb-4 flex flex-col gap-4">
        <div className="mb-2"><AujourdhuiHeader userLabel={user.label} onOpenReglages={() => setReglagesOpen(true)} /></div>
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
    <div className="px-[18px] pt-5 pb-4 flex flex-col gap-4">
      <div className="mb-2"><AujourdhuiHeader userLabel={user.label} onOpenReglages={() => setReglagesOpen(true)} /></div>
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
