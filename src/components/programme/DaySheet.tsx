"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sheet } from "@/components/Sheet";
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
    <Sheet open onClose={onClose} title={`${meta.label} · Niveau ${level + 1} · Jour ${dayIndex + 1}`}>
      {isRestDay ? (
        <p className="text-15 text-graphite">Repos</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
            {exercises.map((e, i) => (
              <div
                key={e.id}
                className={`flex items-baseline justify-between gap-4 ${i > 0 ? "pt-3 border-t border-hairline" : ""}`}
              >
                <span className="text-15">{e.name}</span>
                <span className="font-archivo text-18 font-semibold tabular-nums whitespace-nowrap">
                  {formatTarget(e.sets, e.target)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2.5 mt-6">
            <Link
              href={playerHref}
              className="h-14 rounded-pill bg-cobalt text-paper flex items-center justify-center font-archivo text-15 font-semibold"
            >
              Démarrer ce jour
            </Link>
            {!confirmingMove ? (
              <button
                type="button"
                onClick={() => setConfirmingMove(true)}
                className="h-11 font-archivo text-15 font-medium text-graphite"
              >
                Reprendre ici
              </button>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-13 text-graphite text-center">Ta progression repart de ce jour. Tu es sûr ?</p>
                <button
                  type="button"
                  onClick={confirmMove}
                  className="h-11 rounded-pill bg-ink text-paper font-archivo text-15 font-semibold"
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
