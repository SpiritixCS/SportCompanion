"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { ResumeBanner } from "./ResumeBanner";
import { ProgrammeCard } from "./ProgrammeCard";
import { LevelUpPrompt } from "./LevelUpPrompt";
import { BackPainCard } from "./BackPainCard";
import { SetupFlow } from "@/components/setup/SetupFlow";
import { AujourdhuiHeader } from "./AujourdhuiHeader";
import { ReglagesScreen } from "@/components/settings/ReglagesScreen";
import { TrackingCard } from "./TrackingCard";
import type { TodayState } from "@/lib/programme/loadTodayState";
import type { DosTodayState } from "@/lib/dos/loadDosTodayState";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";
import type { UserSlug } from "@/lib/auth/users";

function playerHref(parcours: string, level: number, dayIndex: number): string {
  return `/player?parcours=${parcours}&level=${level}&day=${dayIndex}`;
}

function DosCard({ dosState }: { dosState: DosTodayState }) {
  if (dosState.phase === "no-start-date") {
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
        <div className="font-archivo text-18 font-semibold mt-3">Définis ta date de départ pour commencer.</div>
        <a href="/dos" className="mt-4 h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold">
          Aller sur Dos
        </a>
      </Card>
    );
  }

  if (dosState.phase === "rest") {
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>
        <div className="font-archivo text-18 font-semibold mt-3">Repos</div>
      </Card>
    );
  }

  return (
    <BackPainCard
      jourLabel={dosState.jourLabel}
      intitule={dosState.intitule}
      exercises={dosState.exercises}
      done={dosState.done}
      doneReps={dosState.doneReps}
      href="/player/dos"
    />
  );
}

export function AujourdhuiScreen({
  state,
  dosState,
  trackingState,
  user,
}: {
  state: TodayState;
  dosState: DosTodayState | null;
  trackingState: TrackingScreenState | null;
  user: { slug: UserSlug; label: string };
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
        userSlug={user.slug}
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
        {trackingState && <TrackingCard state={trackingState} />}
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
        {trackingState && <TrackingCard state={trackingState} />}
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
      {dosState?.phase === "normal" && dosState.resume && (
        <ResumeBanner exerciseName={dosState.resume.exerciseName} href="/player/dos" accent="sage" />
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

      {dosState ? <DosCard dosState={dosState} /> : trackingState ? <TrackingCard state={trackingState} /> : null}
    </div>
  );
}
