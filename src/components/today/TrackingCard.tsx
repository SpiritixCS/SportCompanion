// src/components/today/TrackingCard.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Sheet } from "@/components/Sheet";
import { startTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

function doseLabel(exercise: { setsCount: number; targetValue: number; unit: "reps" | "seconds" }): string {
  return `${exercise.setsCount} × ${exercise.targetValue}${exercise.unit === "seconds" ? " s" : ""}`;
}

export function TrackingCard({ state }: { state: TrackingScreenState }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [changerOpen, setChangerOpen] = useState(false);

  async function handleStartFreeform() {
    if (starting) return;
    setStarting(true);
    try {
      const seanceId = await startTrackingSeanceAction();
      router.push(`/tracking/${seanceId}`);
    } finally {
      setStarting(false);
    }
  }

  if (state.activeSeance !== null) {
    const href =
      state.activeSeance.templateId !== null
        ? `/player/tracking?templateId=${state.activeSeance.templateId}`
        : `/tracking/${state.activeSeance.id}`;
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-18 font-semibold mt-3">Séance en cours</div>
        <Link
          href={href}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Reprendre
        </Link>
      </Card>
    );
  }

  if (state.todayTemplate !== null) {
    const template = state.todayTemplate;
    const alternatives = state.rotationTemplates.filter((t) => t.templateId !== template.templateId);
    return (
      <Card className="p-5">
        <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
        <div className="font-archivo text-24 font-semibold mt-3.5">{template.nom}</div>

        {template.exercises.length > 0 && (
          <div className="flex flex-col gap-2.5 mt-5">
            {template.exercises.map((exercise) => (
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
          href={`/player/tracking?templateId=${template.templateId}`}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Commencer
        </Link>

        {alternatives.length > 0 && (
          <button
            type="button"
            onClick={() => setChangerOpen(true)}
            className="mt-3 h-11 flex items-center justify-center w-full text-15 text-graphite"
          >
            Changer
          </button>
        )}

        <Sheet open={changerOpen} onClose={() => setChangerOpen(false)} title="Changer la séance du jour">
          <div className="flex flex-col gap-2.5">
            {alternatives.map((t) => (
              <Link
                key={t.templateId}
                href={`/player/tracking?templateId=${t.templateId}`}
                className="h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
              >
                {t.nom}
              </Link>
            ))}
          </div>
        </Sheet>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
      <div className="font-archivo text-18 font-semibold mt-3">Log ta séance du jour</div>
      <button
        type="button"
        onClick={handleStartFreeform}
        disabled={starting}
        className="mt-5 w-full h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold disabled:opacity-40"
      >
        Enregistrer une séance
      </button>
    </Card>
  );
}
