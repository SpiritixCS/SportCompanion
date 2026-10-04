"use client";

import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { PyramidLauncher } from "./PyramidLauncher";
import { pyramidSteps } from "@/lib/pyramide/pyramid";
import type { CatalogExercise } from "@/lib/pyramide/catalog";

export type PyramidCardProps = {
  suggestions: string[];
  catalog: CatalogExercise[];
  lastPeaks: Record<string, number>;
};

// Carte « Pyramide » (Aujourd'hui et Tracking) : ouvre la feuille de lancement.
export function PyramidCard({ suggestions, catalog, lastPeaks, activeHref }: PyramidCardProps & { activeHref: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="card-rise bg-paper rounded-[28px] p-5">
        <span className="font-mono text-11 uppercase tracking-[0.14em] text-sage-strong">Pyramide</span>
        <h2 className="font-display font-extrabold text-[34px] uppercase leading-[0.92] mt-1.5">UP, DOWN</h2>
        <div aria-hidden="true" className="flex items-end gap-[3px] h-[34px] mt-3 mb-4">
          {pyramidSteps("classic", 5).map((reps, i) => (
            <span key={i} style={{ height: `${reps * 20}%` }} className="flex-1 rounded-[3px] bg-sage-soft" />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-14 w-full rounded-pill border border-hairline bg-paper font-body text-15 font-semibold"
        >
          Lancer une pyramide
        </button>
      </div>
      {open && (
        <Sheet open onClose={() => setOpen(false)} eyebrow="Pyramide" title="Lancer" accent="sage">
          <PyramidLauncher suggestions={suggestions} catalog={catalog} lastPeaks={lastPeaks} activeHref={activeHref} />
        </Sheet>
      )}
    </>
  );
}
