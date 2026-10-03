"use client";

import { useEffect, useRef, useState } from "react";
import { GlyphSvg } from "@/components/glyphs/ExerciseGlyph";
import type { Accent } from "@/components/Pastille";
import type { Exercise } from "@/lib/workout/types";
import type { MovementFamily } from "@/lib/trophies/movementFamily";

const R = 88;
const CIRCUMFERENCE = 2 * Math.PI * R;
const TICKS = Array.from({ length: 60 }, (_, k) => {
  const a = (k / 60) * 2 * Math.PI;
  const r1 = 97;
  const r2 = k % 5 === 0 ? 92 : 95;
  return { x1: 100 + r1 * Math.cos(a), y1: 100 + r1 * Math.sin(a), x2: 100 + r2 * Math.cos(a), y2: 100 + r2 * Math.sin(a) };
});

function targetLabel(e: Exercise): string {
  const t = e.target;
  if (t.maxEffort || t.value === null) return "max";
  const v = Array.isArray(t.value) ? t.value.join("-") : String(t.value);
  return t.unit === "seconds" ? `${v} s` : t.unit === "minutes" ? `${v} min` : `${v} reps`;
}

// Repos : plein écran sombre, jamais confondu avec l'exercice (CLAUDE.md §6).
export function RestView({
  durationSeconds,
  nextLabel,
  next = null,
  variant,
  exerciseIndex,
  totalExercises,
  setNumber,
  totalSets,
  accent = "cobalt",
  onComplete,
}: {
  durationSeconds: number;
  nextLabel: string;
  next?: { exercise: Exercise; setNumber: number } | null;
  variant: "betweenSets" | "betweenExercises";
  exerciseIndex: number;
  totalExercises: number;
  setNumber: number;
  totalSets: number;
  accent?: Accent;
  onComplete: () => void;
}) {
  const [msLeft, setMsLeft] = useState(durationSeconds * 1000);
  const [total, setTotal] = useState(durationSeconds * 1000);
  const endAtRef = useRef(Date.now() + durationSeconds * 1000);
  const doneRef = useRef(false);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  }

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, endAtRef.current - Date.now());
      setMsLeft(left);
      if (Math.round(left / 1000) <= 0) {
        clearInterval(id);
        finish();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExtend() {
    endAtRef.current += 15_000;
    setMsLeft((m) => m + 15_000);
    setTotal((t) => t + 15_000);
  }

  function handleSkip() {
    endAtRef.current = Date.now();
    setMsLeft(0);
    finish();
  }

  const remaining = Math.round(msLeft / 1000);
  const fraction = total > 0 ? msLeft / total : 0;
  const lastSeconds = remaining > 0 && remaining <= 3;

  return (
    <div data-testid="rest-screen" className="fixed inset-0 z-40 bg-ink text-paper flex flex-col">
      <div className="flex-none flex justify-between items-center gap-3 px-[18px] pt-[22px] font-mono text-11 uppercase tracking-[0.14em] text-mist">
        <span>{variant === "betweenExercises" ? "Exercice suivant" : "Repos entre séries"}</span>
        <span className="tabular-nums text-right">
          {variant === "betweenExercises"
            ? `Exercice ${exerciseIndex + 1} / ${totalExercises} terminé`
            : `Exercice ${exerciseIndex + 1} / ${totalExercises} · Série ${setNumber} / ${totalSets}`}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-[18px]">
        <div className="relative w-[280px] h-[280px] max-w-full">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90" aria-hidden="true">
            {TICKS.map((t, k) => (
              <line key={k} {...t} className="stroke-[#3A404C]" strokeWidth={2} />
            ))}
            <circle cx="100" cy="100" r={R} fill="none" className="stroke-rest-line" strokeWidth={6} />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
              className="transition-[stroke-dashoffset] duration-100 ease-linear motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`font-display font-extrabold text-120 leading-[0.85] tabular-nums ${lastSeconds ? "beat" : ""}`}
            >
              {remaining}
            </span>
            <span className="font-mono text-11 uppercase tracking-[0.14em] text-mist mt-2">secondes</span>
          </div>
        </div>

        <div className="w-full mt-7 grid grid-cols-[44px_1fr] items-center gap-3 rounded-[22px] border border-rest-line p-4">
          <span
            aria-hidden="true"
            className="w-11 h-11 rounded-[12px] bg-rest-surface text-[#B9B7FF] grid place-items-center font-display font-extrabold text-24"
          >
            {next && accent === "sage" ? (
              next.exercise.name.trim().charAt(0).toUpperCase()
            ) : next ? (
              <GlyphSvg exerciseId={next.exercise.id} family={next.exercise.movementFamily as MovementFamily} size={22} />
            ) : (
              "✓"
            )}
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-11 uppercase tracking-[0.14em] text-mist">Ensuite</span>
            <span className="block font-body text-[16px] font-semibold mt-0.5 truncate">
              {next ? next.exercise.name : nextLabel}
            </span>
            {next && (
              <span className="block font-mono text-11 uppercase tracking-[0.1em] text-mist mt-0.5">
                Série {next.setNumber} / {next.exercise.sets} · {targetLabel(next.exercise)}
              </span>
            )}
          </span>
        </div>
      </div>

      <div className="flex-none grid grid-cols-2 gap-2.5 px-[18px] pt-[18px] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleExtend}
          className="h-[60px] rounded-pill bg-rest-surface text-paper font-body text-[16px] font-semibold tabular-nums"
        >
          +15 s
        </button>
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Passer le repos"
          className="h-[60px] rounded-pill bg-paper text-ink font-body text-[16px] font-semibold"
        >
          Passer
        </button>
      </div>
    </div>
  );
}
