"use client";

import Link from "next/link";
import { useCountUp } from "./useCountUp";
import { ExerciseGlyph } from "@/components/glyphs/ExerciseGlyph";
import { InitialTile } from "@/components/glyphs/InitialTile";
import { palierProgress } from "@/lib/trophies/paliers";
import type { TrophyCard as TrophyCardData } from "@/lib/trophies/computeTrophies";

export function TrophyMark({ card, size = "md" }: { card: TrophyCardData; size?: "md" | "lg" }) {
  return card.module === "tracking" ? (
    <InitialTile name={card.name} size={size} />
  ) : (
    <ExerciseGlyph exerciseId={card.id} family={card.movementFamily} size={size} />
  );
}

export function TrophyCard({ card, index }: { card: TrophyCardData; index: number }) {
  const total = useCountUp(card.total, index * 40);
  const isReps = card.unit === "reps";
  const progress = isReps ? palierProgress(card.total) : null;

  return (
    <Link
      href={`/trophees/${card.id}`}
      style={{ animationDelay: `${index * 40}ms` }}
      className="card-rise bg-paper rounded-[22px] p-3.5 flex flex-col gap-2.5 min-w-0"
    >
      <TrophyMark card={card} />
      <span className="font-display font-extrabold text-44 leading-[0.85] tabular-nums">
        {total.toLocaleString("fr-FR")}
        {!isReps && <span className="text-24"> s</span>}
      </span>
      <span className="text-[14px] leading-[1.25] min-h-[2.5em] break-words">{card.name}</span>
      {isReps && (
        <span className="block">
          <span className="flex justify-between font-mono text-[10px] tracking-[0.06em] text-graphite tabular-nums">
            <span>{progress ? `Vers ${progress.next.toLocaleString("fr-FR")}` : "Tous atteints"}</span>
            {progress && <span>{Math.floor(progress.fraction * 100)} %</span>}
          </span>
          <span className="block h-1 rounded-pill bg-hairline mt-1 overflow-hidden">
            <span
              className="trait-grow block h-full rounded-pill bg-brass"
              style={{ width: `${(progress?.fraction ?? 1) * 100}%` }}
            />
          </span>
        </span>
      )}
    </Link>
  );
}
