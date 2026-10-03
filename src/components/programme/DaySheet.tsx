"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { ExerciseGlyph } from "@/components/glyphs/ExerciseGlyph";
import { FillLink } from "@/components/FillButton";
import { estimateDurationMinutes } from "@/lib/programme/estimateDuration";
import type { MovementFamily } from "@/lib/trophies/movementFamily";
import { formatTarget } from "@/lib/player/formatTarget";
import { setCurrentPositionAction } from "@/lib/programme/actions";
import { PARCOURS } from "@/lib/programme/parcours";

export function DaySheet({
  parcours,
  level,
  dayIndex,
  onClose,
}: {
  parcours: string;
  level: number;
  dayIndex: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [confirmingMove, setConfirmingMove] = useState(false);
  const meta = PARCOURS.find((p) => p.id === parcours)!;
  const day = meta.program[level]?.[dayIndex];
  const isRestDay = day?.kind === "rest";
  const exercises = day && day.kind === "train" ? day.exercises : [];
  const playerHref = `/player?parcours=${parcours}&level=${level}&day=${dayIndex}`;

  async function confirmMove() {
    await setCurrentPositionAction(parcours, level, dayIndex);
    onClose();
    router.refresh();
    router.push(playerHref);
  }

  return (
    <Sheet open onClose={onClose} title={`Jour ${dayIndex + 1}`} eyebrow={`${meta.label} · Niveau ${level + 1}`}>
      {!isRestDay && (
        <p className="-mt-2 mb-3 font-mono text-[12px] text-graphite">
          {exercises.length} exercices · {estimateDurationMinutes(exercises.length)} min
        </p>
      )}
      {isRestDay ? (
        <p className="text-15 text-graphite">Repos</p>
      ) : (
        <>
          <div className="max-h-[50vh] overflow-y-auto">
            {exercises.map((e, i) => (
              <div
                key={e.id}
                className={`grid grid-cols-[36px_1fr_auto] items-center gap-3 py-3 ${i > 0 ? "border-t border-hairline" : ""}`}
              >
                <ExerciseGlyph exerciseId={e.id} family={e.movementFamily as MovementFamily} />
                <span className="text-15 leading-tight">{e.name}</span>
                <span className="flex flex-col items-end gap-1.5">
                  <span className="font-display font-bold text-[20px] tracking-[0.02em] tabular-nums whitespace-nowrap">
                    {formatTarget(e.sets, e.target)}
                  </span>
                  <span aria-hidden="true" className="flex gap-[3px]">
                    {Array.from({ length: e.sets }, (_, k) => (
                      <i key={k} data-testid="set-bar" className="block w-2.5 h-1 rounded-pill bg-cobalt" />
                    ))}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 mt-5">
            <FillLink href={playerHref}>Démarrer ce jour</FillLink>
            {!confirmingMove ? (
              <button
                type="button"
                onClick={() => setConfirmingMove(true)}
                className="h-11 font-body text-15 font-medium text-graphite"
              >
                Reprendre ici
              </button>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-13 text-graphite text-center">Ta progression repart de ce jour. Tu es sûr ?</p>
                <button
                  type="button"
                  onClick={confirmMove}
                  className="h-11 rounded-pill bg-ink text-paper font-body text-15 font-semibold"
                >
                  Confirmer
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
