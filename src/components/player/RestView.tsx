"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";

export function RestView({
  durationSeconds,
  nextLabel,
  variant,
  onComplete,
}: {
  durationSeconds: number;
  nextLabel: string;
  variant: "betweenSets" | "betweenExercises";
  onComplete: () => void;
}) {
  const [remaining, setRemaining] = useState(durationSeconds);
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
  }

  function handleSkip() {
    endAtRef.current = Date.now();
    setRemaining(0);
    onComplete();
  }

  const digitColorClass = variant === "betweenSets" ? "text-cobalt" : "text-graphite";

  return (
    <div className="fixed inset-0 z-40 bg-paper flex flex-col items-center justify-center gap-6 p-5">
      <div className={`font-archivo text-96 font-semibold tabular-nums ${digitColorClass}`}>
        {remaining}
      </div>
      <div className="text-15 text-graphite text-center">
        {variant === "betweenExercises" && (
          <span className="block text-13 uppercase tracking-wide mb-1">Exercice suivant</span>
        )}
        Ensuite → {nextLabel}
      </div>
      <div className="flex gap-4">
        <Button variant="secondary" onClick={handleExtend}>
          +15s
        </Button>
        <Button variant="secondary" onClick={handleSkip}>
          Passer le repos
        </Button>
      </div>
    </div>
  );
}
