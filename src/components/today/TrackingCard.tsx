"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { startTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingScreenState } from "@/lib/tracking/loadTrackingScreenState";

export function TrackingCard({ state }: { state: TrackingScreenState }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    try {
      const seanceId = await startTrackingSeanceAction();
      router.push(`/tracking/${seanceId}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <Card className="p-5">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>
      <div className="font-archivo text-18 font-semibold mt-3">
        {state.activeSeanceId !== null ? "Séance en cours" : "Log ta séance du jour"}
      </div>
      {state.activeSeanceId !== null ? (
        <Link
          href={`/tracking/${state.activeSeanceId}`}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Reprendre
        </Link>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="mt-5 w-full h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold disabled:opacity-40"
        >
          Enregistrer une séance
        </button>
      )}
    </Card>
  );
}
