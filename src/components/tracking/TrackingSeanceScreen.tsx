"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RepsSheet } from "@/components/player/RepsSheet";
import { IconClose } from "@/components/icons/IconClose";
import {
  logTrackingSetAction,
  updateTrackingSetAction,
  deleteTrackingSetAction,
  deleteTrackingExerciseAction,
  completeTrackingSeanceAction,
} from "@/lib/tracking/actions";
import type { TrackingSetWithExercise, TrackingUnit } from "@/lib/tracking/db";

type ExerciseGroup = { exerciseOrder: number; exerciseName: string; unit: TrackingUnit; sets: TrackingSetWithExercise[] };

function groupByExercise(sets: TrackingSetWithExercise[]): ExerciseGroup[] {
  const map = new Map<number, ExerciseGroup>();
  for (const set of sets) {
    let group = map.get(set.exerciseOrder);
    if (!group) {
      group = { exerciseOrder: set.exerciseOrder, exerciseName: set.exerciseName, unit: set.exerciseUnit, sets: [] };
      map.set(set.exerciseOrder, group);
    }
    group.sets.push(set);
  }
  return [...map.values()].sort((a, b) => a.exerciseOrder - b.exerciseOrder);
}

function unitClass(active: boolean): string {
  return `h-[34px] rounded-pill font-body text-13 font-semibold ${active ? "bg-ink text-paper" : "text-graphite"}`;
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
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
}) {
  const router = useRouter();
  const [sets, setSets] = useState(initialSets);
  const [exerciseName, setExerciseName] = useState("");
  const [unit, setUnit] = useState<TrackingUnit>("reps");
  const [valeur, setValeur] = useState(10);
  const [count, setCount] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [editingSet, setEditingSet] = useState<TrackingSetWithExercise | null>(null);

  const groups = groupByExercise(sets);
  // Exercises already added to `sets` during this client session (created via
  // findOrCreateExercise) must lock the unit picker too, not just the
  // server-rendered `exerciseSuggestions` from page load.
  const knownExercises = [
    ...exerciseSuggestions,
    ...sets.map((s) => ({ name: s.exerciseName, unit: s.exerciseUnit })),
  ];
  const matchedExercise = knownExercises.find(
    (e) => e.name.trim().toLowerCase() === exerciseName.trim().toLowerCase(),
  );
  const effectiveUnit = matchedExercise?.unit ?? unit;

  async function handleAddSet() {
    const name = exerciseName.trim();
    if (!name || saving) return;
    setSaving(true);
    setError(false);
    try {
      const newSets = await logTrackingSetAction({ seanceId, exerciseName: name, unit: effectiveUnit, valeurActual: valeur, count });
      setSets((prev) => [...prev, ...newSets]);
      setExerciseName("");
      setCount(1);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSet(newValue: number) {
    if (!editingSet) return;
    const id = editingSet.id;
    setError(false);
    try {
      await updateTrackingSetAction(id, newValue);
      setSets((prev) => prev.map((s) => (s.id === id ? { ...s, valeurActual: newValue } : s)));
      setEditingSet(null);
    } catch {
      setError(true);
    }
  }

  async function handleDeleteSet() {
    if (!editingSet) return;
    const id = editingSet.id;
    setError(false);
    try {
      await deleteTrackingSetAction(id);
      setSets((prev) => prev.filter((s) => s.id !== id));
      setEditingSet(null);
    } catch {
      setError(true);
    }
  }

  async function handleDeleteExercise(group: ExerciseGroup) {
    const exerciseId = group.sets[0]?.exerciseId;
    if (exerciseId === undefined) return;
    setError(false);
    try {
      await deleteTrackingExerciseAction(seanceId, exerciseId);
      setSets((prev) => prev.filter((s) => s.exerciseId !== exerciseId));
    } catch {
      setError(true);
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
    <div className="px-[18px] pt-5 pb-10 flex flex-col gap-5">
      <div>
        <span className="font-mono text-11 uppercase tracking-[0.14em] text-sage-strong">Tracking</span>
        <h1 className="font-display font-extrabold text-44 uppercase leading-[0.9] mt-1.5">Séance libre</h1>
      </div>

      {error && (
        <p className="text-13 text-alert">Une erreur est survenue. Réessaie.</p>
      )}

      {groups.length === 0 ? (
        <p className="text-15 text-graphite">Ajoute ton premier exercice ci-dessous.</p>
      ) : (
        <div className="bg-paper rounded-[22px] overflow-hidden">
          {groups.map((group, i) => (
            <div key={group.exerciseOrder} className={`px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-15 font-medium">{group.exerciseName}</div>
                <button
                  type="button"
                  onClick={() => handleDeleteExercise(group)}
                  aria-label={`Supprimer ${group.exerciseName}`}
                  className="text-graphite flex-none w-7 h-7 flex items-center justify-center"
                >
                  <IconClose size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {group.sets.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setEditingSet(s)}
                    className="h-[30px] px-3 rounded-pill bg-sage-soft text-sage-ink font-display font-bold text-[16px] tabular-nums"
                  >
                    {s.valeurActual}
                    {group.unit === "seconds" ? " s" : ""}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-paper rounded-[22px] p-4 flex flex-col gap-3">
        <input
          type="text"
          list="tracking-exercise-suggestions"
          value={exerciseName}
          onChange={(e) => setExerciseName(e.target.value)}
          placeholder="Nom de l'exercice"
          className="h-[52px] rounded-[14px] border border-hairline bg-paper px-3.5 text-[16px]"
        />
        <datalist id="tracking-exercise-suggestions">
          {exerciseSuggestions.map((e) => (
            <option key={e.name} value={e.name} />
          ))}
        </datalist>

        {matchedExercise ? (
          <div className="text-13 text-graphite">Unité : {matchedExercise.unit === "seconds" ? "secondes" : "reps"}</div>
        ) : (
          <div className="grid grid-cols-2 gap-1 border border-hairline rounded-pill p-1">
            <button type="button" aria-pressed={unit === "reps"} onClick={() => setUnit("reps")} className={unitClass(unit === "reps")}>
              Reps
            </button>
            <button type="button" aria-pressed={unit === "seconds"} onClick={() => setUnit("seconds")} className={unitClass(unit === "seconds")}>
              Secondes
            </button>
          </div>
        )}

        <div className="grid grid-cols-[56px_1fr_56px] items-center">
          <button type="button" aria-label="Diminuer la valeur" onClick={() => setValeur((v) => Math.max(0, v - 1))} className="w-14 h-14 rounded-pill border border-hairline bg-paper font-body text-[26px] text-ink">
            −
          </button>
          <span className="text-center font-display font-extrabold text-72 leading-[0.85] tabular-nums">{valeur}</span>
          <button type="button" aria-label="Augmenter la valeur" onClick={() => setValeur((v) => v + 1)} className="w-14 h-14 rounded-pill border border-hairline bg-paper font-body text-[26px] text-ink">
            +
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-15">Nombre de séries</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Retirer une série du lot"
              onClick={() => setCount((v) => Math.max(1, v - 1))}
              className="w-10 h-10 rounded-pill border border-hairline bg-paper font-body text-[20px] font-medium"
            >
              −
            </button>
            <b className="font-display font-extrabold text-[28px] min-w-11 text-center tabular-nums">{count}</b>
            <button
              type="button"
              aria-label="Ajouter une série au lot"
              onClick={() => setCount((v) => v + 1)}
              className="w-10 h-10 rounded-pill border border-hairline bg-paper font-body text-[20px] font-medium"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddSet}
          disabled={saving || exerciseName.trim() === ""}
          className="h-14 w-full rounded-pill bg-sage-strong text-paper font-body text-15 font-semibold disabled:opacity-40"
        >
          Ajouter la série
        </button>
      </div>

      {!completed && (
        <button
          type="button"
          onClick={handleFinish}
          className="h-14 rounded-pill border border-hairline bg-paper flex items-center justify-center font-body text-15 font-semibold"
        >
          Terminer la séance
        </button>
      )}

      <RepsSheet
        open={editingSet !== null}
        onClose={() => setEditingSet(null)}
        initialValue={editingSet?.valeurActual ?? 0}
        accent="sage"
        title={editingSet?.exerciseUnit === "seconds" ? "Ajuster la durée (s)" : "Ajuster les reps"}
        onConfirm={handleUpdateSet}
        onDelete={handleDeleteSet}
      />
    </div>
  );
}
