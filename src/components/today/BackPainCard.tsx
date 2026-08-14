"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { IconCheck } from "@/components/icons/IconCheck";

const PREVIEW_COUNT = 3;

export function BackPainCard({
  jourLabel,
  intitule,
  exercises,
  done,
  doneReps,
  href,
}: {
  jourLabel: string;
  intitule: string;
  exercises: { name: string; dose: string }[];
  done: boolean;
  doneReps: number | null;
  href: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const restCount = Math.max(0, exercises.length - PREVIEW_COUNT);
  const visibleExercises = expanded ? exercises : exercises.slice(0, PREVIEW_COUNT);

  return (
    <Card className="p-5">
      <span className="font-archivo text-11 font-medium uppercase tracking-[0.08em] text-sage">Dos</span>

      <div className="font-archivo text-24 font-semibold mt-3.5">
        {jourLabel} · {intitule}
      </div>

      {exercises.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-5">
          {visibleExercises.map((e, i) => (
            <div key={`${e.name}-${i}`} className="flex items-baseline justify-between gap-4">
              <span className="text-15">{e.name}</span>
              <span className="font-archivo text-15 font-medium text-graphite tabular-nums whitespace-nowrap">
                {e.dose}
              </span>
            </div>
          ))}
          {restCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="min-h-11 flex items-center text-13 text-graphite text-left"
            >
              {expanded ? "Voir moins" : restCount === 1 ? "et 1 autre" : `et ${restCount} autres`}
            </button>
          )}
        </div>
      )}

      {done ? (
        <>
          <div className="flex items-center gap-4 mt-5 pt-5 border-t border-hairline">
            <span className="w-9 h-9 rounded-pill bg-sage text-paper flex items-center justify-center flex-none">
              <IconCheck size={16} />
            </span>
            <span>
              <span className="block font-archivo text-18 font-semibold tabular-nums">
                {doneReps ?? 0} répétitions
              </span>
              <span className="block text-13 text-graphite mt-0.5">Séance terminée</span>
            </span>
          </div>
          <Link
            href={href}
            className="mt-5 h-14 rounded-pill border border-hairline flex items-center justify-center font-archivo text-15 font-semibold"
          >
            Revoir la séance
          </Link>
        </>
      ) : (
        <Link
          href={href}
          className="mt-5 h-14 rounded-pill bg-sage text-paper flex items-center justify-center font-archivo text-15 font-semibold"
        >
          Commencer
        </Link>
      )}
    </Card>
  );
}
