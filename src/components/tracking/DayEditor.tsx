"use client";

import { useState } from "react";
import { FillButton } from "@/components/FillButton";
import { InitialTile } from "@/components/glyphs/InitialTile";
import { formatClock } from "@/lib/player/formatClock";
import type { TrackingUnit } from "@/lib/tracking/db";
import type { DayExerciseInput, TrackingProgramDay } from "@/lib/tracking/program";

export const DEFAULT_REST_SECONDS = 90;
const clampRest = (s: number) => Math.min(600, Math.max(15, s));

function dose(e: { setsCount: number; targetValue: number; unit: TrackingUnit }): string {
  return `${e.setsCount} × ${e.targetValue}${e.unit === "seconds" ? " s" : ""}`;
}

function Stepper({
  label,
  display,
  onStep,
  minusLabel,
  plusLabel,
}: {
  label: string;
  display: string | number;
  onStep: (direction: -1 | 1) => void;
  minusLabel: string;
  plusLabel: string;
}) {
  const btn = "w-10 h-10 rounded-pill border border-hairline bg-paper font-body text-[20px] font-medium";
  return (
    <div className="flex justify-between items-center mt-2.5">
      <span className="text-15">{label}</span>
      <span className="flex items-center gap-3">
        <button type="button" aria-label={minusLabel} onClick={() => onStep(-1)} className={btn}>
          −
        </button>
        <b className="font-display font-extrabold text-[28px] min-w-11 text-center tabular-nums">{display}</b>
        <button type="button" aria-label={plusLabel} onClick={() => onStep(1)} className={btn}>
          +
        </button>
      </span>
    </div>
  );
}

