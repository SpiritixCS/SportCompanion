// src/components/tracking/ProgrammeScreen.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { DayEditor } from "./DayEditor";
import { setDayRestAction, setDayExercisesAction } from "@/lib/tracking/actions";
import type { DayExerciseInput, TrackingProgramDay } from "@/lib/tracking/program";
import type { TrackingUnit } from "@/lib/tracking/db";

function pillClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium ${active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"}`;
}

export function ProgrammeScreen({
  days,
  exerciseSuggestions,
}: {
  days: TrackingProgramDay[];
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
}) {
  const router = useRouter();
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function handleToggleRest(dayOfWeek: number, isRest: boolean) {
    setError(false);
    try {
      await setDayRestAction(dayOfWeek, isRest);
      router.refresh();
    } catch {
      setError(true);
    }
  }

  async function handleSaveExercises(dayOfWeek: number, exercises: DayExerciseInput[]) {
    setSaving(true);
    setError(false);
    try {
      await setDayExercisesAction(dayOfWeek, exercises);
      setEditingDay(null);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (editingDay !== null) {
    const day = days.find((d) => d.dayOfWeek === editingDay)!;
    return (
      <DayEditor
        initialExercises={day.exercises}
        exerciseSuggestions={exerciseSuggestions}
        saving={saving}
        error={error}
        onSave={(exercises) => handleSaveExercises(editingDay, exercises)}
        onCancel={() => setEditingDay(null)}
      />
    );
  }

  return (
    <div className="p-5 flex flex-col gap-8">
      <div>
        <Link href="/tracking" className="text-15 text-graphite">
          ← Retour
        </Link>
        <div className="font-archivo text-32 font-semibold leading-[1.05] mt-2">Mon programme</div>
      </div>

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

      <Card className="overflow-hidden">
        {days.map((day, i) => (
          <div key={day.dayOfWeek} className={`px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-15 font-medium">{day.label}</div>
                {!day.isRest && (
                  <div className="text-13 text-graphite mt-0.5">
                    {day.exercises.length} exercice{day.exercises.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
              {!day.isRest && (
                <button
                  type="button"
                  onClick={() => setEditingDay(day.dayOfWeek)}
                  className="h-9 px-3 rounded-pill border border-hairline text-13 font-medium text-ink"
                >
                  Modifier
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button type="button" onClick={() => handleToggleRest(day.dayOfWeek, false)} className={pillClass(!day.isRest)}>
                Séance
              </button>
              <button type="button" onClick={() => handleToggleRest(day.dayOfWeek, true)} className={pillClass(day.isRest)}>
                Repos
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
