"use client";

import { Card } from "@/components/Card";
import { resolveLevelUpAction } from "@/lib/programme/actions";

export function LevelUpPrompt({
  parcours,
  parcoursLabel,
  level,
  onResolved,
}: {
  parcours: string;
  parcoursLabel: string;
  level: number;
  onResolved: () => void;
}) {
  async function resolve(choice: "advance" | "redo") {
    await resolveLevelUpAction(choice, parcours, level);
    onResolved();
  }

  return (
    <Card className="p-5">
      <span className="font-mono text-11 uppercase tracking-[0.14em] text-cobalt">Programme</span>
      <div className="font-display text-24 font-semibold mt-3.5">
        {parcoursLabel} · Niveau {level + 1} terminé
      </div>
      <div className="text-15 text-graphite mt-2">
        Passe au niveau suivant, ou refais celui-ci une semaine de plus.
      </div>
      <div className="flex flex-col gap-2.5 mt-5">
        <button
          type="button"
          onClick={() => resolve("advance")}
          className="h-14 rounded-pill bg-cobalt text-paper font-body text-15 font-semibold"
        >
          Passer au niveau suivant
        </button>
        <button
          type="button"
          onClick={() => resolve("redo")}
          className="h-14 rounded-pill border border-hairline font-body text-15 font-semibold"
        >
          Refaire ce niveau
        </button>
      </div>
    </Card>
  );
}