// Contenu de la feuille « Modifier le jour » de la page Tracking.
export function DayEditor({
  day,
  globalRestSeconds,
  exerciseSuggestions,
  saving,
  error,
  onSave,
}: {
  day: TrackingProgramDay;
  globalRestSeconds: number;
  exerciseSuggestions: { name: string; unit: TrackingUnit }[];
  saving: boolean;
  error: boolean;
  onSave: (isRest: boolean, exercises: DayExerciseInput[]) => void;
}) {
  // Un jour en repos sans exercice s'ouvre en séance : on vient le composer.
  const [isRest, setIsRest] = useState(day.isRest && day.exercises.length > 0);
  const [exercises, setExercises] = useState<DayExerciseInput[]>(day.exercises.map(({ ordre: _, ...e }) => e));
  const [openRest, setOpenRest] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<TrackingUnit>("reps");
  const [setsCount, setSetsCount] = useState(3);
  const [targetValue, setTargetValue] = useState(10);
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);

  const matchedExercise = exerciseSuggestions.find((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase());
  const effectiveUnit = matchedExercise?.unit ?? unit;
  const restOf = (e: DayExerciseInput) => e.restSeconds ?? globalRestSeconds;

  function handleAddExercise() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setExercises((prev) => [...prev, { name: trimmed, unit: effectiveUnit, setsCount, targetValue, restSeconds }]);
    setName("");
    setSetsCount(3);
    setTargetValue(10);
  }

  function handleMove(index: number, direction: -1 | 1) {
    setOpenRest(null);
    setExercises((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function handleStepRest(index: number, direction: -1 | 1) {
    setExercises((prev) =>
      prev.map((e, i) => (i === index ? { ...e, restSeconds: clampRest(restOf(e) + direction * 15) } : e)),
    );
  }

  const mini = "w-8 h-8 rounded-pill border border-hairline bg-paper grid place-items-center text-graphite disabled:opacity-30";

  return (
    <div>
      <div className="flex justify-between items-center py-3 border-y border-hairline">
        <span className="text-15">Jour de repos</span>
        <button
          type="button"
          role="switch"
          aria-checked={isRest}
          aria-label="Jour de repos"
          onClick={() => setIsRest((v) => !v)}
          className={`relative w-12 h-7 rounded-pill transition-colors duration-200 ${isRest ? "bg-sage" : "bg-hairline"}`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-pill bg-paper transition-transform duration-200 motion-reduce:transition-none ${
              isRest ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {error && <p className="text-13 text-alert mt-3">Une erreur est survenue. Réessaie.</p>}

      {isRest ? (
        <p className="text-[14px] text-graphite mt-3.5">Ce jour est un jour de repos.</p>
      ) : (
        <>
          {exercises.length === 0 ? (
            <p className="text-[14px] text-graphite mt-3.5">Ajoute ton premier exercice ci-dessous.</p>
          ) : (
            <div className="mt-1">
              {exercises.map((exercise, i) => (
                <div key={`${exercise.name}-${i}`} className="border-b border-hairline last:border-b-0">
                  <div className="grid grid-cols-[36px_1fr_auto_auto] gap-2.5 items-center py-3">
                    <InitialTile name={exercise.name} />
                    <span className="min-w-0">
                      <span className="block text-15 truncate">{exercise.name}</span>
                      <span className="block font-mono text-11 tracking-[0.06em] text-graphite mt-0.5">{dose(exercise)}</span>
                      <button
                        type="button"
                        aria-expanded={openRest === i}
                        onClick={() => setOpenRest(openRest === i ? null : i)}
                        className={`mt-1.5 h-[26px] px-2.5 rounded-pill border border-sage font-mono text-11 tracking-[0.04em] tabular-nums ${
                          openRest === i ? "bg-sage text-paper" : "bg-sage-soft text-sage-ink"
                        }`}
                      >
                        Repos {formatClock(restOf(exercise))}
                      </button>
                    </span>
                    <span className="flex gap-1">
                      <button type="button" aria-label={`Monter ${exercise.name}`} disabled={i === 0} onClick={() => handleMove(i, -1)} className={mini}>
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Descendre ${exercise.name}`}
                        disabled={i === exercises.length - 1}
                        onClick={() => handleMove(i, 1)}
                        className={mini}
                      >
                        ↓
                      </button>
                    </span>
                    <button
                      type="button"
                      aria-label={`Retirer ${exercise.name}`}
                      onClick={() => {
                        setOpenRest(null);
                        setExercises((prev) => prev.filter((_, j) => j !== i));
                      }}
                      className={mini}
                    >
                      ×
                    </button>
                  </div>
                  {openRest === i && (
                    <div className="pb-3">
                      <Stepper
                        label="Repos entre séries"
                        display={formatClock(restOf(exercise))}
                        onStep={(d) => handleStepRest(i, d)}
                        minusLabel={`${exercise.name} : repos moins 15 secondes`}
                        plusLabel={`${exercise.name} : repos plus 15 secondes`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-[18px] pt-4 border-t border-hairline">
            <label htmlFor="day-exercise-name" className="font-mono text-11 uppercase tracking-[0.14em] text-graphite">
              Ajouter un exercice
            </label>
            <input
              id="day-exercise-name"
              type="text"
              list="day-exercise-suggestions"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de l'exercice"
              className="mt-2 w-full h-[52px] rounded-[14px] border border-hairline bg-paper px-3.5 text-15"
            />
            <datalist id="day-exercise-suggestions">
              {exerciseSuggestions.map((e) => (
                <option key={e.name} value={e.name} />
              ))}
            </datalist>

            {matchedExercise ? (
              <p className="text-13 text-graphite mt-2.5">Unité : {matchedExercise.unit === "seconds" ? "secondes" : "reps"}</p>
            ) : (
              <div role="group" aria-label="Unité" className="grid grid-cols-2 gap-1 bg-paper border border-hairline rounded-pill p-1 mt-2.5">
                {(["reps", "seconds"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={unit === u}
                    onClick={() => setUnit(u)}
                    className={`h-[34px] rounded-pill font-body text-13 font-semibold ${unit === u ? "bg-ink text-paper" : "text-graphite"}`}
                  >
                    {u === "reps" ? "Reps" : "Secondes"}
                  </button>
                ))}
              </div>
            )}

            <Stepper
              label="Séries"
              display={setsCount}
              onStep={(d) => setSetsCount((v) => Math.max(1, v + d))}
              minusLabel="Retirer une série"
              plusLabel="Ajouter une série"
            />
            <Stepper
              label="Cible par série"
              display={targetValue}
              onStep={(d) => setTargetValue((v) => Math.max(1, v + d))}
              minusLabel="Diminuer la cible"
              plusLabel="Augmenter la cible"
            />
            <Stepper
              label="Repos entre séries"
              display={formatClock(restSeconds)}
              onStep={(d) => setRestSeconds((v) => clampRest(v + d * 15))}
              minusLabel="Repos moins 15 secondes"
              plusLabel="Repos plus 15 secondes"
            />
            <button
              type="button"
              onClick={handleAddExercise}
              disabled={name.trim() === ""}
              className="mt-3 h-14 w-full rounded-pill border border-hairline bg-paper font-body text-15 font-semibold disabled:opacity-40"
            >
              Ajouter l&apos;exercice
            </button>
          </div>
        </>
      )}

      <div className="mt-4">
        <FillButton accent="sage" onClick={() => onSave(isRest, exercises)} disabled={saving || (!isRest && exercises.length === 0)}>
          Enregistrer
        </FillButton>
      </div>
    </div>
  );
}
