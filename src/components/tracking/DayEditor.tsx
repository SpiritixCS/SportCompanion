"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { IconClose } from "@/components/icons/IconClose";
import type { TrackingUnit } from "@/lib/tracking/db";
import type { DayExerciseInput } from "@/lib/tracking/program";

function pillClass(active: boolean): string {
  return `h-9 px-3 rounded-pill text-13 font-medium ${active ? "bg-ink text-paper" : "bg-paper border border-hairline text-ink"}`;
}

export function DayEditor({
  initialExercises,
  exerciseSuggestions,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initialExercises: DayExerciseInput[];
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
  saving: boolean;
  error: boolean;
  onSave: (exercises: DayExerciseInput[]) => void;
  onCancel: () => void;
}) {
  const [exercises, setExercises] = useState<DayExerciseInput[]>(initialExercises);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<TrackingUnit>("reps");
  const [setsCount, setSetsCount] = useState(3);
  const [targetValue, setTargetValue] = useState(10);

  const matchedExercise = exerciseSuggestions.find((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase());
  const effectiveUnit = matchedExercise?.unit ?? unit;

  function handleAddExercise() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setExercises((prev) => [...prev, { name: trimmed, unit: effectiveUnit, setsCount, targetValue }]);
    setName("");
    setSetsCount(3);
    setTargetValue(10);
  }

  function handleRemoveExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function handleMoveExercise(index: number, direction: -1 | 1) {
    setExercises((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  return (
    <div className="p-5 flex flex-col gap-6">
      <span className="font-display text-11 font-medium uppercase tracking-[0.08em] text-sage">Jour</span>

      {error && (
        <div className="bg-paper border border-hairline rounded-card p-6">
          <p className="text-15 text-graphite">Une erreur est survenue. Réessaie.</p>
        </div>
      )}

      {exercises.length === 0 ? (
        <p className="text-15 text-graphite">Ajoute ton premier exercice ci-dessous.</p>
      ) : (
        <Card className="overflow-hidden">
          {exercises.map((exercise, i) => (
            <div key={i} className={`flex items-center gap-2 px-5 py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="text-15 font-medium">{exercise.name}</div>
                <div className="text-13 text-graphite mt-0.5">
                  {exercise.setsCount} × {exercise.targetValue}
                  {exercise.unit === "seconds" ? " s" : ""}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Monter ${exercise.name}`}
                onClick={() => handleMoveExercise(i, -1)}
                disabled={i === 0}
                className="w-9 h-9 flex items-center justify-center text-graphite disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Descendre ${exercise.name}`}
                onClick={() => handleMoveExercise(i, 1)}
                disabled={i === exercises.length - 1}
                className="w-9 h-9 flex items-center justify-center text-graphite disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Retirer ${exercise.name}`}
                onClick={() => handleRemoveExercise(i)}
                className="w-9 h-9 flex items-center justify-center text-graphite"
              >
                <IconClose size={16} />
              </button>
            </div>
          ))}
        </Card>
      )}

      <Card className="p-5 flex flex-col gap-4">
        <input
          type="text"
          list="day-exercise-suggestions"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de l'exercice"
          className="h-14 rounded-field border border-hairline px-4 text-15"
        />
        <datalist id="day-exercise-suggestions">
          {exerciseSuggestions.map((e) => (
            <option key={e.name} value={e.name} />
          ))}
        </datalist>

        {matchedExercise ? (
          <div className="text-13 text-graphite">Unité : {matchedExercise.unit === "seconds" ? "secondes" : "reps"}</div>
        ) : (
          <div className="flex gap-2">
            <button type="button" onClick={() => setUnit("reps")} className={pillClass(unit === "reps")}>
              Reps
            </button>
            <button type="button" onClick={() => setUnit("seconds")} className={pillClass(unit === "seconds")}>
              Secondes
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-15 text-graphite">Séries</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Retirer une série"
              onClick={() => setSetsCount((v) => Math.max(1, v - 1))}
              className="w-9 h-9 rounded-pill border border-hairline flex items-center justify-center font-display text-15"
            >
              −
            </button>
            <span className="font-display text-18 font-semibold tabular-nums w-6 text-center">{setsCount}</span>
            <button
              type="button"
              aria-label="Ajouter une série"
              onClick={() => setSetsCount((v) => v + 1)}
              className="w-9 h-9 rounded-pill border border-hairline flex items-center justify-center font-display text-15"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-15 text-graphite">Cible par série</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Diminuer la cible"
              onClick={() => setTargetValue((v) => Math.max(0, v - 1))}
              className="w-9 h-9 rounded-pill border border-hairline flex items-center justify-center font-display text-15"
            >
              −
            </button>
            <span className="font-display text-18 font-semibold tabular-nums w-10 text-center">{targetValue}</span>
            <button
              type="button"
              aria-label="Augmenter la cible"
              onClick={() => setTargetValue((v) => v + 1)}
              className="w-9 h-9 rounded-pill border border-hairline flex items-center justify-center font-display text-15"
            >
              +
            </button>
          </div>
        </div>

        <Button variant="primary" accent="sage" onClick={handleAddExercise} disabled={name.trim() === ""}>
          Ajouter l&apos;exercice
        </Button>
      </Card>

      <div className="flex flex-col gap-2.5">
        <Button variant="primary" accent="sage" onClick={() => onSave(exercises)} disabled={saving || exercises.length === 0}>
          Enregistrer
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="h-14 rounded-pill border border-hairline flex items-center justify-center font-display text-15 font-semibold"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
