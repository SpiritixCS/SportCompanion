"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENT_BG, type Accent } from "@/components/Pastille";

const ACCENT_STROKE: Record<Accent, string> = {
  cobalt: "#1F3BE0",
  sage: "#2E7D63",
  brass: "#A9782C",
};

const ACCENT_OPACITY_CURRENT: Record<Accent, string> = {
  cobalt: "bg-cobalt opacity-[.55]",
  sage: "bg-sage opacity-[.55]",
  brass: "bg-brass opacity-[.55]",
};

const CIRCLE_RADIUS = 112;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export function RestView({
  durationSeconds,
  nextLabel,
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
  variant: "betweenSets" | "betweenExercises";
  exerciseIndex: number;
  totalExercises: number;
  setNumber: number;
  totalSets: number;
  accent?: Accent;
  onComplete: () => void;
}) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [total, setTotal] = useState(durationSeconds);
  const endAtRef = useRef(Date.now() + durationSeconds * 1000);

  useEffect(() => {
    const id = setInterval(() => {
      const secondsLeft = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemaining(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(id);
        onComplete();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleExtend() {
    endAtRef.current += 15_000;
    setRemaining((r) => r + 15);
    setTotal((t) => t + 15);
  }

  function handleSkip() {
    endAtRef.current = Date.now();
    setRemaining(0);
    onComplete();
  }

  const strokeColor = variant === "betweenExercises" ? "#6E736B" : ACCENT_STROKE[accent];
  const fraction = total > 0 ? remaining / total : 0;
  const dashOffset = CIRCUMFERENCE * (1 - fraction);

  return (
    <div className="fixed inset-0 z-40 bg-paper flex flex-col items-center justify-center p-5">
      <div className="absolute top-4 left-5 right-5 flex gap-1">
        {Array.from({ length: totalExercises }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-[3px] rounded-pill ${
              i < exerciseIndex
                ? ACCENT_BG[accent]
                : i === exerciseIndex
                  ? ACCENT_OPACITY_CURRENT[accent]
                  : "bg-hairline"
            }`}
          />
        ))}
      </div>

      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-graphite">
        {variant === "betweenExercises" ? "Exercice suivant" : "Repos entre séries"}
      </span>
      <span className="text-13 text-graphite tabular-nums mt-1">
        {variant === "betweenExercises"
          ? `Exercice ${exerciseIndex + 1} / ${totalExercises} terminé`
          : `Exercice ${exerciseIndex + 1} / ${totalExercises} · Série ${setNumber} / ${totalSets}`}
      </span>

      <div className="relative w-60 h-60 mt-8 flex items-center justify-center">
        <svg width="240" height="240" viewBox="0 0 240 240" className="absolute inset-0 -rotate-90">
          <circle cx="120" cy="120" r={CIRCLE_RADIUS} fill="none" stroke="#E5E7E1" strokeWidth="2" />
          <circle
            cx="120"
            cy="120"
            r={CIRCLE_RADIUS}
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="font-archivo text-96 font-semibold tabular-nums">{remaining}</div>
      </div>

      <div className="text-15 text-graphite text-center mt-8">Ensuite → {nextLabel}</div>

      <div className="flex gap-2.5 mt-6">
        <button
          type="button"
          onClick={handleExtend}
          className="h-13 px-6 rounded-pill border border-hairline font-archivo text-15 font-semibold tabular-nums"
        >
          +15 s
        </button>
        <button
          type="button"
          onClick={handleSkip}
          className="h-13 px-6 rounded-pill bg-ink text-paper font-archivo text-15 font-semibold"
        >
          Passer le repos
        </button>
      </div>
    </div>
  );
}
