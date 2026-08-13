"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { ResumeBanner } from "@/components/today/ResumeBanner";
import { startTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(iso));
}

export function TrackingScreen({ state }: { state: TrackingScreenState }) {
  const router = useRouter();

  async function handleStart() {
    const seanceId = await startTrackingSeanceAction();
    router.push(`/tracking/${seanceId}`);
  }

  return (
    <div className="p-5 flex flex-col gap-8">
      <div>
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-32 font-semibold leading-[1.05] mt-2">Tes séances</div>
      </div>

      {state.activeSeanceId !== null && (
        <ResumeBanner exerciseName="ta séance en cours" href={`/tracking/${state.activeSeanceId}`} accent="sage" />
      )}

      <button
        type="button"
        onClick={handleStart}
        className="h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
      >
        Enregistrer une séance
      </button>

      {state.seances.length === 0 ? (
        <p className="text-15 text-graphite">Aucune séance enregistrée pour l&apos;instant.</p>
      ) : (
        <Card className="overflow-hidden">
          {state.seances.map((seance, i) => (
            <div
              key={seance.id}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              <div>
                <div className="text-15 font-medium">{formatDateFr(seance.completedAt)}</div>
                <div className="text-13 text-graphite mt-0.5">
                  {seance.exerciseCount} exercice{seance.exerciseCount > 1 ? "s" : ""}
                </div>
              </div>
              <div className="font-archivo text-18 font-semibold tabular-nums">{seance.totalReps}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
