"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { logTrackingSetAction, completeTrackingSeanceAction } from "@/lib/tracking/actions";
import type { TrackingSetWithExercise } from "@/lib/tracking/db";

type ExerciseGroup = { exerciseOrder: number; exerciseName: string; sets: TrackingSetWithExercise[] };

function groupByExercise(sets: TrackingSetWithExercise[]): ExerciseGroup[] {
  const map = new Map<number, ExerciseGroup>();
  for (const set of sets) {
    let group = map.get(set.exerciseOrder);
    if (!group) {
      group = { exerciseOrder: set.exerciseOrder, exerciseName: set.exerciseName, sets: [] };
      map.set(set.exerciseOrder, group);
    }
    group.sets.push(set);
  }
  return [...map.values()].sort((a, b) => a.exerciseOrder - b.exerciseOrder);
}

export function TrackingSeanceScreen({
  seanceId,
  completed,
  initialSets,
  exerciseSuggestions,
}: {
  seanceId: number;
  completed: boolean;
  initialSets: TrackingSetWithExercise[];
  exerciseSuggestions: string[];
}) {
  const router = useRouter();
  const [sets, setSets] = useState(initialSets);
  const [exerciseName, setExerciseName] = useState("");
  const [reps, setReps] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const groups = groupByExercise(sets);

  async function handleAddSet() {
    const name = exerciseName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(false);
    try {
      const set = await logTrackingSetAction({ seanceId, exerciseName: name, repsActual: reps });
      setSets((prev) => [...prev, set]);
      setExerciseName("");
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    setError(false);
    try {
      await completeTrackingSeanceAction(seanceId);
      router.push("/tracking");
    } catch {
      setError(true);
    }
  }

  return (
    <div className="p-5 flex flex-col gap-6">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Tracking</span>

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-15 text-graphite">Ajoute ton premier exercice ci-dessous.</p>
      ) : (
        <Card className="overflow-hidden">
          {groups.map((group, i) => (
            <div key={group.exerciseOrder} className={`px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="text-15 font-medium">{group.exerciseName}</div>
              <div className="text-13 text-graphite mt-1">{group.sets.map((s) => s.repsActual).join(" · ")}</div>
            </div>
          ))}
        </Card>
      )}

      {!completed && (
        <Card className="p-5 flex flex-col gap-4">
          <input
            type="text"
            list="tracking-exercise-suggestions"
            value={exerciseName}
            onChange={(e) => setExerciseName(e.target.value)}
            placeholder="Nom de l'exercice"
            className="h-14 rounded-field border border-hairline px-4 text-15"
          />
          <datalist id="tracking-exercise-suggestions">
            {exerciseSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="flex items-center justify-center gap-6">
            <Button variant="secondary" onClick={() => setReps((v) => Math.max(0, v - 1))}>
              −
            </Button>
            <span className="font-archivo text-44 font-semibold tabular-nums w-16 text-center">{reps}</span>
            <Button variant="secondary" onClick={() => setReps((v) => v + 1)}>
              +
            </Button>
          </div>
          <Button
            variant="primary"
            accent="sage"
            onClick={handleAddSet}
            disabled={saving || exerciseName.trim() === ""}
          >
            Ajouter la série
          </Button>
        </Card>
      )}

      {!completed && (
        <button
          type="button"
          onClick={handleFinish}
          className="h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Terminer la séance
        </button>
      )}
    </div>
  );
}
