"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { ResumeBanner } from "@/components/today/ResumeBanner";
import { IconClose } from "@/components/icons/IconClose";
import { startTrackingSeanceAction, deleteTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

function formatDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(iso));
}

export function TrackingScreen({ state }: { state: TrackingScreenState }) {
  const router = useRouter();
  const [error, setError] = useState(false);

  async function handleStart() {
    setError(false);
    try {
      const seanceId = await startTrackingSeanceAction();
      router.push(`/tracking/${seanceId}`);
    } catch {
      setError(true);
    }
  }

  async function handleDeleteSeance(seanceId: number) {
    setError(false);
    try {
      await deleteTrackingSeanceAction(seanceId);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  return (
    <div className="p-5 flex flex-col gap-8">
      <div>
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-32 font-semibold leading-[1.05] mt-2">Tes séances</div>
      </div>

      {state.activeSeance !== null && (
        <ResumeBanner exerciseName="ta séance en cours" href={`/tracking/${state.activeSeance.id}`} accent="sage" />
      )}

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleStart}
        className="h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
      >
        Enregistrer une séance libre
      </button>

      {state.seances.length === 0 ? (
        <p className="text-15 text-graphite">Aucune séance enregistrée pour l&apos;instant.</p>
      ) : (
        <Card className="overflow-hidden">
          {state.seances.map((seance, i) => (
            <div
              key={seance.id}
              className={`flex items-center gap-2 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              <Link href={`/tracking/${seance.id}`} className="flex-1 flex items-center justify-between gap-4 min-w-0">
                <div>
                  <div className="text-15 font-medium">{formatDateFr(seance.completedAt)}</div>
                  <div className="text-13 text-graphite mt-0.5">
                    {seance.exerciseCount} exercice{seance.exerciseCount > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="text-right">
                  {seance.totalReps > 0 && (
                    <div className="font-archivo text-18 font-semibold tabular-nums">{seance.totalReps}</div>
                  )}
                  {seance.totalSeconds > 0 && (
                    <div
                      className={`font-archivo tabular-nums ${
                        seance.totalReps > 0 ? "text-13 text-graphite" : "text-18 font-semibold"
                      }`}
                    >
                      {seance.totalSeconds} s
                    </div>
                  )}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => handleDeleteSeance(seance.id)}
                aria-label="Supprimer la séance"
                className="text-graphite flex-none w-9 h-9 flex items-center justify-center"
              >
                <IconClose size={16} />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
