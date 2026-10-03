"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { SeptTraits } from "@/components/SeptTraits";
import { ExerciseGlyph } from "@/components/glyphs/ExerciseGlyph";
import { FillLink } from "@/components/FillButton";
import { IconCheck } from "@/components/icons/IconCheck";
import type { PastilleState } from "@/components/Pastille";
import type { MovementFamily } from "@/lib/trophies/movementFamily";

const PREVIEW_COUNT = 3;

type TodayExercise = { id: string; family: string; sets: number; name: string; dose: string };

export function ProgrammeCard({
  parcoursLabel,
  level,
  dayTitle,
  pastilles,
  exercises,
  durationEstimateMinutes,
  done,
  doneReps,
  href,
}: {
  parcoursLabel: string;
  level: number;
  dayTitle: string;
  pastilles: PastilleState[];
  exercises: TodayExercise[];
  durationEstimateMinutes: number;
  done: boolean;
  doneReps: number | null;
  href: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const restCount = Math.max(0, exercises.length - PREVIEW_COUNT);
  const visibleExercises = expanded ? exercises : exercises.slice(0, PREVIEW_COUNT);
  const dayNumber = pastilles.indexOf("today") + 1 || Number(dayTitle.replace(/\D/g, "")) || 1;

  return (
    <Card className="rounded-[28px] border-0 px-5 pt-[22px] pb-5">
      <h2 className="sr-only">
        {parcoursLabel} · Niveau {level + 1} · {dayTitle}
      </h2>
      <div className="flex items-center justify-between gap-3 font-mono text-11 uppercase tracking-[0.14em]">
        <span className="text-cobalt">Programme · {parcoursLabel}</span>
        <span className="text-graphite">Niveau {level + 1}</span>
      </div>

      <div className="flex flex-col items-center mt-4">
        <div aria-hidden="true" className="font-display font-extrabold text-96 leading-[0.8] tabular-nums">
          J{dayNumber}
          <sup className="text-24 text-cobalt align-top ml-0.5">/{pastilles.length}</sup>
        </div>
        <div className="mt-6">
          <SeptTraits states={pastilles} showNumbers todayCaret />
        </div>
      </div>

      <div className="flex justify-center gap-5 mt-3 font-mono text-12 text-graphite">
        <span>
          <b className="font-display font-bold text-[22px] text-ink mr-1 tracking-[0.02em]">{exercises.length}</b>exercices
        </span>
        <span className="tabular-nums">{durationEstimateMinutes} min</span>
      </div>

      {exercises.length > 0 && (
        <div className="mt-4 border-t border-hairline">
          {visibleExercises.map((e, i) => (
            <div key={`${e.id}-${i}`} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 py-[13px] border-b border-hairline">
              <ExerciseGlyph exerciseId={e.id} family={e.family as MovementFamily} />
              <span className="text-15 leading-tight">{e.name}</span>
              <span className="flex flex-col items-end gap-1.5">
                <span className="font-display font-bold text-[20px] tracking-[0.02em] tabular-nums whitespace-nowrap">{e.dose}</span>
                <span aria-hidden="true" className="flex gap-[3px]">
                  {Array.from({ length: e.sets }, (_, k) => (
                    <i
                      key={k}
                      data-testid="set-bar"
                      style={{ animationDelay: `${500 + i * 120 + k * 60}ms` }}
                      className="trait-grow block w-2.5 h-1 rounded-pill bg-cobalt"
                    />
                  ))}
                </span>
              </span>
            </div>
          ))}
          {restCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="min-h-11 w-full flex items-center gap-2 text-13 text-graphite text-left"
            >
              {expanded ? "Voir moins" : `+${restCount} ${restCount === 1 ? "autre exercice" : "autres exercices"}`}
            </button>
          )}
        </div>
      )}

      {done ? (
        <>
          <div className="flex items-center gap-4 mt-5 pt-5 border-t border-hairline">
            <span className="w-9 h-9 rounded-pill bg-cobalt text-paper flex items-center justify-center flex-none">
              <IconCheck size={16} />
            </span>
            <span>
              <span className="block font-display font-bold text-24 tabular-nums">{doneReps ?? 0} répétitions</span>
              <span className="block text-13 text-graphite mt-0.5">Séance terminée</span>
            </span>
          </div>
          <Link
            href={href}
            className="mt-5 h-14 rounded-pill border border-hairline flex items-center justify-center font-body text-15 font-semibold"
          >
            Revoir la séance
          </Link>
        </>
      ) : (
        <div className="mt-4">
          <FillLink href={href}>Commencer la séance</FillLink>
        </div>
      )}
    </Card>
  );
}
